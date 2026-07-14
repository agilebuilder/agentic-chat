import type { CanonicalEvent } from './events.js'
import type { AgenticState, Diagnostic, RunStatus, StreamCursor } from './model.js'

const terminalStatuses = new Set<RunStatus>(['completed', 'failed', 'cancelled'])
const maxRetainedDiagnostics = 200
export const MAX_RETAINED_EVENT_IDS_PER_RUN = 256

function diagnostic(state: AgenticState, event: CanonicalEvent, code: Diagnostic['code'], message: string): AgenticState {
  return { ...state, diagnostics: [...state.diagnostics, { code, message, eventId: event.eventId, runId: event.runId }].slice(-maxRetainedDiagnostics) }
}

function cursorFor(state: AgenticState, runId: string): StreamCursor {
  const cursor = state.streams[runId]
  return cursor ? { ...cursor, compactedThroughSequence: cursor.compactedThroughSequence ?? 0 } : { scope: 'run', lastSequence: 0, compactedThroughSequence: 0, seenEventIds: {}, blocked: false }
}

function advanceCursor(cursor: StreamCursor, event: CanonicalEvent): StreamCursor {
  const seenEventIds = { ...cursor.seenEventIds, [event.eventId]: true as const }
  if (Object.keys(seenEventIds).length <= MAX_RETAINED_EVENT_IDS_PER_RUN) {
    return { ...cursor, lastSequence: event.sequence, seenEventIds }
  }
  return { ...cursor, lastSequence: event.sequence, compactedThroughSequence: event.sequence, seenEventIds: {} }
}

/**
 * Drops replay metadata already represented by a contiguous stream cursor.
 * Historical events remain idempotent because their sequence is covered by the
 * compacted-through watermark. A blocked cursor is never compacted.
 */
export function compactRunStream(state: AgenticState, runId: string): AgenticState {
  const cursor = state.streams[runId]
  if (!cursor || cursor.blocked || Object.keys(cursor.seenEventIds).length === 0) return state
  return {
    ...state,
    streams: {
      ...state.streams,
      [runId]: { ...cursor, compactedThroughSequence: cursor.lastSequence, seenEventIds: {} },
    },
  }
}

export function reduceEvent(state: AgenticState, event: CanonicalEvent): AgenticState {
  let cursor = cursorFor(state, event.runId)
  if (cursor.seenEventIds[event.eventId]) return state
  if (event.sequence <= cursor.compactedThroughSequence) return state
  if (cursor.blocked && event.sequence !== cursor.lastSequence + 1) {
    return diagnostic(state, event, 'sequence_gap', 'Stream is blocked pending the missing replay event or a snapshot')
  }
  if (cursor.blocked) cursor = { ...cursor, blocked: false }
  if (event.sequence !== cursor.lastSequence + 1) {
    const next = diagnostic(state, event, 'sequence_gap', `Expected sequence ${cursor.lastSequence + 1}, received ${event.sequence}`)
    return { ...next, streams: { ...next.streams, [event.runId]: { ...cursor, blocked: true } } }
  }

  const existingRun = state.runs[event.runId]
  if (existingRun && terminalStatuses.has(existingRun.status)) {
    return diagnostic(state, event, 'invalid_transition', `Run ${event.runId} is already ${existingRun.status}`)
  }

  let next: AgenticState = {
    ...state,
    runs: { ...state.runs },
    activities: { ...state.activities },
    toolCalls: { ...state.toolCalls },
    activityByToolCallId: { ...state.activityByToolCallId },
    results: { ...state.results },
    interventions: { ...state.interventions },
    streams: {
      ...state.streams,
      [event.runId]: {
        ...advanceCursor(cursor, event),
      },
    },
  }

  if (event.type === 'run.started') {
    if (existingRun?.status === 'queued') next.runs[event.runId] = { ...existingRun, status: 'running', startedAt: event.timestamp }
    else if (existingRun) return diagnostic(next, event, 'invalid_transition', `Run ${event.runId} has already started`)
    else next.runs[event.runId] = { id: event.runId, threadId: event.threadId, status: 'running', activityIds: [], createdAt: event.timestamp, startedAt: event.timestamp }
  } else if (!existingRun && (event.type === 'run.cancelled' || event.type === 'run.failed')) {
    next.runs[event.runId] = {
      id: event.runId,
      threadId: event.threadId,
      status: event.type === 'run.cancelled' ? 'cancelled' : 'failed',
      activityIds: [],
      createdAt: event.timestamp,
      endedAt: event.timestamp,
      ...(event.type === 'run.failed' ? { error: event.data.error } : {}),
    }
  } else if (!existingRun) {
    return diagnostic(next, event, 'invalid_transition', 'Run must start before receiving child events')
  } else if (event.type === 'run.status.changed') {
    next.runs[event.runId] = { ...existingRun, status: event.data.status }
  } else if (event.type === 'status.delta') {
    const current = next.activities[event.data.activityId]
    if (current && (current.runId !== event.runId || current.kind !== 'status' || current.status !== 'running')) {
      return diagnostic(next, event, 'invalid_transition', `Activity ${event.data.activityId} cannot accept status delta`)
    }
    next.activities[event.data.activityId] = current
      ? { ...current, text: `${current.text ?? ''}${event.data.content}` }
      : { id: event.data.activityId, runId: event.runId, kind: 'status', status: 'running', order: existingRun.activityIds.length, text: event.data.content, startedAt: event.timestamp }
    if (!current) next.runs[event.runId] = { ...existingRun, activityIds: [...existingRun.activityIds, event.data.activityId] }
  } else if (event.type === 'activity.started') {
    if (next.activities[event.data.activityId]) return diagnostic(next, event, 'invalid_transition', `Activity ${event.data.activityId} has already started`)
    next.activities[event.data.activityId] = {
      id: event.data.activityId,
      runId: event.runId,
      kind: event.data.kind,
      status: 'running',
      order: existingRun.activityIds.length,
      startedAt: event.timestamp,
      ...(event.data.title ? { text: event.data.title } : {}),
      ...(event.data.parentActivityId ? { parentId: event.data.parentActivityId } : {}),
    }
    next.runs[event.runId] = { ...existingRun, activityIds: [...existingRun.activityIds, event.data.activityId] }
  } else if (event.type === 'activity.completed') {
    const activity = next.activities[event.data.activityId]
    if (!activity || activity.runId !== event.runId || activity.status !== 'running') return diagnostic(next, event, 'invalid_transition', `Activity ${event.data.activityId} is not running in this run`)
    next.activities[activity.id] = { ...activity, status: 'completed', endedAt: event.timestamp }
  } else if (event.type === 'tool.started') {
    if (next.toolCalls[event.data.toolCallId]) return diagnostic(next, event, 'invalid_transition', `Tool call ${event.data.toolCallId} has already started`)
    if (next.activities[event.data.activityId]) return diagnostic(next, event, 'invalid_transition', `Activity ${event.data.activityId} has already started`)
    next.toolCalls[event.data.toolCallId] = { id: event.data.toolCallId, runId: event.runId, activityId: event.data.activityId, name: event.data.name, status: 'running', startedAt: event.timestamp, ...(event.data.input === undefined ? {} : { input: event.data.input }) }
    next.activities[event.data.activityId] = { id: event.data.activityId, runId: event.runId, kind: 'tool', status: 'running', order: existingRun.activityIds.length, toolCallId: event.data.toolCallId, startedAt: event.timestamp, ...(event.data.parentActivityId ? { parentId: event.data.parentActivityId } : {}) }
    next.activityByToolCallId[event.data.toolCallId] = event.data.activityId
    next.runs[event.runId] = { ...existingRun, activityIds: [...existingRun.activityIds, event.data.activityId] }
  } else if (event.type === 'tool.args.delta') {
    const tool = next.toolCalls[event.data.toolCallId]
    if (!tool || tool.runId !== event.runId || tool.status !== 'running') return diagnostic(next, event, 'invalid_transition', `Tool call ${event.data.toolCallId} is not running in this run`)
    next.toolCalls[tool.id] = { ...tool, inputText: `${tool.inputText ?? ''}${event.data.delta}` }
  } else if (event.type === 'tool.completed' || event.type === 'tool.failed') {
    const tool = next.toolCalls[event.data.toolCallId]
    if (!tool || tool.runId !== event.runId || tool.status !== 'running') return diagnostic(next, event, 'invalid_transition', `Tool call ${event.data.toolCallId} is not running in this run`)
    next.toolCalls[tool.id] = event.type === 'tool.completed'
      ? { ...tool, status: 'completed', output: event.data.output, endedAt: event.timestamp }
      : { ...tool, status: 'failed', error: event.data.error, endedAt: event.timestamp }
    const activityId = next.activityByToolCallId[tool.id] ?? tool.activityId
    const activity = next.activities[activityId]
    if (activity) next.activities[activity.id] = { ...activity, status: event.type === 'tool.completed' ? 'completed' : 'failed', endedAt: event.timestamp }
  } else if (event.type === 'result.available') {
    next.results[event.runId] = { kind: event.data.kind, value: event.data.result }
  } else if (event.type === 'result.delta') {
    const current = next.results[event.runId]
    next.results[event.runId] = { kind: 'text', value: `${current?.kind === 'text' && typeof current.value === 'string' ? current.value : ''}${event.data.delta}` }
  } else if (event.type === 'intervention.requested') {
    if (next.interventions[event.data.interventionId]) return diagnostic(next, event, 'invalid_transition', `Intervention ${event.data.interventionId} already exists`)
    next.interventions[event.data.interventionId] = {
      id: event.data.interventionId,
      runId: event.runId,
      kind: event.data.kind,
      status: 'pending',
      prompt: event.data.prompt,
      ...(event.data.activityId ? { activityId: event.data.activityId } : {}),
    }
  } else if (event.type === 'intervention.resolved') {
    const intervention = next.interventions[event.data.interventionId]
    if (!intervention || intervention.runId !== event.runId || intervention.status !== 'pending') return diagnostic(next, event, 'invalid_transition', `Intervention ${event.data.interventionId} is not pending in this run`)
    next.interventions[intervention.id] = { ...intervention, status: 'resolved', response: event.data.response }
  } else if (event.type === 'source.observed') {
    // A sequenced source event outside the current canonical slice still advances the cursor.
  } else {
    const status: RunStatus = event.type === 'run.completed' ? 'completed' : event.type === 'run.failed' ? 'failed' : 'cancelled'
    next.runs[event.runId] = { ...existingRun, status, endedAt: event.timestamp, ...(event.type === 'run.failed' ? { error: event.data.error } : {}) }
    if (status === 'failed' || status === 'cancelled') {
      for (const activityId of existingRun.activityIds) {
        const activity = next.activities[activityId]
        if (activity?.status === 'running') next.activities[activityId] = { ...activity, status, endedAt: event.timestamp }
      }
      for (const tool of Object.values(next.toolCalls)) {
        if (tool.runId === event.runId && tool.status === 'running') {
          next.toolCalls[tool.id] = { ...tool, status, endedAt: event.timestamp, ...(status === 'failed' && event.type === 'run.failed' ? { error: event.data.error } : {}) }
        }
      }
    }
  }
  const resultingRun = next.runs[event.runId]
  const resultingCursor = next.streams[event.runId]
  if (resultingRun && terminalStatuses.has(resultingRun.status) && resultingCursor && Object.keys(resultingCursor.seenEventIds).length > 0) {
    next.streams[event.runId] = {
      ...resultingCursor,
      compactedThroughSequence: resultingCursor.lastSequence,
      seenEventIds: {},
    }
  }
  return next
}

export function replayEvents(events: readonly CanonicalEvent[], initialState: AgenticState): AgenticState {
  return events.reduce(reduceEvent, initialState)
}

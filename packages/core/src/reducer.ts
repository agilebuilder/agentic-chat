import type { CanonicalEvent } from './events.js'
import type { AgenticState, Diagnostic, RunStatus, StreamCursor } from './model.js'

const terminalStatuses = new Set<RunStatus>(['completed', 'failed', 'cancelled'])

function diagnostic(state: AgenticState, event: CanonicalEvent, code: Diagnostic['code'], message: string): AgenticState {
  return { ...state, diagnostics: [...state.diagnostics, { code, message, eventId: event.eventId, runId: event.runId }] }
}

function cursorFor(state: AgenticState, runId: string): StreamCursor {
  return state.streams[runId] ?? { scope: 'run', lastSequence: 0, seenEventIds: {}, blocked: false }
}

export function reduceEvent(state: AgenticState, event: CanonicalEvent): AgenticState {
  let cursor = cursorFor(state, event.runId)
  if (cursor.seenEventIds[event.eventId]) return state
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
    results: { ...state.results },
    interventions: { ...state.interventions },
    streams: {
      ...state.streams,
      [event.runId]: {
        ...cursor,
        lastSequence: event.sequence,
        seenEventIds: { ...cursor.seenEventIds, [event.eventId]: true },
      },
    },
  }

  if (event.type === 'run.started') {
    next.runs[event.runId] = { id: event.runId, threadId: event.threadId, status: 'running', activityIds: [], createdAt: event.timestamp, startedAt: event.timestamp }
  } else if (!existingRun) {
    return diagnostic(next, event, 'invalid_transition', 'Run must start before receiving child events')
  } else if (event.type === 'status.delta') {
    const current = next.activities[event.data.activityId]
    next.activities[event.data.activityId] = current
      ? { ...current, text: `${current.text ?? ''}${event.data.content}` }
      : { id: event.data.activityId, runId: event.runId, kind: 'status', status: 'running', order: existingRun.activityIds.length, text: event.data.content, startedAt: event.timestamp }
    if (!current) next.runs[event.runId] = { ...existingRun, activityIds: [...existingRun.activityIds, event.data.activityId] }
  } else if (event.type === 'activity.started') {
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
    if (!activity) return diagnostic(next, event, 'invalid_transition', `Unknown activity ${event.data.activityId}`)
    next.activities[activity.id] = { ...activity, status: 'completed', endedAt: event.timestamp }
  } else if (event.type === 'tool.started') {
    next.toolCalls[event.data.toolCallId] = { id: event.data.toolCallId, runId: event.runId, name: event.data.name, status: 'running', input: event.data.input, startedAt: event.timestamp }
    next.activities[event.data.activityId] = { id: event.data.activityId, runId: event.runId, kind: 'tool', status: 'running', order: existingRun.activityIds.length, toolCallId: event.data.toolCallId, startedAt: event.timestamp, ...(event.data.parentActivityId ? { parentId: event.data.parentActivityId } : {}) }
    next.runs[event.runId] = { ...existingRun, activityIds: [...existingRun.activityIds, event.data.activityId] }
  } else if (event.type === 'tool.args.delta') {
    const tool = next.toolCalls[event.data.toolCallId]
    if (!tool) return diagnostic(next, event, 'invalid_transition', `Unknown tool call ${event.data.toolCallId}`)
    next.toolCalls[tool.id] = { ...tool, inputText: `${tool.inputText ?? ''}${event.data.delta}` }
  } else if (event.type === 'tool.completed' || event.type === 'tool.failed') {
    const tool = next.toolCalls[event.data.toolCallId]
    if (!tool) return diagnostic(next, event, 'invalid_transition', `Unknown tool call ${event.data.toolCallId}`)
    next.toolCalls[tool.id] = event.type === 'tool.completed'
      ? { ...tool, status: 'completed', output: event.data.output, endedAt: event.timestamp }
      : { ...tool, status: 'failed', error: event.data.error, endedAt: event.timestamp }
    const activity = Object.values(next.activities).find((item) => item.toolCallId === tool.id)
    if (activity) next.activities[activity.id] = { ...activity, status: event.type === 'tool.completed' ? 'completed' : 'failed', endedAt: event.timestamp }
  } else if (event.type === 'result.available') {
    next.results[event.runId] = event.data.result
  } else if (event.type === 'result.delta') {
    next.results[event.runId] = `${typeof next.results[event.runId] === 'string' ? next.results[event.runId] : ''}${event.data.delta}`
  } else if (event.type === 'intervention.requested') {
    next.interventions[event.data.interventionId] = {
      id: event.data.interventionId,
      runId: event.runId,
      kind: event.data.kind,
      status: 'pending',
      prompt: event.data.prompt,
      ...(event.data.activityId ? { activityId: event.data.activityId } : {}),
    }
    next.runs[event.runId] = { ...existingRun, status: 'awaiting_input' }
  } else if (event.type === 'intervention.resolved') {
    const intervention = next.interventions[event.data.interventionId]
    if (!intervention || intervention.status !== 'pending') return diagnostic(next, event, 'invalid_transition', `Intervention ${event.data.interventionId} is not pending`)
    next.interventions[intervention.id] = { ...intervention, status: 'resolved', response: event.data.response }
    next.runs[event.runId] = { ...existingRun, status: 'running' }
  } else if (event.type === 'source.observed') {
    // A sequenced source event outside the current canonical slice still advances the cursor.
  } else {
    const status: RunStatus = event.type === 'run.completed' ? 'completed' : event.type === 'run.failed' ? 'failed' : 'cancelled'
    next.runs[event.runId] = { ...existingRun, status, endedAt: event.timestamp, ...(event.type === 'run.failed' ? { error: event.data.error } : {}) }
  }
  return next
}

export function replayEvents(events: readonly CanonicalEvent[], initialState: AgenticState): AgenticState {
  return events.reduce(reduceEvent, initialState)
}

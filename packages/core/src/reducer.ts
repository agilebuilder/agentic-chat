import type { CanonicalEvent } from './events.js'
import type { AgenticState, Diagnostic, RunStatus, StreamCursor } from './model.js'

const terminalStatuses = new Set<RunStatus>(['completed', 'failed', 'cancelled'])
const maxRetainedDiagnostics = 200
export const MAX_RETAINED_EVENT_IDS_PER_RUN = 256

function indexActivity(state: AgenticState, runId: string, activityId: string, parentActivityId?: string): void {
  if (parentActivityId) {
    state.childActivityIdsByParentId = {
      ...state.childActivityIdsByParentId,
      [parentActivityId]: [...(state.childActivityIdsByParentId[parentActivityId] ?? []), activityId],
    }
  } else {
    state.rootActivityIdsByRunId = {
      ...state.rootActivityIdsByRunId,
      [runId]: [...(state.rootActivityIdsByRunId[runId] ?? []), activityId],
    }
  }
}

function taskParentCreatesCycle(tasks: AgenticState['tasks'], runId: string, taskId: string, parentId: string | undefined): boolean {
  const visited = new Set([taskId])
  let currentId = parentId
  while (currentId) {
    if (visited.has(currentId)) return true
    visited.add(currentId)
    const current = tasks[currentId]
    if (!current || current.runId !== runId) return false
    currentId = current.parentId
  }
  return false
}

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
    tasks: state.tasks,
    taskRevisionByRunId: state.taskRevisionByRunId,
    streams: {
      ...state.streams,
      [event.runId]: {
        ...advanceCursor(cursor, event),
      },
    },
  }

  if (event.type === 'run.started') {
    const retryOfRunId = event.data.retryOfRunId
    const predecessor = retryOfRunId ? state.runs[retryOfRunId] : undefined
    const attempt = event.data.attempt ?? (retryOfRunId ? (predecessor?.attempt ?? 1) + 1 : 1)
    if (!Number.isSafeInteger(attempt) || attempt < 1) return diagnostic(next, event, 'invalid_transition', `Run attempt ${attempt} is invalid`)
    if (retryOfRunId === event.runId) return diagnostic(next, event, 'invalid_transition', 'A Run cannot retry itself')
    if (!retryOfRunId && attempt !== 1) return diagnostic(next, event, 'invalid_transition', 'An initial Run must use attempt 1')
    if (retryOfRunId && attempt < 2) return diagnostic(next, event, 'invalid_transition', 'A retry Run must use attempt 2 or greater')
    if (predecessor && (predecessor.threadId !== event.threadId || !terminalStatuses.has(predecessor.status) || attempt !== predecessor.attempt + 1)) {
      return diagnostic(next, event, 'invalid_transition', `Retry predecessor ${retryOfRunId} is incompatible with attempt ${attempt}`)
    }
    if (existingRun?.status === 'queued') {
      if (existingRun.attempt !== attempt || existingRun.retryOfRunId !== retryOfRunId) return diagnostic(next, event, 'invalid_transition', 'Queued Run retry metadata does not match run.started')
      next.runs[event.runId] = { ...existingRun, status: 'running', startedAt: event.timestamp }
    }
    else if (existingRun) return diagnostic(next, event, 'invalid_transition', `Run ${event.runId} has already started`)
    else next.runs[event.runId] = { id: event.runId, threadId: event.threadId, status: 'running', attempt, ...(retryOfRunId ? { retryOfRunId } : {}), activityIds: [], createdAt: event.timestamp, startedAt: event.timestamp }
  } else if (!existingRun && (event.type === 'run.cancelled' || event.type === 'run.failed')) {
    next.runs[event.runId] = {
      id: event.runId,
      threadId: event.threadId,
      status: event.type === 'run.cancelled' ? 'cancelled' : 'failed',
      attempt: 1,
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
    if (!current) indexActivity(next, event.runId, event.data.activityId)
  } else if (event.type === 'activity.started') {
    if (next.activities[event.data.activityId]) return diagnostic(next, event, 'invalid_transition', `Activity ${event.data.activityId} has already started`)
    const parent = event.data.parentActivityId ? next.activities[event.data.parentActivityId] : undefined
    if (event.data.parentActivityId && (!parent || parent.runId !== event.runId || parent.status !== 'running')) return diagnostic(next, event, 'invalid_transition', `Parent activity ${event.data.parentActivityId} is not running in this run`)
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
    indexActivity(next, event.runId, event.data.activityId, event.data.parentActivityId)
  } else if (event.type === 'activity.completed') {
    const activity = next.activities[event.data.activityId]
    if (!activity || activity.runId !== event.runId || activity.status !== 'running') return diagnostic(next, event, 'invalid_transition', `Activity ${event.data.activityId} is not running in this run`)
    next.activities[activity.id] = { ...activity, status: 'completed', endedAt: event.timestamp }
  } else if (event.type === 'tool.started') {
    if (next.toolCalls[event.data.toolCallId]) return diagnostic(next, event, 'invalid_transition', `Tool call ${event.data.toolCallId} has already started`)
    if (next.activities[event.data.activityId]) return diagnostic(next, event, 'invalid_transition', `Activity ${event.data.activityId} has already started`)
    const parent = event.data.parentActivityId ? next.activities[event.data.parentActivityId] : undefined
    if (event.data.parentActivityId && (!parent || parent.runId !== event.runId || parent.status !== 'running')) return diagnostic(next, event, 'invalid_transition', `Parent activity ${event.data.parentActivityId} is not running in this run`)
    next.toolCalls[event.data.toolCallId] = { id: event.data.toolCallId, runId: event.runId, activityId: event.data.activityId, name: event.data.name, status: 'running', startedAt: event.timestamp, ...(event.data.input === undefined ? {} : { input: event.data.input }) }
    next.activities[event.data.activityId] = { id: event.data.activityId, runId: event.runId, kind: 'tool', status: 'running', order: existingRun.activityIds.length, toolCallId: event.data.toolCallId, startedAt: event.timestamp, ...(event.data.parentActivityId ? { parentId: event.data.parentActivityId } : {}) }
    next.activityByToolCallId[event.data.toolCallId] = event.data.activityId
    next.runs[event.runId] = { ...existingRun, activityIds: [...existingRun.activityIds, event.data.activityId] }
    indexActivity(next, event.runId, event.data.activityId, event.data.parentActivityId)
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
  } else if (event.type === 'tasks.snapshot') {
    next.tasks = { ...state.tasks }
    next.taskRevisionByRunId = { ...state.taskRevisionByRunId }
    const currentRevision = next.taskRevisionByRunId[event.runId] ?? 0
    if (!Number.isSafeInteger(event.data.revision) || event.data.revision <= currentRevision) {
      return diagnostic(next, event, 'revision_conflict', `Task snapshot revision ${event.data.revision} must be greater than ${currentRevision}`)
    }
    const taskIds = new Set<string>()
    for (const task of event.data.tasks) {
      if (!task.id || taskIds.has(task.id)) return diagnostic(next, event, 'invalid_transition', `Task snapshot contains duplicate or empty task ID ${task.id}`)
      const existingTaskWithId = next.tasks[task.id]
      if (existingTaskWithId && existingTaskWithId.runId !== event.runId) return diagnostic(next, event, 'invalid_transition', `Task ${task.id} belongs to another run`)
      taskIds.add(task.id)
    }
    for (const task of event.data.tasks) {
      if (task.parentId && !taskIds.has(task.parentId)) return diagnostic(next, event, 'invalid_transition', `Task ${task.id} references missing parent ${task.parentId}`)
    }
    const snapshotTasks = Object.fromEntries(event.data.tasks.map((task) => [task.id, { ...task, runId: event.runId }]))
    for (const task of event.data.tasks) {
      if (taskParentCreatesCycle(snapshotTasks, event.runId, task.id, task.parentId)) return diagnostic(next, event, 'invalid_transition', `Task ${task.id} creates a parent cycle`)
    }
    for (const task of Object.values(next.tasks)) {
      if (task.runId === event.runId) delete next.tasks[task.id]
    }
    for (const task of event.data.tasks) next.tasks[task.id] = { ...task, runId: event.runId }
    next.taskRevisionByRunId[event.runId] = event.data.revision
  } else if (event.type === 'task.patched') {
    next.tasks = { ...state.tasks }
    next.taskRevisionByRunId = { ...state.taskRevisionByRunId }
    const currentRevision = next.taskRevisionByRunId[event.runId] ?? 0
    if (event.data.baseRevision !== currentRevision || event.data.revision !== currentRevision + 1) {
      return diagnostic(next, event, 'revision_conflict', `Task patch expected base ${currentRevision} and revision ${currentRevision + 1}`)
    }
    const existingTask = next.tasks[event.data.taskId]
    if (existingTask && existingTask.runId !== event.runId) return diagnostic(next, event, 'invalid_transition', `Task ${event.data.taskId} belongs to another run`)
    const patch = event.data.patch
    if (patch.operation === 'remove') {
      if (!existingTask) return diagnostic(next, event, 'invalid_transition', `Task ${event.data.taskId} does not exist`)
      if (Object.values(next.tasks).some((task) => task.runId === event.runId && task.parentId === existingTask.id)) {
        return diagnostic(next, event, 'invalid_transition', `Task ${event.data.taskId} still has child tasks`)
      }
      delete next.tasks[event.data.taskId]
    } else if (patch.operation === 'upsert') {
      const parentId = patch.value.parentId
      if (parentId && (!next.tasks[parentId] || next.tasks[parentId]?.runId !== event.runId)) {
        return diagnostic(next, event, 'invalid_transition', `Task ${event.data.taskId} references missing parent ${parentId}`)
      }
      if (taskParentCreatesCycle(next.tasks, event.runId, event.data.taskId, parentId)) return diagnostic(next, event, 'invalid_transition', `Task ${event.data.taskId} creates a parent cycle`)
      next.tasks[event.data.taskId] = { id: event.data.taskId, runId: event.runId, ...patch.value }
    } else {
      if (!existingTask) return diagnostic(next, event, 'invalid_transition', `Task ${event.data.taskId} does not exist`)
      const { parentId, activityId, ...changes } = patch.changes
      if (parentId && (!next.tasks[parentId] || next.tasks[parentId]?.runId !== event.runId || parentId === existingTask.id)) {
        return diagnostic(next, event, 'invalid_transition', `Task ${event.data.taskId} references invalid parent ${parentId}`)
      }
      if (parentId && taskParentCreatesCycle(next.tasks, event.runId, event.data.taskId, parentId)) return diagnostic(next, event, 'invalid_transition', `Task ${event.data.taskId} creates a parent cycle`)
      const updatedTask = { ...existingTask, ...changes }
      if (parentId === null) delete updatedTask.parentId
      else if (parentId !== undefined) updatedTask.parentId = parentId
      if (activityId === null) delete updatedTask.activityId
      else if (activityId !== undefined) updatedTask.activityId = activityId
      next.tasks[event.data.taskId] = updatedTask
    }
    next.taskRevisionByRunId[event.runId] = event.data.revision
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

import type { CanonicalEvent } from './events.js'
import type { AgenticState, AgentTask, Diagnostic, RunStatus, StreamCursor, TaskStatus } from './model.js'

const terminalStatuses = new Set<RunStatus>(['completed', 'failed', 'cancelled'])
const taskStatuses = new Set<TaskStatus>(['pending', 'in_progress', 'blocked', 'completed', 'cancelled'])
const maxRetainedDiagnostics = 200
export const MAX_RETAINED_EVENT_IDS_PER_RUN = 256

function validInterventionOptions(options: readonly { value: string; label: string }[] | undefined, minimum: number): boolean {
  if (!options || options.length < minimum) return false
  return new Set(options.map((option) => option.value)).size === options.length && options.every((option) => option.value.trim() && option.label.trim())
}

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

function invalidTask(state: AgenticState, task: Pick<AgentTask, 'id' | 'runId' | 'title' | 'status' | 'activityId'>): string | undefined {
  if (typeof task.id !== 'string' || !task.id.trim()) return 'Task ID must not be empty'
  if (typeof task.title !== 'string' || !task.title.trim()) return `Task ${task.id} title must not be empty`
  if (typeof task.status !== 'string' || !taskStatuses.has(task.status)) return `Task ${task.id} has invalid status ${String(task.status)}`
  if (task.activityId !== undefined) {
    if (typeof task.activityId !== 'string' || !task.activityId.trim()) return `Task ${task.id} activityId must not be empty`
    const activity = state.activities[task.activityId]
    if (!activity || activity.runId !== task.runId) return `Task ${task.id} references invalid activity ${task.activityId}`
  }
  return undefined
}

function openChildDescription(state: AgenticState, runId: string): string | undefined {
  const activity = Object.values(state.activities).find((item) => item.runId === runId && ['pending', 'running', 'awaiting_input'].includes(item.status))
  if (activity) return `activity ${activity.id} is ${activity.status}`
  const tool = Object.values(state.toolCalls).find((item) => item.runId === runId && item.status === 'running')
  if (tool) return `tool call ${tool.id} is running`
  const intervention = Object.values(state.interventions).find((item) => item.runId === runId && item.status === 'pending')
  if (intervention) return `intervention ${intervention.id} is pending`
  const artifact = Object.values(state.artifacts).find((item) => item.runId === runId && item.status === 'generating')
  if (artifact) return `Artifact ${artifact.id} is generating`
  return undefined
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
  // Artifact availability may have an independent TTL that expires after the Run.
  if (existingRun && terminalStatuses.has(existingRun.status) && event.type !== 'artifact.expired') {
    const advancedCursor = advanceCursor(cursor, event)
    const advanced = {
      ...state,
      streams: {
        ...state.streams,
        [event.runId]: { ...advancedCursor, compactedThroughSequence: advancedCursor.lastSequence, seenEventIds: {} },
      },
    }
    return diagnostic(advanced, event, 'invalid_transition', `Run ${event.runId} is already ${existingRun.status}`)
  }

  let next: AgenticState = {
    ...state,
    runs: { ...state.runs },
    activities: { ...state.activities },
    toolCalls: { ...state.toolCalls },
    activityByToolCallId: { ...state.activityByToolCallId },
    results: { ...state.results },
    interventions: { ...state.interventions },
    artifacts: { ...state.artifacts },
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
    if (retryOfRunId && !predecessor) return diagnostic(next, event, 'invalid_transition', `Retry predecessor ${retryOfRunId} does not exist`)
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
    if (!event.data.interventionId.trim() || !event.data.prompt.trim()) return diagnostic(next, event, 'invalid_transition', 'Intervention ID and prompt must not be empty')
    const activity = event.data.activityId ? next.activities[event.data.activityId] : undefined
    if (event.data.activityId && (!activity || activity.runId !== event.runId)) return diagnostic(next, event, 'invalid_transition', `Intervention activity ${event.data.activityId} is not in this run`)
    if (event.data.expiresAt && (!Number.isFinite(Date.parse(event.data.expiresAt)) || Date.parse(event.data.expiresAt) <= Date.parse(event.timestamp))) return diagnostic(next, event, 'invalid_transition', 'Intervention expiry must be after its request timestamp')
    if (event.data.kind !== 'choice' && event.data.options) return diagnostic(next, event, 'invalid_transition', 'Only choice interventions may define options')
    if (event.data.kind !== 'form' && event.data.fields) return diagnostic(next, event, 'invalid_transition', 'Only form interventions may define fields')
    if (event.data.kind === 'choice') {
      if (!validInterventionOptions(event.data.options, 2)) return diagnostic(next, event, 'invalid_transition', 'Choice intervention requires at least two unique non-empty options')
    }
    if (event.data.kind === 'form') {
      const fields = event.data.fields ?? []
      const names = new Set(fields.map((field) => field.name))
      const invalidSelect = fields.some((field) => field.type === 'select' && !validInterventionOptions(field.options, 1))
      if (fields.length === 0 || names.size !== fields.length || fields.some((field) => !field.name.trim() || !field.label.trim()) || invalidSelect) return diagnostic(next, event, 'invalid_transition', 'Form intervention requires valid uniquely named fields')
    }
    next.interventions[event.data.interventionId] = {
      id: event.data.interventionId,
      runId: event.runId,
      kind: event.data.kind,
      status: 'pending',
      prompt: event.data.prompt,
      requestedAt: event.timestamp,
      ...(event.data.activityId ? { activityId: event.data.activityId } : {}),
      ...(event.data.description ? { description: event.data.description } : {}),
      ...(event.data.risk ? { risk: event.data.risk } : {}),
      ...(event.data.impact ? { impact: event.data.impact } : {}),
      ...(event.data.options ? { options: structuredClone(event.data.options) } : {}),
      ...(event.data.fields ? { fields: structuredClone(event.data.fields) } : {}),
      ...(event.data.expiresAt ? { expiresAt: event.data.expiresAt } : {}),
    }
  } else if (event.type === 'intervention.resolved') {
    const intervention = next.interventions[event.data.interventionId]
    if (!intervention || intervention.runId !== event.runId || intervention.status !== 'pending') return diagnostic(next, event, 'invalid_transition', `Intervention ${event.data.interventionId} is not pending in this run`)
    next.interventions[intervention.id] = { ...intervention, status: 'resolved', response: event.data.response, resolvedAt: event.timestamp }
  } else if (event.type === 'intervention.expired') {
    const intervention = next.interventions[event.data.interventionId]
    if (!intervention || intervention.runId !== event.runId || intervention.status !== 'pending') return diagnostic(next, event, 'invalid_transition', `Intervention ${event.data.interventionId} is not pending in this run`)
    next.interventions[intervention.id] = { ...intervention, status: 'expired', expiredAt: event.timestamp }
  } else if (event.type === 'artifact.created') {
    if (next.artifacts[event.data.artifactId]) return diagnostic(next, event, 'invalid_transition', `Artifact ${event.data.artifactId} already exists`)
    if (!event.data.artifactId.trim() || !event.data.name.trim() || !event.data.kind.trim()) return diagnostic(next, event, 'invalid_transition', 'Artifact ID, name and kind must not be empty')
    const predecessor = event.data.previousArtifactId ? next.artifacts[event.data.previousArtifactId] : undefined
    const version = event.data.version ?? (predecessor ? predecessor.version + 1 : 1)
    if (!Number.isSafeInteger(version) || version < 1) return diagnostic(next, event, 'invalid_transition', `Artifact version ${version} is invalid`)
    if (!event.data.previousArtifactId && version !== 1) return diagnostic(next, event, 'invalid_transition', 'An initial Artifact must use version 1')
    if (event.data.previousArtifactId === event.data.artifactId) return diagnostic(next, event, 'invalid_transition', 'An Artifact cannot version itself')
    if (event.data.previousArtifactId && (!predecessor || predecessor.runId !== event.runId || predecessor.status === 'generating' || version !== predecessor.version + 1)) return diagnostic(next, event, 'invalid_transition', `Artifact predecessor ${event.data.previousArtifactId} is incompatible with version ${version}`)
    if (predecessor && Object.values(next.artifacts).some((artifact) => artifact.previousArtifactId === predecessor.id)) return diagnostic(next, event, 'invalid_transition', `Artifact predecessor ${predecessor.id} already has a successor`)
    const provenance = event.data.provenance ?? { type: 'agent' as const }
    if (!['agent', 'tool', 'user', 'external'].includes(provenance.type) || (provenance.label !== undefined && !provenance.label.trim())) return diagnostic(next, event, 'invalid_transition', 'Artifact provenance is invalid')
    const sourceActivity = provenance.activityId ? next.activities[provenance.activityId] : undefined
    const sourceTool = provenance.toolCallId ? next.toolCalls[provenance.toolCallId] : undefined
    if (provenance.activityId && (!sourceActivity || sourceActivity.runId !== event.runId)) return diagnostic(next, event, 'invalid_transition', `Artifact source activity ${provenance.activityId} is not in this run`)
    if (provenance.toolCallId && (!sourceTool || sourceTool.runId !== event.runId)) return diagnostic(next, event, 'invalid_transition', `Artifact source tool ${provenance.toolCallId} is not in this run`)
    if (sourceActivity && sourceTool && sourceTool.activityId !== sourceActivity.id) return diagnostic(next, event, 'invalid_transition', 'Artifact source activity and tool do not match')
    if (provenance.type === 'tool' && !provenance.toolCallId) return diagnostic(next, event, 'invalid_transition', 'Tool provenance requires toolCallId')
    next.artifacts[event.data.artifactId] = { id: event.data.artifactId, runId: event.runId, name: event.data.name, kind: event.data.kind, status: 'generating', version, provenance: structuredClone(provenance), createdAt: event.timestamp, ...(event.data.previousArtifactId ? { previousArtifactId: event.data.previousArtifactId } : {}) }
  } else if (event.type === 'artifact.available') {
    const artifact = next.artifacts[event.data.artifactId]
    if (!artifact || artifact.runId !== event.runId || artifact.status !== 'generating') return diagnostic(next, event, 'invalid_transition', `Artifact ${event.data.artifactId} is not generating in this run`)
    if (event.data.sizeBytes !== undefined && (!Number.isSafeInteger(event.data.sizeBytes) || event.data.sizeBytes < 0)) return diagnostic(next, event, 'invalid_transition', `Artifact size ${event.data.sizeBytes} is invalid`)
    if (event.data.checksum && (!event.data.checksum.value.trim() || !['sha256', 'sha384', 'sha512', 'other'].includes(event.data.checksum.algorithm))) return diagnostic(next, event, 'invalid_transition', 'Artifact checksum is invalid')
    if (event.data.expiresAt && (!Number.isFinite(Date.parse(event.data.expiresAt)) || Date.parse(event.data.expiresAt) <= Date.parse(event.timestamp))) return diagnostic(next, event, 'invalid_transition', 'Artifact expiry must be after availability')
    next.artifacts[artifact.id] = { ...artifact, status: 'available', availableAt: event.timestamp, ...(event.data.uri ? { uri: event.data.uri } : {}), ...(event.data.sizeBytes !== undefined ? { sizeBytes: event.data.sizeBytes } : {}), ...(event.data.checksum ? { checksum: structuredClone(event.data.checksum) } : {}), ...(event.data.expiresAt ? { expiresAt: event.data.expiresAt } : {}) }
  } else if (event.type === 'artifact.failed') {
    const artifact = next.artifacts[event.data.artifactId]
    if (!artifact || artifact.runId !== event.runId || artifact.status !== 'generating') return diagnostic(next, event, 'invalid_transition', `Artifact ${event.data.artifactId} is not generating in this run`)
    next.artifacts[artifact.id] = { ...artifact, status: 'failed', error: event.data.error, endedAt: event.timestamp }
  } else if (event.type === 'artifact.expired') {
    const artifact = next.artifacts[event.data.artifactId]
    if (!artifact || artifact.runId !== event.runId || artifact.status !== 'available') return diagnostic(next, event, 'invalid_transition', `Artifact ${event.data.artifactId} is not available in this run`)
    next.artifacts[artifact.id] = { ...artifact, status: 'expired', endedAt: event.timestamp }
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
      const taskError = invalidTask(next, { ...task, runId: event.runId })
      if (taskError) return diagnostic(next, event, 'invalid_transition', taskError)
      taskIds.add(task.id)
    }
    for (const task of event.data.tasks) {
      if (task.parentId !== undefined && (typeof task.parentId !== 'string' || !task.parentId.trim())) return diagnostic(next, event, 'invalid_transition', `Task ${task.id} parentId must not be empty`)
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
      if (parentId !== undefined && (typeof parentId !== 'string' || !parentId.trim())) return diagnostic(next, event, 'invalid_transition', `Task ${event.data.taskId} parentId must not be empty`)
      if (parentId && (!next.tasks[parentId] || next.tasks[parentId]?.runId !== event.runId)) {
        return diagnostic(next, event, 'invalid_transition', `Task ${event.data.taskId} references missing parent ${parentId}`)
      }
      if (taskParentCreatesCycle(next.tasks, event.runId, event.data.taskId, parentId)) return diagnostic(next, event, 'invalid_transition', `Task ${event.data.taskId} creates a parent cycle`)
      const upsertedTask = { id: event.data.taskId, runId: event.runId, ...patch.value }
      const taskError = invalidTask(next, upsertedTask)
      if (taskError) return diagnostic(next, event, 'invalid_transition', taskError)
      next.tasks[event.data.taskId] = upsertedTask
    } else {
      if (!existingTask) return diagnostic(next, event, 'invalid_transition', `Task ${event.data.taskId} does not exist`)
      const { parentId, activityId, ...changes } = patch.changes
      if (parentId !== undefined && parentId !== null && (typeof parentId !== 'string' || !parentId.trim())) return diagnostic(next, event, 'invalid_transition', `Task ${event.data.taskId} parentId must not be empty`)
      if (activityId !== undefined && activityId !== null && (typeof activityId !== 'string' || !activityId.trim())) return diagnostic(next, event, 'invalid_transition', `Task ${event.data.taskId} activityId must not be empty`)
      if (parentId && (!next.tasks[parentId] || next.tasks[parentId]?.runId !== event.runId || parentId === existingTask.id)) {
        return diagnostic(next, event, 'invalid_transition', `Task ${event.data.taskId} references invalid parent ${parentId}`)
      }
      if (parentId && taskParentCreatesCycle(next.tasks, event.runId, event.data.taskId, parentId)) return diagnostic(next, event, 'invalid_transition', `Task ${event.data.taskId} creates a parent cycle`)
      const updatedTask = { ...existingTask, ...changes }
      if (parentId === null) delete updatedTask.parentId
      else if (parentId !== undefined) updatedTask.parentId = parentId
      if (activityId === null) delete updatedTask.activityId
      else if (activityId !== undefined) updatedTask.activityId = activityId
      const taskError = invalidTask(next, updatedTask)
      if (taskError) return diagnostic(next, event, 'invalid_transition', taskError)
      next.tasks[event.data.taskId] = updatedTask
    }
    next.taskRevisionByRunId[event.runId] = event.data.revision
  } else if (event.type === 'source.observed') {
    // A sequenced source event outside the current canonical slice still advances the cursor.
  } else if (event.type === 'run.completed' || event.type === 'run.failed' || event.type === 'run.cancelled') {
    const status: RunStatus = event.type === 'run.completed' ? 'completed' : event.type === 'run.failed' ? 'failed' : 'cancelled'
    const openChild = status === 'completed' ? openChildDescription(next, event.runId) : undefined
    if (openChild) return diagnostic(next, event, 'invalid_transition', `Run ${event.runId} cannot complete while ${openChild}`)
    next.runs[event.runId] = { ...existingRun, status, endedAt: event.timestamp, ...(event.type === 'run.failed' ? { error: event.data.error } : {}) }
    if (status === 'failed' || status === 'cancelled') {
      for (const activity of Object.values(next.activities)) {
        if (activity.runId === event.runId && ['pending', 'running', 'awaiting_input'].includes(activity.status)) next.activities[activity.id] = { ...activity, status, endedAt: event.timestamp }
      }
      for (const tool of Object.values(next.toolCalls)) {
        if (tool.runId === event.runId && tool.status === 'running') {
          next.toolCalls[tool.id] = { ...tool, status, endedAt: event.timestamp, ...(status === 'failed' && event.type === 'run.failed' ? { error: event.data.error } : {}) }
        }
      }
      for (const intervention of Object.values(next.interventions)) {
        if (intervention.runId === event.runId && intervention.status === 'pending') {
          next.interventions[intervention.id] = { ...intervention, status: 'expired', expiredAt: event.timestamp }
        }
      }
      for (const artifact of Object.values(next.artifacts)) {
        if (artifact.runId === event.runId && artifact.status === 'generating') {
          next.artifacts[artifact.id] = {
            ...artifact,
            status: 'failed',
            endedAt: event.timestamp,
            error: status === 'failed' && event.type === 'run.failed'
              ? event.data.error
              : { code: 'run_cancelled', message: 'Artifact generation was cancelled with its Run' },
          }
        }
      }
    }
  } else {
    const unknownType = (event as { type: string }).type
    return diagnostic(next, event, 'unknown_event', `Unknown canonical event type ${unknownType}`)
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

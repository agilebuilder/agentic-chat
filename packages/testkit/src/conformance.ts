import type { AgenticState, CanonicalEvent, RunStatus } from '@agentic-chat/core'
import { createInitialState, createSnapshot, importSnapshot, reduceEvent, replayEvents } from '@agentic-chat/core'

export type ConformanceSequenceMode = 'strict-per-run' | 'synthesized-stream-order' | 'unordered'

export interface AdapterConformanceOptions {
  expectedStatus?: Extract<RunStatus, 'completed' | 'failed' | 'cancelled'>
  sequence?: ConformanceSequenceMode
}

export interface ConformanceResult {
  state: AgenticState
  issues: string[]
}

export interface SnapshotReplayConformanceResult extends ConformanceResult {
  fullReplayState: AgenticState
}

/** Checks durable HITL replay and the single-resolution invariant. */
export function checkInterventionConformance(events: readonly CanonicalEvent[]): ConformanceResult {
  const issues: string[] = []
  const requestedIndex = events.findIndex((event) => event.type === 'intervention.requested')
  if (requestedIndex < 0) return { state: replayEvents(events, createInitialState()), issues: ['fixture must request an intervention'] }
  const snapshotResult = checkSnapshotReplayConformance(events, requestedIndex + 1)
  issues.push(...snapshotResult.issues)
  const state = snapshotResult.state
  const interventionEvents = events.filter((event) => event.type === 'intervention.requested')
  for (const requested of interventionEvents) {
    if (requested.type !== 'intervention.requested') continue
    const intervention = state.interventions[requested.data.interventionId]
    if (!intervention) issues.push(`intervention ${requested.data.interventionId} is missing after replay`)
    else if (intervention.status === 'pending') issues.push(`intervention ${requested.data.interventionId} did not reach resolved or expired`)
  }
  let terminalIndex = -1
  for (let index = events.length - 1; index >= 0; index -= 1) {
    if (events[index]?.type === 'intervention.resolved' || events[index]?.type === 'intervention.expired') { terminalIndex = index; break }
  }
  const terminal = events[terminalIndex]
  if (terminal && (terminal.type === 'intervention.resolved' || terminal.type === 'intervention.expired')) {
    const terminalState = replayEvents(events.slice(0, terminalIndex + 1), createInitialState())
    const duplicate = { ...terminal, eventId: `${terminal.eventId}:duplicate`, sequence: terminal.sequence + 1 }
    const duplicateState = reduceEvent(terminalState, duplicate)
    if (duplicateState.diagnostics.length !== terminalState.diagnostics.length + 1) issues.push('duplicate intervention terminal event was not rejected')
  }
  return { state, issues: [...new Set(issues)] }
}

/** Checks durable Artifact recovery, provenance, and completed version chains. */
export function checkArtifactConformance(events: readonly CanonicalEvent[]): ConformanceResult {
  const createdIndex = events.findIndex((event) => event.type === 'artifact.created')
  if (createdIndex < 0) return { state: replayEvents(events, createInitialState()), issues: ['fixture must create an Artifact'] }
  const snapshotResult = checkSnapshotReplayConformance(events, createdIndex + 1)
  const issues = [...snapshotResult.issues]
  for (const artifact of Object.values(snapshotResult.state.artifacts)) {
    if (artifact.status === 'generating') issues.push(`Artifact ${artifact.id} did not reach available, failed, or expired`)
    if (!Number.isSafeInteger(artifact.version) || artifact.version < 1) issues.push(`Artifact ${artifact.id} has an invalid version`)
    if (!artifact.provenance.type) issues.push(`Artifact ${artifact.id} has no provenance`)
  }
  return { state: snapshotResult.state, issues: [...new Set(issues)] }
}

/** Checks a retry chain represented as distinct, independently sequenced Run streams. */
export function checkRetryAttemptConformance(attemptStreams: readonly (readonly CanonicalEvent[])[]): ConformanceResult {
  const issues: string[] = []
  if (attemptStreams.length < 2) return { state: createInitialState(), issues: ['retry fixture must contain at least two attempt streams'] }
  const state = attemptStreams.reduce((current, stream, index) => {
    const result = checkAdapterConformance(stream)
    issues.push(...result.issues.map((issue) => `attempt ${index + 1}: ${issue}`))
    return replayEvents(stream, current)
  }, createInitialState())
  const runs = attemptStreams.map((stream) => state.runs[stream[0]?.runId ?? ''])
  runs.forEach((run, index) => {
    if (!run) issues.push(`attempt ${index + 1}: Run is missing`)
    else if (run.attempt !== index + 1) issues.push(`attempt ${index + 1}: expected attempt number ${index + 1}, received ${run.attempt}`)
    if (index > 0 && run?.retryOfRunId !== runs[index - 1]?.id) issues.push(`attempt ${index + 1}: retry predecessor is incorrect`)
  })
  if (new Set(runs.flatMap((run) => run ? [run.id] : [])).size !== runs.filter(Boolean).length) issues.push('attempt Runs must use distinct IDs')
  return { state, issues: [...new Set(issues)] }
}

/** Checks that a canonical snapshot taken after the prefix preserves suffix replay semantics. */
export function checkSnapshotReplayConformance(
  events: readonly CanonicalEvent[],
  splitIndex: number,
): SnapshotReplayConformanceResult {
  const issues: string[] = []
  if (!Number.isSafeInteger(splitIndex) || splitIndex < 1 || splitIndex >= events.length) {
    const state = createInitialState()
    return { state, fullReplayState: state, issues: ['splitIndex must leave a non-empty prefix and suffix'] }
  }
  const prefixState = replayEvents(events.slice(0, splitIndex), createInitialState())
  const fullReplayState = replayEvents(events, createInitialState())
  try {
    const restored = importSnapshot(createSnapshot(prefixState, splitIndex))
    const state = replayEvents(events.slice(splitIndex), restored)
    if (JSON.stringify(createSnapshot(state, events.length)) !== JSON.stringify(createSnapshot(fullReplayState, events.length))) {
      issues.push('snapshot plus suffix replay does not equal full event replay')
    }
    return { state, fullReplayState, issues }
  } catch (error) {
    issues.push(error instanceof Error ? error.message : String(error))
    return { state: prefixState, fullReplayState, issues }
  }
}

const terminalEventTypes = new Set<CanonicalEvent['type']>(['run.completed', 'run.failed', 'run.cancelled'])

/**
 * Checks the source-independent invariants every adapter fixture must satisfy.
 * It deliberately consumes canonical events so adapters can keep their source
 * event and transport types private.
 */
export function checkAdapterConformance(
  events: readonly CanonicalEvent[],
  options: AdapterConformanceOptions = {},
): ConformanceResult {
  const issues: string[] = []
  if (events.length === 0) return { state: createInitialState(), issues: ['fixture is empty'] }

  const first = events[0]!
  if (!['run.started', 'run.failed', 'run.cancelled'].includes(first.type)) {
    issues.push('first event must establish or terminate a run')
  }

  if (new Set(events.map((event) => event.runId)).size !== 1) issues.push('fixture must contain exactly one run')
  if (new Set(events.map((event) => event.threadId)).size !== 1) issues.push('fixture must contain exactly one thread')
  if (new Set(events.map((event) => event.eventId)).size !== events.length) issues.push('event IDs must be unique')
  if (events.some((event) => !event.source)) issues.push('every adapted event must identify its source')

  const sequenceMode = options.sequence ?? 'strict-per-run'
  if (sequenceMode !== 'unordered') {
    events.forEach((event, index) => {
      if (event.sequence !== index + 1) issues.push(`sequence must be contiguous: expected ${index + 1}, received ${event.sequence}`)
    })
  }

  const terminalIndexes = events.flatMap((event, index) => terminalEventTypes.has(event.type) ? [index] : [])
  if (terminalIndexes.length !== 1) issues.push('fixture must contain exactly one terminal run event')
  else if (terminalIndexes[0] !== events.length - 1) issues.push('terminal run event must be last')

  const state = replayEvents(events, createInitialState())
  const run = state.runs[first.runId]
  if (!run || !['completed', 'failed', 'cancelled'].includes(run.status)) issues.push('fixture must reach a terminal run status')
  if (options.expectedStatus && run?.status !== options.expectedStatus) {
    issues.push(`run status must be ${options.expectedStatus}, received ${run?.status ?? 'missing'}`)
  }
  if (Object.values(state.streams).some((stream) => stream.blocked)) issues.push('fixture contains a sequence gap')
  if (state.diagnostics.length > 0) issues.push(`canonical replay produced ${state.diagnostics.length} diagnostic(s)`)
  for (const tool of Object.values(state.toolCalls)) {
    if (tool.status === 'running') issues.push(`tool call ${tool.id} did not reach a terminal status`)
    if (!state.activities[tool.activityId]) issues.push(`tool call ${tool.id} does not reference an activity`)
  }

  const replayedAgain = replayEvents(events, state)
  if (JSON.stringify(replayedAgain) !== JSON.stringify(state)) issues.push('replaying the same events is not idempotent')
  return { state, issues: [...new Set(issues)] }
}

/** @deprecated Use checkAdapterConformance for new adapter fixtures. */
export function checkRunConformance(events: readonly CanonicalEvent[]): ConformanceResult {
  return checkAdapterConformance(events)
}

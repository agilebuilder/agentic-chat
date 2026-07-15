import type { AgenticState, CanonicalEvent, RunStatus } from '@agentic-chat/core'
import { createInitialState, replayEvents } from '@agentic-chat/core'

export type ConformanceSequenceMode = 'strict-per-run' | 'synthesized-stream-order' | 'unordered'

export interface AdapterConformanceOptions {
  expectedStatus?: Extract<RunStatus, 'completed' | 'failed' | 'cancelled'>
  sequence?: ConformanceSequenceMode
}

export interface ConformanceResult {
  state: AgenticState
  issues: string[]
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

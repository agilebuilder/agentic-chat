import type { AgenticState, CanonicalEvent } from '@agentic-chat/core'
import { createInitialState, replayEvents } from '@agentic-chat/core'

export interface ConformanceResult {
  state: AgenticState
  issues: string[]
}

export function checkRunConformance(events: readonly CanonicalEvent[]): ConformanceResult {
  const issues: string[] = []
  if (events.length === 0) return { state: createInitialState(), issues: ['fixture is empty'] }
  if (events[0]?.type !== 'run.started') issues.push('first event must be run.started')
  const runIds = new Set(events.map((event) => event.runId))
  if (runIds.size !== 1) issues.push('fixture must contain exactly one run')
  const state = replayEvents(events, createInitialState())
  const run = state.runs[events[0]!.runId]
  if (!run || !['completed', 'failed', 'cancelled'].includes(run.status)) issues.push('fixture must reach a terminal run status')
  if (Object.values(state.streams).some((stream) => stream.blocked)) issues.push('fixture contains a sequence gap')
  return { state, issues }
}

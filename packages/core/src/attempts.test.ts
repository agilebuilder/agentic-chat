import { describe, expect, it } from 'vitest'
import type { CanonicalEvent } from './events.js'
import { createInitialState } from './model.js'
import { replayEvents } from './reducer.js'

const event = (runId: string, sequence: number, type: CanonicalEvent['type'], data: CanonicalEvent['data']): CanonicalEvent => ({
  schemaVersion: '0.1',
  eventId: `${runId}:${sequence}`,
  threadId: 'thread-1',
  runId,
  sequence,
  timestamp: `2026-07-15T02:00:0${sequence}.000Z`,
  source: 'attempt-fixture',
  type,
  data,
} as CanonicalEvent)

describe('run attempts', () => {
  it('creates retry as a new Run and preserves terminal history', () => {
    const events = [
      event('run-1', 1, 'run.started', {}),
      event('run-1', 2, 'run.failed', { error: { code: 'timeout', message: 'Timed out' } }),
      event('run-2', 1, 'run.started', { attempt: 2, retryOfRunId: 'run-1' }),
      event('run-2', 2, 'run.completed', {}),
    ]
    const state = replayEvents(events, createInitialState())
    expect(state.runs['run-1']).toMatchObject({ status: 'failed', attempt: 1 })
    expect(state.runs['run-2']).toMatchObject({ status: 'completed', attempt: 2, retryOfRunId: 'run-1' })
    expect(state.diagnostics).toEqual([])
  })

  it('rejects skipped attempts and retrying a non-terminal predecessor', () => {
    const state = replayEvents([
      event('run-1', 1, 'run.started', {}),
      event('run-2', 1, 'run.started', { attempt: 2, retryOfRunId: 'run-1' }),
      event('run-3', 1, 'run.started', { attempt: 3, retryOfRunId: 'run-1' }),
    ], createInitialState())
    expect(state.runs['run-2']).toBeUndefined()
    expect(state.runs['run-3']).toBeUndefined()
    expect(state.diagnostics.map((item) => item.code)).toEqual(['invalid_transition', 'invalid_transition'])
  })

  it('rejects an initial Run that claims a later attempt', () => {
    const state = replayEvents([event('run-1', 1, 'run.started', { attempt: 2 })], createInitialState())
    expect(state.runs['run-1']).toBeUndefined()
    expect(state.diagnostics.at(-1)?.message).toContain('attempt 1')
  })

  it('rejects child activities whose parent is missing or already terminal', () => {
    const state = replayEvents([
      event('run-1', 1, 'run.started', {}),
      event('run-1', 2, 'activity.started', { activityId: 'missing-child', kind: 'workflow', parentActivityId: 'missing' }),
      event('run-1', 3, 'activity.started', { activityId: 'parent', kind: 'subagent' }),
      event('run-1', 4, 'activity.completed', { activityId: 'parent' }),
      event('run-1', 5, 'activity.started', { activityId: 'late-child', kind: 'workflow', parentActivityId: 'parent' }),
    ], createInitialState())
    expect(state.activities['missing-child']).toBeUndefined()
    expect(state.activities['late-child']).toBeUndefined()
    expect(state.rootActivityIdsByRunId['run-1']).toEqual(['parent'])
    expect(state.diagnostics.map((item) => item.code)).toEqual(['invalid_transition', 'invalid_transition'])
  })
})

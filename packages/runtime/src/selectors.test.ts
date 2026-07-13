import { createInitialState, replayEvents, type CanonicalEvent } from '@agentic-chat/core'
import { describe, expect, it } from 'vitest'
import { selectLatestRunId, selectRunActivities, selectRunNeedsAttention } from './selectors.js'

const events: CanonicalEvent[] = [
  { schemaVersion: '0.1', eventId: 's1', type: 'run.started', threadId: 'thread-1', runId: 'run-1', sequence: 1, timestamp: '2026-07-13T00:00:00Z', data: {} },
  { schemaVersion: '0.1', eventId: 's2', type: 'activity.started', threadId: 'thread-1', runId: 'run-1', sequence: 2, timestamp: '2026-07-13T00:00:01Z', data: { activityId: 'a1', kind: 'workflow', title: '分析' } },
  { schemaVersion: '0.1', eventId: 's3', type: 'run.status.changed', threadId: 'thread-1', runId: 'run-1', sequence: 3, timestamp: '2026-07-13T00:00:02Z', data: { status: 'awaiting_input' } },
]

describe('runtime selectors', () => {
  const state = replayEvents(events, createInitialState())
  it('selects stable activity order', () => expect(selectRunActivities(state, 'run-1').map((item) => item.id)).toEqual(['a1']))
  it('selects latest run and attention state', () => {
    expect(selectLatestRunId(state, 'thread-1')).toBe('run-1')
    expect(selectRunNeedsAttention(state, 'run-1')).toBe(true)
  })
})

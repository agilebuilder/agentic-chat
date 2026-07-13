import { describe, expect, it } from 'vitest'
import type { CanonicalEvent } from './events.js'
import { createInitialState } from './model.js'
import { replayEvents } from './reducer.js'
import { createSnapshot, importSnapshot } from './snapshot.js'

const events: CanonicalEvent[] = [
  { schemaVersion: '0.1', eventId: 'e1', type: 'run.started', threadId: 't1', runId: 'r1', sequence: 1, timestamp: '2026-07-13T00:00:00Z', data: {} },
  { schemaVersion: '0.1', eventId: 'e2', type: 'tool.started', threadId: 't1', runId: 'r1', sequence: 2, timestamp: '2026-07-13T00:00:01Z', data: { activityId: 'a1', toolCallId: 'c1', name: 'search' } },
  { schemaVersion: '0.1', eventId: 'e3', type: 'tool.completed', threadId: 't1', runId: 'r1', sequence: 3, timestamp: '2026-07-13T00:00:02Z', data: { toolCallId: 'c1' } },
  { schemaVersion: '0.1', eventId: 'e4', type: 'run.completed', threadId: 't1', runId: 'r1', sequence: 4, timestamp: '2026-07-13T00:00:03Z', data: {} },
]

describe('canonical snapshot', () => {
  it('makes snapshot plus delta equivalent to a full replay', () => {
    const beforeSnapshot = replayEvents(events.slice(0, 2), createInitialState())
    const restored = importSnapshot(createSnapshot(beforeSnapshot, 3))
    const fromSnapshot = replayEvents(events.slice(2), restored)
    const fullReplay = replayEvents(events, createInitialState())
    expect(fromSnapshot).toEqual(fullReplay)
  })

  it('does not expose mutable store references', () => {
    const state = replayEvents(events.slice(0, 1), createInitialState())
    const restored = importSnapshot(createSnapshot(state, 1))
    restored.runs.r1!.status = 'failed'
    expect(state.runs.r1?.status).toBe('running')
  })
})

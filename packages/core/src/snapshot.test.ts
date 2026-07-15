import { describe, expect, it } from 'vitest'
import type { CanonicalEvent } from './events.js'
import { createInitialState } from './model.js'
import { replayEvents } from './reducer.js'
import { createSnapshot, importSnapshot, type LegacyCanonicalSnapshot } from './snapshot.js'

const events: CanonicalEvent[] = [
  { schemaVersion: '0.1', eventId: 'e1', type: 'run.started', threadId: 't1', runId: 'r1', sequence: 1, timestamp: '2026-07-13T00:00:00Z', data: {}, source: 'fixture' },
  { schemaVersion: '0.1', eventId: 'e2', type: 'tasks.snapshot', threadId: 't1', runId: 'r1', sequence: 2, timestamp: '2026-07-13T00:00:01Z', data: { revision: 1, tasks: [{ id: 'task-1', title: 'Research', status: 'in_progress' }] }, source: 'fixture' },
  { schemaVersion: '0.1', eventId: 'e3', type: 'task.patched', threadId: 't1', runId: 'r1', sequence: 3, timestamp: '2026-07-13T00:00:02Z', data: { baseRevision: 1, revision: 2, taskId: 'task-1', patch: { operation: 'update', changes: { status: 'completed' } } }, source: 'fixture' },
  { schemaVersion: '0.1', eventId: 'e4', type: 'run.completed', threadId: 't1', runId: 'r1', sequence: 4, timestamp: '2026-07-13T00:00:03Z', data: {}, source: 'fixture' },
]

describe('canonical snapshot', () => {
  it('makes snapshot plus delta equivalent to a full replay', () => {
    const beforeSnapshot = replayEvents(events.slice(0, 2), createInitialState())
    const wireSnapshot = createSnapshot(beforeSnapshot, 7)
    const fromSnapshot = replayEvents(events.slice(2), importSnapshot(wireSnapshot))
    const fullReplay = replayEvents(events, createInitialState())
    expect(createSnapshot(fromSnapshot, 8)).toEqual(createSnapshot(fullReplay, 8))
    expect(fromSnapshot.tasks['task-1']?.status).toBe('completed')
    expect(fromSnapshot.taskRevisionByRunId.r1).toBe(2)
  })

  it('uses an explicit wire schema instead of persisting internal store state', () => {
    const state = replayEvents(events.slice(0, 2), createInitialState())
    state.diagnostics.push({ code: 'unknown_event', message: 'ephemeral', eventId: 'x', runId: 'r1' })
    const snapshot = createSnapshot(state, 7)
    expect(snapshot.schemaVersion).toBe('0.2')
    expect(snapshot).not.toHaveProperty('state')
    expect(snapshot.entities.tasks).toEqual([{ id: 'task-1', runId: 'r1', title: 'Research', status: 'in_progress' }])
    expect(snapshot.streams).toEqual([{ runId: 'r1', lastSequence: 2 }])
    expect(JSON.stringify(snapshot)).not.toContain('seenEventIds')
    expect(JSON.stringify(snapshot)).not.toContain('ephemeral')
  })

  it('does not expose mutable store references', () => {
    const state = replayEvents(events.slice(0, 2), createInitialState())
    const restored = importSnapshot(createSnapshot(state, 1))
    restored.runs.r1!.status = 'failed'
    restored.tasks['task-1']!.title = 'Changed'
    expect(state.runs.r1?.status).toBe('running')
    expect(state.tasks['task-1']?.title).toBe('Research')
  })

  it('rejects blocked streams and invalid entity references', () => {
    const blocked = replayEvents([events[0]!, { ...events[1]!, sequence: 3 }], createInitialState())
    expect(() => createSnapshot(blocked, 1)).toThrow('blocked stream')

    const snapshot = createSnapshot(replayEvents(events.slice(0, 2), createInitialState()), 1)
    snapshot.entities.runs[0]!.activityIds = ['missing']
    expect(() => importSnapshot(snapshot)).toThrow('references missing activity')
  })

  it('imports legacy 0.1 snapshots for alpha migration', () => {
    const state = replayEvents(events.slice(0, 1), createInitialState())
    const legacy: LegacyCanonicalSnapshot = { schemaVersion: '0.1', revision: 1, state }
    expect(importSnapshot(legacy)).toEqual(state)
  })
})

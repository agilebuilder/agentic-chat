import { describe, expect, it } from 'vitest'
import type { CanonicalEvent } from './events.js'
import { createInitialState } from './model.js'
import { replayEvents } from './reducer.js'

const envelope = (sequence: number) => ({
  schemaVersion: '0.1' as const,
  eventId: `task-event-${sequence}`,
  threadId: 'thread-1',
  runId: 'run-1',
  sequence,
  timestamp: `2026-07-15T01:00:0${sequence}.000Z`,
  source: 'task-fixture',
})

const started: CanonicalEvent = { ...envelope(1), type: 'run.started', data: {} }

describe('task snapshot and revision patches', () => {
  it('replaces one run task collection and applies atomic patches', () => {
    const events: CanonicalEvent[] = [
      started,
      { ...envelope(2), type: 'tasks.snapshot', data: { revision: 4, tasks: [{ id: 'plan', title: 'Plan', status: 'in_progress' }] } },
      { ...envelope(3), type: 'task.patched', data: { baseRevision: 4, revision: 5, taskId: 'code', patch: { operation: 'upsert', value: { parentId: 'plan', title: 'Code', status: 'pending' } } } },
      { ...envelope(4), type: 'task.patched', data: { baseRevision: 5, revision: 6, taskId: 'code', patch: { operation: 'update', changes: { status: 'completed', parentId: null } } } },
    ]
    const state = replayEvents(events, createInitialState())
    expect(state.taskRevisionByRunId['run-1']).toBe(6)
    expect(state.tasks.code).toEqual({ id: 'code', runId: 'run-1', title: 'Code', status: 'completed' })
    expect(state.diagnostics).toEqual([])
  })

  it('rejects stale and skipped revisions without mutating task data', () => {
    const events: CanonicalEvent[] = [
      started,
      { ...envelope(2), type: 'tasks.snapshot', data: { revision: 2, tasks: [{ id: 'task-1', title: 'Original', status: 'pending' }] } },
      { ...envelope(3), type: 'task.patched', data: { baseRevision: 1, revision: 3, taskId: 'task-1', patch: { operation: 'update', changes: { title: 'Stale' } } } },
      { ...envelope(4), type: 'task.patched', data: { baseRevision: 2, revision: 4, taskId: 'task-1', patch: { operation: 'update', changes: { title: 'Skipped' } } } },
    ]
    const state = replayEvents(events, createInitialState())
    expect(state.tasks['task-1']?.title).toBe('Original')
    expect(state.taskRevisionByRunId['run-1']).toBe(2)
    expect(state.diagnostics.map((item) => item.code)).toEqual(['revision_conflict', 'revision_conflict'])
  })

  it('does not remove a parent while child tasks still reference it', () => {
    const events: CanonicalEvent[] = [
      started,
      { ...envelope(2), type: 'tasks.snapshot', data: { revision: 1, tasks: [
        { id: 'parent', title: 'Parent', status: 'completed' },
        { id: 'child', parentId: 'parent', title: 'Child', status: 'pending' },
      ] } },
      { ...envelope(3), type: 'task.patched', data: { baseRevision: 1, revision: 2, taskId: 'parent', patch: { operation: 'remove' } } },
    ]
    const state = replayEvents(events, createInitialState())
    expect(state.tasks.parent).toBeDefined()
    expect(state.taskRevisionByRunId['run-1']).toBe(1)
    expect(state.diagnostics.at(-1)?.code).toBe('invalid_transition')
  })

  it('allows a newer snapshot to authoritatively replace the run task set', () => {
    const events: CanonicalEvent[] = [
      started,
      { ...envelope(2), type: 'tasks.snapshot', data: { revision: 1, tasks: [{ id: 'old', title: 'Old', status: 'pending' }] } },
      { ...envelope(3), type: 'tasks.snapshot', data: { revision: 3, tasks: [{ id: 'new', title: 'New', status: 'completed' }] } },
    ]
    const state = replayEvents(events, createInitialState())
    expect(state.tasks.old).toBeUndefined()
    expect(state.tasks.new?.status).toBe('completed')
    expect(state.taskRevisionByRunId['run-1']).toBe(3)
  })

  it('rejects cyclic task snapshots', () => {
    const state = replayEvents([
      started,
      { ...envelope(2), type: 'tasks.snapshot', data: { revision: 1, tasks: [
        { id: 'one', parentId: 'two', title: 'One', status: 'pending' },
        { id: 'two', parentId: 'one', title: 'Two', status: 'pending' },
      ] } },
    ], createInitialState())
    expect(state.tasks).toEqual({})
    expect(state.diagnostics.at(-1)?.message).toContain('parent cycle')
  })
})

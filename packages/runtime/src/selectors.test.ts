import { createInitialState, replayEvents, type CanonicalEvent } from '@agentic-chat/core'
import { describe, expect, it } from 'vitest'
import { selectArtifactVersionHistory, selectArtifactsForActivity, selectChildActivityIds, selectLatestRunId, selectRootActivityIds, selectRunActivities, selectRunActivityTree, selectRunArtifacts, selectRunAttemptHistory, selectRunNeedsAttention } from './selectors.js'

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
  it('selects in one pass without sorting the state collection', () => {
    const withRuns = {
      ...state,
      runs: {
        old: { id: 'old', threadId: 'thread-2', status: 'completed' as const, attempt: 1, activityIds: [], createdAt: '2026-07-13T00:00:00Z' },
        beta: { id: 'beta', threadId: 'thread-2', status: 'running' as const, attempt: 1, activityIds: [], createdAt: '2026-07-14T00:00:00Z' },
        alpha: { id: 'alpha', threadId: 'thread-2', status: 'running' as const, attempt: 1, activityIds: [], createdAt: '2026-07-14T00:00:00Z' },
      },
    }
    expect(selectLatestRunId(withRuns, 'thread-2')).toBe('beta')
    expect(Object.keys(withRuns.runs)).toEqual(['old', 'beta', 'alpha'])
  })

  it('selects stable roots, children, and an activity tree', () => {
    const hierarchy = replayEvents([
      events[0]!,
      { ...events[1]!, data: { activityId: 'parent', kind: 'subagent', title: 'Parent' } },
      { ...events[2]!, type: 'activity.started', data: { activityId: 'child', kind: 'workflow', title: 'Child', parentActivityId: 'parent' } },
    ], createInitialState())
    expect(selectRootActivityIds(hierarchy, 'run-1')).toEqual(['parent'])
    expect(selectChildActivityIds(hierarchy, 'parent')).toEqual(['child'])
    expect(selectRunActivityTree(hierarchy, 'run-1')[0]?.children[0]?.activity.id).toBe('child')
  })

  it('selects retry history without mutating old attempts', () => {
    const attempts = createInitialState()
    attempts.runs.one = { id: 'one', threadId: 'thread-1', status: 'failed', attempt: 1, activityIds: [], createdAt: '2026-07-15T00:00:00Z' }
    attempts.runs.two = { id: 'two', threadId: 'thread-1', status: 'completed', attempt: 2, retryOfRunId: 'one', activityIds: [], createdAt: '2026-07-15T00:01:00Z' }
    expect(selectRunAttemptHistory(attempts, 'two').map((run) => run.id)).toEqual(['one', 'two'])
  })

  it('selects Artifact source links and version history', () => {
    const artifacts = createInitialState()
    artifacts.artifacts.one = { id: 'one', runId: 'run-1', name: 'report', kind: 'text/plain', status: 'available', version: 1, provenance: { type: 'agent', activityId: 'activity-1' }, createdAt: '2026-07-15T00:00:00Z' }
    artifacts.artifacts.two = { id: 'two', runId: 'run-1', name: 'report', kind: 'text/plain', status: 'generating', version: 2, previousArtifactId: 'one', provenance: { type: 'agent', activityId: 'activity-1' }, createdAt: '2026-07-15T00:01:00Z' }
    expect(selectRunArtifacts(artifacts, 'run-1').map((artifact) => artifact.id)).toEqual(['one', 'two'])
    expect(selectArtifactsForActivity(artifacts, 'activity-1').map((artifact) => artifact.id)).toEqual(['one', 'two'])
    expect(selectArtifactVersionHistory(artifacts, 'two').map((artifact) => artifact.version)).toEqual([1, 2])
  })
})

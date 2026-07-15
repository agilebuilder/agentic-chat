import type { CanonicalEvent } from '@agentic-chat/core'
import { describe, expect, it } from 'vitest'
import { checkAdapterConformance, checkArtifactConformance, checkInterventionConformance, checkRetryAttemptConformance, checkSnapshotReplayConformance } from './conformance.js'

const event = (sequence: number, type: CanonicalEvent['type']): CanonicalEvent => {
  const base = {
    schemaVersion: '0.1' as const,
    eventId: `event-${sequence}`,
    threadId: 'thread-1',
    runId: 'run-1',
    sequence,
    timestamp: `2026-07-15T00:00:0${sequence}.000Z`,
    source: 'fixture',
  }
  if (type === 'run.started' || type === 'run.completed' || type === 'run.cancelled') return { ...base, type, data: {} }
  throw new Error(`Unsupported test event ${type}`)
}

describe('adapter conformance suite', () => {
  it('accepts a minimal successful run and verifies idempotent replay', () => {
    expect(checkAdapterConformance([event(1, 'run.started'), event(2, 'run.completed')], {
      expectedStatus: 'completed',
    }).issues).toEqual([])
  })

  it('reports envelope ordering and identity violations together', () => {
    const started = event(1, 'run.started')
    const completed = { ...event(3, 'run.completed'), eventId: started.eventId }
    expect(checkAdapterConformance([started, completed]).issues).toEqual(expect.arrayContaining([
      'event IDs must be unique',
      'sequence must be contiguous: expected 2, received 3',
      'fixture must reach a terminal run status',
    ]))
  })

  it('requires exactly one terminal event at the end', () => {
    expect(checkAdapterConformance([
      event(1, 'run.started'),
      event(2, 'run.completed'),
      event(3, 'run.cancelled'),
    ]).issues).toEqual(expect.arrayContaining([
      'fixture must contain exactly one terminal run event',
      'canonical replay produced 1 diagnostic(s)',
    ]))
  })

  it('checks snapshot plus suffix replay against full replay', () => {
    const events = [event(1, 'run.started'), event(2, 'run.completed')]
    expect(checkSnapshotReplayConformance(events, 1).issues).toEqual([])
    expect(checkSnapshotReplayConformance(events, 2).issues).toEqual(['splitIndex must leave a non-empty prefix and suffix'])
  })

  it('checks retries as distinct per-Run streams', () => {
    const first = [event(1, 'run.started'), { ...event(2, 'run.completed'), type: 'run.failed', data: { error: { code: 'failed', message: 'Failed' } } } as CanonicalEvent]
    const second = [
      { ...event(1, 'run.started'), eventId: 'retry-1', runId: 'run-2', data: { attempt: 2, retryOfRunId: 'run-1' } } as CanonicalEvent,
      { ...event(2, 'run.completed'), eventId: 'retry-2', runId: 'run-2' } as CanonicalEvent,
    ]
    expect(checkRetryAttemptConformance([first, second]).issues).toEqual([])
  })

  it('accepts sibling retries that share the same terminal predecessor', () => {
    const first = [event(1, 'run.started'), { ...event(2, 'run.completed'), type: 'run.failed', data: { error: { code: 'failed', message: 'Failed' } } } as CanonicalEvent]
    const retry = (runId: string, suffix: string): CanonicalEvent[] => [
      { ...event(1, 'run.started'), eventId: `retry-${suffix}-1`, runId, data: { attempt: 2, retryOfRunId: 'run-1' } } as CanonicalEvent,
      { ...event(2, 'run.completed'), eventId: `retry-${suffix}-2`, runId } as CanonicalEvent,
    ]
    expect(checkRetryAttemptConformance([first, retry('run-2a', 'a'), retry('run-2b', 'b')]).issues).toEqual([])
  })

  it('checks intervention recovery and duplicate resolution rejection', () => {
    const events: CanonicalEvent[] = [
      event(1, 'run.started'),
      { ...event(2, 'run.completed'), type: 'run.status.changed', data: { status: 'awaiting_input' } } as CanonicalEvent,
      { ...event(3, 'run.completed'), type: 'intervention.requested', data: { interventionId: 'approval', kind: 'approval', prompt: 'Publish?' } } as CanonicalEvent,
      { ...event(4, 'run.completed'), type: 'intervention.resolved', data: { interventionId: 'approval', response: 'approved' } } as CanonicalEvent,
      { ...event(5, 'run.completed'), type: 'run.status.changed', data: { status: 'running' } } as CanonicalEvent,
      { ...event(6, 'run.completed') },
    ]
    expect(checkInterventionConformance(events).issues).toEqual([])
  })

  it('checks Artifact recovery and terminal generation state', () => {
    const events: CanonicalEvent[] = [
      event(1, 'run.started'),
      { ...event(2, 'run.completed'), type: 'artifact.created', data: { artifactId: 'report', name: 'report.txt', kind: 'text/plain' } } as CanonicalEvent,
      { ...event(3, 'run.completed'), type: 'artifact.available', data: { artifactId: 'report', sizeBytes: 10 } } as CanonicalEvent,
      { ...event(4, 'run.completed') },
    ]
    expect(checkArtifactConformance(events).issues).toEqual([])
  })
})

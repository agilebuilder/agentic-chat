import type { CanonicalEvent } from '@agentic-chat/core'
import { describe, expect, it } from 'vitest'
import { checkAdapterConformance, checkSnapshotReplayConformance } from './conformance.js'

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
})

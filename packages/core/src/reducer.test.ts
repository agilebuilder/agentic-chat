import { describe, expect, it } from 'vitest'
import type { CanonicalEvent } from './events.js'
import { createInitialState } from './model.js'
import { reduceEvent, replayEvents } from './reducer.js'

const chatBiSuccessfulRun: CanonicalEvent[] = [
  { schemaVersion: '0.1', eventId: 'evt-1', type: 'run.started', threadId: 'thread-1', runId: 'run-1', sequence: 1, timestamp: '2026-07-13T00:00:00Z', data: {} },
  { schemaVersion: '0.1', eventId: 'evt-2', type: 'tool.started', threadId: 'thread-1', runId: 'run-1', sequence: 2, timestamp: '2026-07-13T00:00:01Z', data: { activityId: 'tool-activity-1', toolCallId: 'tool-call-1', name: 'query_data_source' } },
  { schemaVersion: '0.1', eventId: 'evt-3', type: 'tool.completed', threadId: 'thread-1', runId: 'run-1', sequence: 3, timestamp: '2026-07-13T00:00:02Z', data: { toolCallId: 'tool-call-1', output: { ok: true } } },
  { schemaVersion: '0.1', eventId: 'evt-4', type: 'result.available', threadId: 'thread-1', runId: 'run-1', sequence: 4, timestamp: '2026-07-13T00:00:03Z', data: { result: { row_count: 3 } } },
  { schemaVersion: '0.1', eventId: 'evt-5', type: 'run.completed', threadId: 'thread-1', runId: 'run-1', sequence: 5, timestamp: '2026-07-13T00:00:04Z', data: {} },
]

describe('canonical reducer', () => {
  it('replays a ChatBI-style run deterministically', () => {
    const first = replayEvents(chatBiSuccessfulRun, createInitialState())
    const second = replayEvents(chatBiSuccessfulRun, createInitialState())
    expect(first).toEqual(second)
    expect(first.runs['run-1']?.status).toBe('completed')
    expect(first.toolCalls['tool-call-1']?.status).toBe('completed')
    expect(first.results['run-1']).toEqual({ row_count: 3 })
  })

  it('is idempotent for a duplicate event id', () => {
    const first = reduceEvent(createInitialState(), chatBiSuccessfulRun[0]!)
    expect(reduceEvent(first, chatBiSuccessfulRun[0]!)).toBe(first)
  })

  it('blocks a stream when it detects a sequence gap', () => {
    const started = reduceEvent(createInitialState(), chatBiSuccessfulRun[0]!)
    const gap = reduceEvent(started, chatBiSuccessfulRun[2]!)
    expect(gap.streams['run-1']?.blocked).toBe(true)
    expect(gap.diagnostics.at(-1)?.code).toBe('sequence_gap')
  })

  it('protects a terminal run from later progress', () => {
    const completed = replayEvents(chatBiSuccessfulRun, createInitialState())
    const late = { ...chatBiSuccessfulRun[1]!, eventId: 'evt-late', sequence: 6 }
    const next = reduceEvent(completed, late)
    expect(next.runs['run-1']?.status).toBe('completed')
    expect(next.diagnostics.at(-1)?.code).toBe('invalid_transition')
  })
})

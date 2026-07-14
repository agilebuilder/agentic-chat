import { describe, expect, it } from 'vitest'
import type { CanonicalEvent } from './events.js'
import { createInitialState } from './model.js'
import { compactRunStream, MAX_RETAINED_EVENT_IDS_PER_RUN, reduceEvent, replayEvents } from './reducer.js'

const chatBiSuccessfulRun: CanonicalEvent[] = [
  { schemaVersion: '0.1', eventId: 'evt-1', type: 'run.started', threadId: 'thread-1', runId: 'run-1', sequence: 1, timestamp: '2026-07-13T00:00:00Z', data: {} },
  { schemaVersion: '0.1', eventId: 'evt-2', type: 'tool.started', threadId: 'thread-1', runId: 'run-1', sequence: 2, timestamp: '2026-07-13T00:00:01Z', data: { activityId: 'tool-activity-1', toolCallId: 'tool-call-1', name: 'query_data_source' } },
  { schemaVersion: '0.1', eventId: 'evt-3', type: 'tool.completed', threadId: 'thread-1', runId: 'run-1', sequence: 3, timestamp: '2026-07-13T00:00:02Z', data: { toolCallId: 'tool-call-1', output: { ok: true } } },
  { schemaVersion: '0.1', eventId: 'evt-4', type: 'result.available', threadId: 'thread-1', runId: 'run-1', sequence: 4, timestamp: '2026-07-13T00:00:03Z', data: { kind: 'test.result', result: { row_count: 3 } } },
  { schemaVersion: '0.1', eventId: 'evt-5', type: 'run.completed', threadId: 'thread-1', runId: 'run-1', sequence: 5, timestamp: '2026-07-13T00:00:04Z', data: {} },
]

describe('canonical reducer', () => {
  it('replays a ChatBI-style run deterministically', () => {
    const first = replayEvents(chatBiSuccessfulRun, createInitialState())
    const second = replayEvents(chatBiSuccessfulRun, createInitialState())
    expect(first).toEqual(second)
    expect(first.runs['run-1']?.status).toBe('completed')
    expect(first.toolCalls['tool-call-1']?.status).toBe('completed')
    expect(first.results['run-1']).toEqual({ kind: 'test.result', value: { row_count: 3 } })
    expect(first.streams['run-1']).toMatchObject({ compactedThroughSequence: 5, seenEventIds: {} })
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

  it('unblocks when replay supplies the missing event', () => {
    const started = reduceEvent(createInitialState(), chatBiSuccessfulRun[0]!)
    const gap = reduceEvent(started, chatBiSuccessfulRun[2]!)
    const recovered = reduceEvent(gap, chatBiSuccessfulRun[1]!)
    const continued = reduceEvent(recovered, chatBiSuccessfulRun[2]!)
    expect(continued.streams['run-1']).toMatchObject({ blocked: false, lastSequence: 3 })
    expect(continued.toolCalls['tool-call-1']?.status).toBe('completed')
  })

  it('protects a terminal run from later progress', () => {
    const completed = replayEvents(chatBiSuccessfulRun, createInitialState())
    const late = { ...chatBiSuccessfulRun[1]!, eventId: 'evt-late', sequence: 6 }
    const next = reduceEvent(completed, late)
    expect(next.runs['run-1']?.status).toBe('completed')
    expect(next.diagnostics.at(-1)?.code).toBe('invalid_transition')
  })

  it('does not replace an existing run when run.started re-enters with a new event id', () => {
    const progressed = replayEvents(chatBiSuccessfulRun.slice(0, 2), createInitialState())
    const duplicateStart: CanonicalEvent = { ...chatBiSuccessfulRun[0]!, eventId: 'evt-start-again', sequence: 3 }
    const next = reduceEvent(progressed, duplicateStart)
    expect(next.runs['run-1']?.activityIds).toEqual(['tool-activity-1'])
    expect(next.toolCalls['tool-call-1']?.status).toBe('running')
    expect(next.diagnostics.at(-1)?.code).toBe('invalid_transition')
  })

  it('does not revive a completed tool call or duplicate its activity', () => {
    const toolCompleted = replayEvents(chatBiSuccessfulRun.slice(0, 3), createInitialState())
    const repeatedStart: CanonicalEvent = { ...chatBiSuccessfulRun[1]!, eventId: 'evt-tool-again', sequence: 4 }
    const next = reduceEvent(toolCompleted, repeatedStart)
    expect(next.toolCalls['tool-call-1']).toMatchObject({ status: 'completed', output: { ok: true } })
    expect(next.runs['run-1']?.activityIds).toEqual(['tool-activity-1'])
    expect(next.diagnostics.at(-1)?.code).toBe('invalid_transition')
  })

  it('rejects duplicate activity starts without appending the activity twice', () => {
    const events: CanonicalEvent[] = [
      chatBiSuccessfulRun[0]!,
      { schemaVersion: '0.1', eventId: 'activity-1', type: 'activity.started', threadId: 'thread-1', runId: 'run-1', sequence: 2, timestamp: '2026-07-13T00:00:01Z', data: { activityId: 'workflow-1', kind: 'workflow', title: '计划' } },
      { schemaVersion: '0.1', eventId: 'activity-2', type: 'activity.started', threadId: 'thread-1', runId: 'run-1', sequence: 3, timestamp: '2026-07-13T00:00:02Z', data: { activityId: 'workflow-1', kind: 'workflow', title: '重复计划' } },
    ]
    const state = replayEvents(events, createInitialState())
    expect(state.runs['run-1']?.activityIds).toEqual(['workflow-1'])
    expect(state.activities['workflow-1']?.text).toBe('计划')
    expect(state.diagnostics.at(-1)?.code).toBe('invalid_transition')
  })

  it('bounds retained diagnostics', () => {
    let state = reduceEvent(createInitialState(), chatBiSuccessfulRun[0]!)
    for (let sequence = 2; sequence <= 205; sequence += 1) {
      state = reduceEvent(state, { ...chatBiSuccessfulRun[0]!, eventId: `duplicate-start-${sequence}`, sequence })
    }
    expect(state.diagnostics).toHaveLength(200)
    expect(state.streams['run-1']?.lastSequence).toBe(205)
  })

  it('accepts cancellation before run.started for a queued run', () => {
    const cancelled: CanonicalEvent = { schemaVersion: '0.1', eventId: 'queued-cancel', type: 'run.cancelled', threadId: 'thread-1', runId: 'queued-run', sequence: 1, timestamp: '2026-07-13T00:00:00Z', data: {} }
    const state = reduceEvent(createInitialState(), cancelled)
    expect(state.runs['queued-run']).toMatchObject({ status: 'cancelled', activityIds: [] })
    expect(state.diagnostics).toEqual([])
  })

  it('cancels running child activities and tools with the run', () => {
    const running = replayEvents(chatBiSuccessfulRun.slice(0, 2), createInitialState())
    const cancelled: CanonicalEvent = { schemaVersion: '0.1', eventId: 'cancel-with-tool', type: 'run.cancelled', threadId: 'thread-1', runId: 'run-1', sequence: 3, timestamp: '2026-07-13T00:00:03Z', data: {} }
    const state = reduceEvent(running, cancelled)
    expect(state.activities['tool-activity-1']?.status).toBe('cancelled')
    expect(state.toolCalls['tool-call-1']?.status).toBe('cancelled')
  })

  it('bounds event ids while preserving idempotent historical replay', () => {
    const events: CanonicalEvent[] = [chatBiSuccessfulRun[0]!]
    for (let sequence = 2; sequence <= 600; sequence += 1) {
      events.push({
        schemaVersion: '0.1',
        eventId: `observed-${sequence}`,
        type: 'source.observed',
        threadId: 'thread-1',
        runId: 'run-1',
        sequence,
        timestamp: '2026-07-13T00:00:01Z',
        data: { sourceType: 'benchmark' },
      })
    }
    const state = replayEvents(events, createInitialState())
    const cursor = state.streams['run-1']!
    expect(Object.keys(cursor.seenEventIds).length).toBeLessThanOrEqual(MAX_RETAINED_EVENT_IDS_PER_RUN)
    expect(cursor.compactedThroughSequence).toBeGreaterThan(0)
    expect(replayEvents(events, state)).toBe(state)
  })

  it('supports explicit safe stream compaction', () => {
    const state = replayEvents(chatBiSuccessfulRun.slice(0, 3), createInitialState())
    const compacted = compactRunStream(state, 'run-1')
    expect(compacted.streams['run-1']).toMatchObject({ compactedThroughSequence: 3, seenEventIds: {} })
    expect(replayEvents(chatBiSuccessfulRun.slice(0, 3), compacted)).toBe(compacted)
    expect(compactRunStream(compacted, 'run-1')).toBe(compacted)
  })
})

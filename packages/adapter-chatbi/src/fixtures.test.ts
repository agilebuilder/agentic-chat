import { createInitialState, replayEvents, type CanonicalEvent } from '@agentic-chat/core'
import { checkAdapterConformance, checkSnapshotReplayConformance, rawChatBiCancelledRun, rawChatBiFailedRun, rawChatBiSuccessfulRun, type RawChatBiEvent } from '@agentic-chat/testkit'
import { describe, expect, it } from 'vitest'
import { adaptChatBiEvent, type ChatBiRunEvent } from './index.js'

const adapt = (events: readonly RawChatBiEvent[]): CanonicalEvent[] => events.map((item) => {
  const result = adaptChatBiEvent(item as ChatBiRunEvent)
  if (!result.event) throw new Error(result.diagnostic?.message ?? 'Adapter did not emit an event')
  return result.event
})

describe('ChatBI fixture conformance', () => {
  it.each([
    ['success', rawChatBiSuccessfulRun, 'completed'],
    ['failure', rawChatBiFailedRun, 'failed'],
    ['cancellation', rawChatBiCancelledRun, 'cancelled'],
  ] as const)('replays %s deterministically', (_name, rawEvents, expected) => {
    const canonical = adapt(rawEvents)
    const state = replayEvents(canonical, createInitialState())
    expect(checkAdapterConformance(canonical, { expectedStatus: expected, sequence: 'strict-per-run' }).issues).toEqual([])
    expect(state.runs[canonical[0]!.runId]?.status).toBe(expected)
    expect(state.streams[canonical[0]!.runId]?.blocked).toBe(false)
  })

  it('supports replay from the last received sequence without duplication', () => {
    const canonical = adapt(rawChatBiSuccessfulRun)
    const disconnected = replayEvents(canonical.slice(0, 2), createInitialState())
    const resumed = replayEvents(canonical.slice(2), disconnected)
    expect(resumed.runs['run-success']?.status).toBe('completed')
    expect(resumed.runs['run-success']?.activityIds).toHaveLength(1)
    expect(checkSnapshotReplayConformance(canonical, 2).issues).toEqual([])
  })
})

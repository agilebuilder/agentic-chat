import { createInitialState, replayEvents } from '@agentic-chat/core'
import { describe, expect, it } from 'vitest'
import { adaptCodingFixture, codingAgentRetryAttemptStreams, codingAgentSourceFixture } from './coding-fixture.js'
import { checkAdapterConformance, checkArtifactConformance, checkInterventionConformance, checkRetryAttemptConformance, checkSnapshotReplayConformance } from './conformance.js'

describe('coding agent behavioral fixture', () => {
  it('converts parallel roots, nested tools and approval without source-specific core fields', () => {
    const events = adaptCodingFixture(codingAgentSourceFixture)
    const result = checkAdapterConformance(events, { expectedStatus: 'completed', sequence: 'strict-per-run' })
    const state = replayEvents(events, createInitialState())
    expect(result.issues).toEqual([])
    expect(state.activities['subagent-tests']?.order).toBe(0)
    expect(state.activities['subagent-code']?.order).toBe(1)
    expect(state.activities['tool-test']?.parentId).toBe('subagent-tests')
    expect(state.interventions['approval-1']).toMatchObject({ status: 'resolved', response: 'approved' })
    expect(checkInterventionConformance(events).issues).toEqual([])
    expect(checkArtifactConformance(events).issues).toEqual([])
    expect(state.artifacts['patch-1']).toMatchObject({ status: 'available', version: 1, provenance: { activityId: 'subagent-code' } })
    expect(state.runs['code-run']?.status).toBe('completed')
    expect(checkSnapshotReplayConformance(events, 7).issues).toEqual([])
  })

  it('represents retry as a new Run while preserving attempt history', () => {
    const result = checkRetryAttemptConformance(codingAgentRetryAttemptStreams)
    expect(result.issues).toEqual([])
    expect(result.state.runs['code-attempt-1']?.status).toBe('failed')
    expect(result.state.runs['code-attempt-2']).toMatchObject({ status: 'completed', attempt: 2, retryOfRunId: 'code-attempt-1' })
  })
})

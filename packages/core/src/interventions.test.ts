import { describe, expect, it } from 'vitest'
import type { CanonicalEvent } from './events.js'
import { createInitialState } from './model.js'
import { reduceEvent, replayEvents } from './reducer.js'
import { createSnapshot, importSnapshot } from './snapshot.js'

const event = (sequence: number, type: CanonicalEvent['type'], data: CanonicalEvent['data']): CanonicalEvent => ({
  schemaVersion: '0.1', eventId: `hitl:${sequence}`, type, threadId: 'thread-1', runId: 'run-1', sequence,
  timestamp: `2026-07-15T09:00:0${sequence}Z`, data, source: 'hitl-test',
} as CanonicalEvent)

describe('Intervention state machine', () => {
  it('persists pending, resolved and expired states without changing Run status implicitly', () => {
    const pending = replayEvents([
      event(1, 'run.started', {}),
      event(2, 'run.status.changed', { status: 'awaiting_input' }),
      event(3, 'intervention.requested', { interventionId: 'approval', kind: 'approval', prompt: 'Publish?', risk: 'External visibility', expiresAt: '2026-07-15T10:00:00Z' }),
    ], createInitialState())
    const restored = importSnapshot(createSnapshot(pending, 1))
    expect(restored.interventions.approval).toMatchObject({ status: 'pending', requestedAt: '2026-07-15T09:00:03Z', risk: 'External visibility' })
    expect(restored.runs['run-1']?.status).toBe('awaiting_input')

    const oldSnapshot = createSnapshot(pending, 1)
    delete (oldSnapshot.entities.interventions[0] as { requestedAt?: string }).requestedAt
    expect(importSnapshot(oldSnapshot).interventions.approval?.requestedAt).toBe('2026-07-15T09:00:01Z')

    const resolved = reduceEvent(restored, event(4, 'intervention.resolved', { interventionId: 'approval', response: 'approved' }))
    expect(resolved.interventions.approval).toMatchObject({ status: 'resolved', response: 'approved', resolvedAt: '2026-07-15T09:00:04Z' })
    expect(resolved.runs['run-1']?.status).toBe('awaiting_input')

    const pendingChoice = replayEvents([
      event(1, 'run.started', {}),
      event(2, 'intervention.requested', { interventionId: 'choice', kind: 'choice', prompt: 'Select', options: [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }] }),
      event(3, 'intervention.expired', { interventionId: 'choice' }),
    ], createInitialState())
    expect(pendingChoice.interventions.choice).toMatchObject({ status: 'expired', expiredAt: '2026-07-15T09:00:03Z' })
  })

  it('rejects invalid choice/form definitions and duplicate terminal transitions', () => {
    const started = reduceEvent(createInitialState(), event(1, 'run.started', {}))
    const invalidChoice = reduceEvent(started, event(2, 'intervention.requested', { interventionId: 'choice', kind: 'choice', prompt: 'Select', options: [{ value: 'a', label: 'A' }] }))
    expect(invalidChoice.interventions.choice).toBeUndefined()
    expect(invalidChoice.diagnostics.at(-1)?.code).toBe('invalid_transition')

    const invalidForm = reduceEvent(started, event(2, 'intervention.requested', { interventionId: 'form', kind: 'form', prompt: 'Details', fields: [{ name: 'x', label: 'X', type: 'select' }] }))
    expect(invalidForm.interventions.form).toBeUndefined()

    const pending = reduceEvent(started, event(2, 'intervention.requested', { interventionId: 'confirm', kind: 'confirm', prompt: 'Continue?' }))
    const resolved = reduceEvent(pending, event(3, 'intervention.resolved', { interventionId: 'confirm', response: true }))
    const duplicate = reduceEvent(resolved, event(4, 'intervention.resolved', { interventionId: 'confirm', response: true }))
    expect(duplicate.interventions.confirm?.response).toBe(true)
    expect(duplicate.diagnostics.at(-1)?.message).toContain('not pending')
  })

  it('rejects malformed structured interventions in snapshots', () => {
    const state = replayEvents([
      event(1, 'run.started', {}),
      event(2, 'intervention.requested', { interventionId: 'choice', kind: 'choice', prompt: 'Select', options: [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }] }),
    ], createInitialState())
    const snapshot = createSnapshot(state, 1)
    snapshot.entities.interventions[0]!.options = [{ value: 'a', label: 'A' }]
    expect(() => importSnapshot(snapshot)).toThrow('invalid options')
  })
})

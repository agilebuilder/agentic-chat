import { createInitialState, reduceEvent, type CanonicalEvent } from '@agentic-chat/core'
import { describe, expect, it } from 'vitest'
import { selectRunActivities } from './selectors.js'
import { createRuntime } from './index.js'

const activityCount = 1_000
const ingestionBudgetMs = 4_000
const selectionBudgetMs = 50

describe('1,000 activity performance budget', () => {
  it('ingests and selects a long run within the alpha budget', { timeout: 10_000 }, () => {
    let state = createInitialState()
    let sequence = 1
    const event = (type: CanonicalEvent['type'], data: Record<string, unknown>): CanonicalEvent => ({
      schemaVersion: '0.1',
      eventId: `perf-${sequence}`,
      type,
      threadId: 'perf-thread',
      runId: 'perf-run',
      sequence: sequence++,
      timestamp: '2026-07-14T00:00:00Z',
      data,
    } as CanonicalEvent)

    const startedAt = performance.now()
    state = reduceEvent(state, event('run.started', {}))
    for (let index = 0; index < activityCount; index += 1) {
      const activityId = `activity-${index}`
      state = reduceEvent(state, event('activity.started', { activityId, kind: 'workflow', title: `Task ${index}` }))
      state = reduceEvent(state, event('activity.completed', { activityId }))
    }
    const ingestionMs = performance.now() - startedAt

    const selectionStartedAt = performance.now()
    const activities = selectRunActivities(state, 'perf-run')
    const selectionMs = performance.now() - selectionStartedAt

    expect(activities).toHaveLength(activityCount)
    expect(ingestionMs).toBeLessThan(ingestionBudgetMs)
    expect(selectionMs).toBeLessThan(selectionBudgetMs)
  })

  it('keeps opt-in inspection bounded within the long-run ingestion budget', { timeout: 10_000 }, () => {
    const runtime = createRuntime({ experimentalInspection: { maxEvents: 200, maxConnections: 20 } })
    let sequence = 1
    const event = (type: CanonicalEvent['type'], data: Record<string, unknown>): CanonicalEvent => ({
      schemaVersion: '0.1', eventId: `inspect-perf-${sequence}`, type, threadId: 'perf-thread', runId: 'inspect-perf-run', sequence: sequence++, timestamp: '2026-07-15T00:00:00Z', data,
    } as CanonicalEvent)
    const startedAt = performance.now()
    runtime.dispatch(event('run.started', {}))
    for (let index = 0; index < activityCount; index += 1) {
      const activityId = `activity-${index}`
      runtime.dispatch(event('activity.started', { activityId, kind: 'workflow', title: `Task ${index}`, privateValue: `not-retained-${index}` }))
      runtime.dispatch(event('activity.completed', { activityId }))
    }
    const ingestionMs = performance.now() - startedAt
    const inspection = runtime.getSnapshot().experimentalInspection
    expect(inspection?.events).toHaveLength(200)
    expect(inspection?.events[0]?.sequence).toBe(1_802)
    expect(inspection?.events.at(-1)?.sequence).toBe(2_001)
    expect(inspection?.events.some((item) => 'data' in item)).toBe(false)
    expect(ingestionMs).toBeLessThan(ingestionBudgetMs)
  })
})

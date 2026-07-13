import type { CanonicalEvent } from '@agentic-chat/core'
import { describe, expect, it, vi } from 'vitest'
import { createRuntime } from './index.js'

const started: CanonicalEvent = { schemaVersion: '0.1', eventId: 'runtime-1', type: 'run.started', threadId: 'thread-1', runId: 'run-1', sequence: 1, timestamp: '2026-07-13T00:00:00Z', data: {} }

describe('runtime external store contract', () => {
  it('notifies subscribers only when state changes', () => {
    const runtime = createRuntime()
    const listener = vi.fn()
    const unsubscribe = runtime.subscribe(listener)
    runtime.dispatch(started)
    runtime.dispatch(started)
    expect(listener).toHaveBeenCalledTimes(1)
    expect(runtime.getSnapshot().runs['run-1']?.status).toBe('running')
    unsubscribe()
  })
})

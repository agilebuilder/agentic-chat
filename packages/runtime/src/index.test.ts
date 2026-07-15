import { createInitialState, createSnapshot, replayEvents, type CanonicalEvent } from '@agentic-chat/core'
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
    expect(runtime.getState().runs['run-1']?.status).toBe('running')
    unsubscribe()
  })

  it('exposes capabilities and commands together', () => {
    const send = vi.fn(async () => ({ commandId: 'command-1', accepted: true }))
    const runtime = createRuntime({
      capabilities: { send: true, sequence: 'strict-per-run', replay: 'live-resume', cancel: false, resume: false, retry: false, intervention: false, artifacts: false },
      commands: { send },
    })
    expect(runtime.capabilities.send).toBe(true)
    expect(runtime.commands.send).toBe(send)
  })

  it('rejects a capability without its command implementation', () => {
    expect(() => createRuntime({
      capabilities: { send: false, sequence: 'strict-per-run', replay: 'live-resume', cancel: true, resume: false, retry: false, intervention: false, artifacts: false },
    })).toThrow('Capability/command mismatch for cancelRun')
  })

  it('tracks connection and command state', async () => {
    const runtime = createRuntime()
    runtime.setConnection({ status: 'connected', attempt: 1 })
    await runtime.executeCommand('send', async () => 'ok')
    expect(runtime.getSnapshot()).toMatchObject({ connection: { status: 'connected' }, commands: { send: { status: 'succeeded' } } })
  })

  it('retains adapter diagnostics outside domain state', () => {
    const runtime = createRuntime()
    runtime.reportDiagnostic({ source: 'test-adapter', code: 'unsupported_event', message: 'Hidden event' })
    expect(runtime.getSnapshot().diagnostics).toEqual([{ source: 'test-adapter', code: 'unsupported_event', message: 'Hidden event' }])
  })

  it('bounds retained adapter diagnostics', () => {
    const runtime = createRuntime()
    for (let index = 0; index < 205; index += 1) {
      runtime.reportDiagnostic({ source: 'test-adapter', code: `diagnostic-${index}`, message: 'Bounded diagnostic' })
    }
    expect(runtime.getSnapshot().diagnostics).toHaveLength(200)
    expect(runtime.getSnapshot().diagnostics[0]?.code).toBe('diagnostic-5')
  })

  it('hydrates a queued run without consuming its event cursor', () => {
    const runtime = createRuntime()
    runtime.hydrateRun({ id: 'run-1', threadId: 'thread-1', status: 'queued', attempt: 1, activityIds: [], createdAt: '2026-07-13T00:00:00Z' })
    expect(runtime.getState().runs['run-1']?.status).toBe('queued')
    expect(runtime.getState().streams['run-1']).toBeUndefined()
    runtime.dispatch({ schemaVersion: '0.1', eventId: 'start-1', type: 'run.started', threadId: 'thread-1', runId: 'run-1', sequence: 1, timestamp: '2026-07-13T00:00:01Z', data: {} })
    expect(runtime.getState().runs['run-1']?.status).toBe('running')
  })

  it('initializes from the public canonical snapshot schema', () => {
    const state = replayEvents([started], createInitialState())
    const runtime = createRuntime({ initialSnapshot: createSnapshot(state, 4) })
    expect(runtime.getState().runs['run-1']?.status).toBe('running')
    expect(runtime.getState().streams['run-1']).toMatchObject({ lastSequence: 1, compactedThroughSequence: 1 })
    expect(() => createRuntime({ initialState: state, initialSnapshot: createSnapshot(state, 4) })).toThrow('either initialState or initialSnapshot')
  })

  it('compacts replay metadata and notifies subscribers once', () => {
    const runtime = createRuntime()
    runtime.dispatch(started)
    const listener = vi.fn()
    runtime.subscribe(listener)
    runtime.compactRun('run-1')
    expect(runtime.getState().streams['run-1']).toMatchObject({ compactedThroughSequence: 1, seenEventIds: {} })
    expect(listener).toHaveBeenCalledTimes(1)
    runtime.dispatch(started)
    expect(listener).toHaveBeenCalledTimes(1)
  })
})

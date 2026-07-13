import { describe, expect, it, vi } from 'vitest'
import { ChatBiClient, createChatBiController, parseChatBiSseBuffer } from './client.js'

const sourceEvent = (sequence: number, eventType: string) => ({ protocol_version: '1.0', event_id: `event-${sequence}`, event_type: eventType, session_id: 'session-1', run_id: 'run-1', sequence, created_at: '2026-07-13T00:00:00Z', tool_call_id: null, payload: {} })
const sse = (...events: unknown[]) => events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join('')

describe('ChatBI client/controller', () => {
  it('binds the host fetch implementation to its global receiver', async () => {
    const original = globalThis.fetch
    globalThis.fetch = function (this: typeof globalThis) {
      if (this !== globalThis) throw new TypeError('Illegal invocation')
      return Promise.resolve(new Response(JSON.stringify({ id: 'run-1', session_id: 'session-1', status: 'queued' }), { status: 200 }))
    } as typeof globalThis.fetch
    try {
      await expect(new ChatBiClient().createRun('session-1', 'question', { source_id: 'source-1' })).resolves.toMatchObject({ id: 'run-1' })
    } finally {
      globalThis.fetch = original
    }
  })

  it('parses SSE comments and complete data blocks', () => {
    const parsed = parseChatBiSseBuffer(`: heartbeat\n\n${sse(sourceEvent(1, 'run.started'))}`)
    expect(parsed.events).toHaveLength(1)
    expect(parsed.events[0]?.sequence).toBe(1)
  })

  it('creates a run, replays its events and reaches completed', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'run-1', session_id: 'session-1', status: 'queued' }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(sse(sourceEvent(1, 'run.started'), sourceEvent(2, 'run.completed')), { status: 200, headers: { 'Content-Type': 'text/event-stream' } }))
    const controller = createChatBiController({ sessionId: 'session-1', target: { source_id: 'source-1' }, fetch, reconnectDelayMs: 0 })
    const runId = await controller.start('销售额是多少？')
    expect(runId).toBe('run-1')
    await controller.waitForRun(runId)
    expect(controller.runtime.getState().runs['run-1']?.status).toBe('completed')
    expect(controller.runtime.getSnapshot().connection.status).toBe('closed')
    expect(fetch.mock.calls[1]?.[0]).toContain('after_sequence=0')
  })

  it('reconnects from the last applied sequence', async () => {
    const encoder = new TextEncoder()
    let pullCount = 0
    const interrupted = new ReadableStream<Uint8Array>({
      pull(controller) {
        if (pullCount++ === 0) controller.enqueue(encoder.encode(sse(sourceEvent(1, 'run.started'))))
        else controller.error(new Error('connection reset'))
      },
    })
    const fetch = vi.fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(new Response(interrupted, { status: 200 }))
      .mockResolvedValueOnce(new Response(sse(sourceEvent(2, 'run.completed')), { status: 200 }))
    const controller = createChatBiController({ sessionId: 'session-1', target: { source_id: 'source-1' }, fetch, reconnectDelayMs: 0 })
    await controller.connect('run-1')
    expect(controller.runtime.getState().runs['run-1']?.status).toBe('completed')
    expect(fetch.mock.calls[1]?.[0]).toContain('after_sequence=1')
    expect(controller.runtime.getSnapshot().connection.attempt).toBe(2)
  })

  it('does not report connected before the event stream is established', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockRejectedValue(new Error('connection refused'))
    const controller = createChatBiController({ sessionId: 'session-1', target: { source_id: 'source-1' }, fetch, maxReconnectAttempts: 1 })
    const statuses: string[] = []
    controller.runtime.subscribe(() => statuses.push(controller.runtime.getSnapshot().connection.status))

    await expect(controller.connect('run-1')).rejects.toThrow('connection refused')

    expect(statuses).toEqual(['connecting', 'error'])
  })

  it('keeps a bounded settled result so late waiters observe stream failures', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'run-1', session_id: 'session-1', status: 'queued' }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
      .mockRejectedValueOnce(new Error('stream failed'))
    const controller = createChatBiController({ sessionId: 'session-1', target: { source_id: 'source-1' }, fetch, maxReconnectAttempts: 1 })

    const runId = await controller.start('question')
    await expect(controller.waitForRun(runId)).rejects.toThrow('stream failed')
    await expect(controller.waitForRun(runId)).rejects.toThrow('stream failed')
  })
})

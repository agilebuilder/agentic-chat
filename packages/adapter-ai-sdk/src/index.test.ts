import { checkAdapterConformance, checkSnapshotReplayConformance } from '@agentic-chat/testkit'
import { describe, expect, it } from 'vitest'
import { adaptAiSdkUIMessageChunks, aiSdkCapabilities, parseAiSdkSseData, type AiSdkUIMessageChunk } from './index.js'

const fixture: AiSdkUIMessageChunk[] = [
  { type: 'start', messageId: 'message-1' },
  { type: 'start-step' },
  { type: 'tool-input-start', toolCallId: 'call-1', toolName: 'get_weather' },
  { type: 'tool-input-delta', toolCallId: 'call-1', inputTextDelta: '{"city":"' },
  { type: 'tool-input-delta', toolCallId: 'call-1', inputTextDelta: 'Shanghai"}' },
  { type: 'tool-input-available', toolCallId: 'call-1', toolName: 'get_weather', input: { city: 'Shanghai' } },
  { type: 'tool-output-available', toolCallId: 'call-1', output: { temperature: 31 } },
  { type: 'finish-step' },
  { type: 'start-step' },
  { type: 'text-start', id: 'text-1' },
  { type: 'text-delta', id: 'text-1', delta: '上海气温' },
  { type: 'text-delta', id: 'text-1', delta: '31°C' },
  { type: 'text-end', id: 'text-1' },
  { type: 'finish-step' },
  { type: 'finish', finishReason: 'stop' },
]

describe('AI SDK UI Message Stream adapter', () => {
  it('maps multi-step text and tool execution through shared conformance', () => {
    const adapted = adaptAiSdkUIMessageChunks(fixture, { threadId: 'thread-ai', runId: 'run-ai', startedAt: '2026-07-15T00:00:00Z' })
    const result = checkAdapterConformance(adapted.events, { expectedStatus: 'completed', sequence: aiSdkCapabilities.sequence })
    expect(adapted.diagnostics).toEqual([])
    expect(result.issues).toEqual([])
    expect(result.state.toolCalls['call-1']).toMatchObject({ status: 'completed', inputText: '{"city":"Shanghai"}', output: { temperature: 31 } })
    expect(result.state.results['run-ai']).toEqual({ kind: 'text', value: '上海气温31°C' })
    expect(checkSnapshotReplayConformance(adapted.events, 7).issues).toEqual([])
  })

  it('supports non-streamed tool input and tool errors', () => {
    const adapted = adaptAiSdkUIMessageChunks([
      { type: 'start' },
      { type: 'tool-input-available', toolCallId: 'call', toolName: 'lookup', input: { id: 1 } },
      { type: 'tool-output-error', toolCallId: 'call', errorText: 'denied' },
      { type: 'finish' },
    ], { threadId: 't', runId: 'r' })
    expect(adapted.diagnostics).toEqual([])
    expect(checkAdapterConformance(adapted.events).issues).toEqual([])
  })

  it('preserves unknown chunks without exposing their payload', () => {
    const adapted = adaptAiSdkUIMessageChunks([{ type: 'start' }, { type: 'data-secret', data: { token: 'hidden' } }, { type: 'finish' }], { threadId: 't', runId: 'r' })
    expect(adapted.events[1]).toMatchObject({ type: 'source.observed', data: { sourceType: 'data-secret' } })
    expect(adapted.events[1]).not.toHaveProperty('data.payload')
    expect(adapted.diagnostics[0]?.code).toBe('unsupported_event')
  })

  it('maps abort and stream errors to terminal runs and rejects trailing chunks', () => {
    const aborted = adaptAiSdkUIMessageChunks([{ type: 'start' }, { type: 'abort', reason: 'cancelled' }, { type: 'finish' }], { threadId: 't', runId: 'abort' })
    expect(aborted.events.map((event) => event.type)).toEqual(['run.started', 'run.cancelled'])
    expect(aborted.diagnostics[0]?.message).toContain('after a terminal chunk')
    const failed = adaptAiSdkUIMessageChunks([{ type: 'start' }, { type: 'error', errorText: 'upstream unavailable' }], { threadId: 't', runId: 'failed' })
    expect(checkAdapterConformance(failed.events, { expectedStatus: 'failed' }).issues).toEqual([])
    expect(failed.events[1]).toMatchObject({ type: 'run.failed', data: { error: { message: 'upstream unavailable' } } })
  })

  it('parses SSE payloads and termination markers', () => {
    expect(parseAiSdkSseData('{"type":"start"}')).toEqual({ type: 'start' })
    expect(parseAiSdkSseData('[DONE]')).toBeNull()
    expect(parseAiSdkSseData(': ping')).toBeUndefined()
    expect(() => parseAiSdkSseData('{"noType":true}')).toThrow('Invalid AI SDK')
  })
})

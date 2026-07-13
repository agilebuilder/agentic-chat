import { describe, expect, it } from 'vitest'
import { adaptChatBiEvent, type ChatBiRunEvent } from './index.js'

const raw = (event_type: ChatBiRunEvent['event_type'], sequence: number, overrides: Partial<ChatBiRunEvent> = {}): ChatBiRunEvent => ({
  protocol_version: '1.0', event_id: `event-${sequence}`, event_type, session_id: 'session-1', run_id: 'run-1', sequence, created_at: '2026-07-13T00:00:00Z', tool_call_id: null, payload: {}, ...overrides,
})

describe('ChatBI adapter', () => {
  it('maps tool events by tool_call_id', () => {
    const result = adaptChatBiEvent(raw('tool.started', 2, { tool_call_id: 'call-1', payload: { tool_name: 'query_data_source' } }))
    expect(result.event?.type).toBe('tool.started')
    if (result.event?.type === 'tool.started') expect(result.event.data.toolCallId).toBe('call-1')
  })

  it('rejects a tool event without tool_call_id', () => {
    expect(adaptChatBiEvent(raw('tool.finished', 3)).diagnostic?.code).toBe('invalid_event')
  })

  it('keeps heartbeat out of canonical activities', () => {
    expect(adaptChatBiEvent(raw('heartbeat', 3)).diagnostic?.code).toBe('unsupported_event')
  })
})

import type { AgentError, CanonicalEvent } from '@agentic-chat/core'
import type { AdapterCapabilities } from '@agentic-chat/runtime'

export const chatBiCapabilities: AdapterCapabilities = {
  send: true,
  sequence: 'strict-per-run',
  replay: 'live-resume',
  cancel: true,
  resume: false,
  retry: false,
  intervention: false,
  artifacts: true,
}

export type ChatBiEventType = 'run.started' | 'thinking.delta' | 'tool.started' | 'tool.finished' | 'result' | 'artifact.created' | 'run.completed' | 'run.failed' | 'run.cancelled' | 'heartbeat'

export interface ChatBiRunEvent {
  protocol_version: '1.0'
  event_id: string
  event_type: ChatBiEventType
  session_id: string
  run_id: string
  sequence: number
  created_at: string
  tool_call_id: string | null
  payload: Record<string, unknown>
}

export interface AdapterDiagnostic {
  code: 'unsupported_event' | 'invalid_event'
  message: string
}

export interface AdaptResult {
  event?: CanonicalEvent
  diagnostic?: AdapterDiagnostic
}

const envelope = (event: ChatBiRunEvent) => ({
  schemaVersion: '0.1' as const,
  eventId: event.event_id,
  threadId: event.session_id,
  runId: event.run_id,
  sequence: event.sequence,
  timestamp: event.created_at,
  source: 'chatbi' as const,
})

const errorFrom = (payload: Record<string, unknown>): AgentError => ({
  code: 'chatbi.run_failed',
  message: typeof payload.message === 'string' ? payload.message : 'ChatBI run failed',
})

export function adaptChatBiEvent(event: ChatBiRunEvent): AdaptResult {
  const base = envelope(event)
  switch (event.event_type) {
    case 'run.started': return { event: { ...base, type: 'run.started', data: {} } }
    case 'thinking.delta': return {
      event: { ...base, type: 'source.observed', data: { sourceType: event.event_type } },
      diagnostic: { code: 'unsupported_event', message: 'thinking.delta visibility is unspecified and is hidden by default' },
    }
    case 'tool.started': {
      if (!event.tool_call_id) return { diagnostic: { code: 'invalid_event', message: 'tool.started requires tool_call_id' } }
      return { event: { ...base, type: 'tool.started', data: { activityId: `tool:${event.tool_call_id}`, toolCallId: event.tool_call_id, name: typeof event.payload.tool_name === 'string' ? event.payload.tool_name : 'unknown' } } }
    }
    case 'tool.finished': {
      if (!event.tool_call_id) return { diagnostic: { code: 'invalid_event', message: 'tool.finished requires tool_call_id' } }
      return event.payload.ok === false
        ? { event: { ...base, type: 'tool.failed', data: { toolCallId: event.tool_call_id, error: errorFrom(event.payload) } } }
        : { event: { ...base, type: 'tool.completed', data: { toolCallId: event.tool_call_id, output: event.payload } } }
    }
    case 'result': return { event: { ...base, type: 'result.available', data: { result: event.payload } } }
    case 'run.completed': return { event: { ...base, type: 'run.completed', data: {} } }
    case 'run.failed': return { event: { ...base, type: 'run.failed', data: { error: errorFrom(event.payload) } } }
    case 'run.cancelled': return { event: { ...base, type: 'run.cancelled', data: {} } }
    case 'heartbeat':
    case 'artifact.created':
      return {
        event: { ...base, type: 'source.observed', data: { sourceType: event.event_type } },
        diagnostic: { code: 'unsupported_event', message: `${event.event_type} is preserved but not modeled in the P0 canonical slice` },
      }
  }
}

export * from './client.js'

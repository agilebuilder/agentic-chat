import type { CanonicalEvent } from '@agentic-chat/core'
import type { AdapterCapabilities } from '@agentic-chat/runtime'

export const agUiCapabilities: AdapterCapabilities = {
  send: false,
  sequence: 'synthesized-stream-order',
  replay: 'none',
  cancel: false,
  resume: false,
  retry: false,
  intervention: false,
  artifacts: false,
}

export type AgUiEvent =
  | { type: 'RUN_STARTED'; threadId: string; runId: string; timestamp?: number }
  | { type: 'RUN_FINISHED'; threadId: string; runId: string; timestamp?: number }
  | { type: 'RUN_ERROR'; message: string; code?: string; timestamp?: number }
  | { type: 'TEXT_MESSAGE_START'; messageId: string; role: string; timestamp?: number }
  | { type: 'TEXT_MESSAGE_CONTENT'; messageId: string; delta: string; timestamp?: number }
  | { type: 'TEXT_MESSAGE_END'; messageId: string; timestamp?: number }
  | { type: 'TOOL_CALL_START'; toolCallId: string; toolCallName: string; parentMessageId?: string; timestamp?: number }
  | { type: 'TOOL_CALL_ARGS'; toolCallId: string; delta: string; timestamp?: number }
  | { type: 'TOOL_CALL_END'; toolCallId: string; timestamp?: number }
  | { type: 'TOOL_CALL_RESULT'; messageId: string; toolCallId: string; content: string; timestamp?: number }
  | { type: 'STATE_SNAPSHOT'; snapshot: unknown; timestamp?: number }

export interface AgUiAdaptResult {
  events: CanonicalEvent[]
  diagnostics: Array<{ code: 'missing_run_context'; message: string; sourceIndex: number }>
}

export function adaptAgUiEvents(sourceEvents: readonly AgUiEvent[]): AgUiAdaptResult {
  const events: CanonicalEvent[] = []
  const diagnostics: AgUiAdaptResult['diagnostics'] = []
  let threadId: string | undefined
  let runId: string | undefined

  sourceEvents.forEach((source, index) => {
    if (source.type === 'RUN_STARTED') ({ threadId, runId } = source)
    if (!threadId || !runId) {
      diagnostics.push({ code: 'missing_run_context', message: `${source.type} arrived before RUN_STARTED`, sourceIndex: index })
      return
    }
    const base = { schemaVersion: '0.1' as const, eventId: `ag-ui:${runId}:${index + 1}`, threadId, runId, sequence: index + 1, timestamp: source.timestamp ? new Date(source.timestamp).toISOString() : `2026-07-13T00:00:${String(index).padStart(2, '0')}Z`, source: 'ag-ui' as const }
    switch (source.type) {
      case 'RUN_STARTED': events.push({ ...base, type: 'run.started', data: {} }); break
      case 'RUN_FINISHED': events.push({ ...base, type: 'run.completed', data: {} }); break
      case 'RUN_ERROR': events.push({ ...base, type: 'run.failed', data: { error: { code: source.code ?? 'ag_ui.run_error', message: source.message } } }); break
      case 'TEXT_MESSAGE_CONTENT': events.push({ ...base, type: 'result.delta', data: { delta: source.delta } }); break
      case 'TOOL_CALL_START': events.push({ ...base, type: 'tool.started', data: { activityId: `tool:${source.toolCallId}`, toolCallId: source.toolCallId, name: source.toolCallName } }); break
      case 'TOOL_CALL_ARGS': events.push({ ...base, type: 'tool.args.delta', data: { toolCallId: source.toolCallId, delta: source.delta } }); break
      case 'TOOL_CALL_RESULT': events.push({ ...base, type: 'tool.completed', data: { toolCallId: source.toolCallId, output: source.content } }); break
      default: events.push({ ...base, type: 'source.observed', data: { sourceType: source.type } })
    }
  })
  return { events, diagnostics }
}

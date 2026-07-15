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

interface AgUiBaseEvent { timestamp?: number; rawEvent?: unknown }
export type AgUiEvent = AgUiBaseEvent & (
  | { type: 'RUN_STARTED'; threadId: string; runId: string; parentRunId?: string; input?: unknown }
  | { type: 'RUN_FINISHED'; threadId: string; runId: string; result?: unknown }
  | { type: 'RUN_ERROR'; message: string; code?: string }
  | { type: 'STEP_STARTED'; stepName: string }
  | { type: 'STEP_FINISHED'; stepName: string }
  | { type: 'TEXT_MESSAGE_START'; messageId: string; role: string }
  | { type: 'TEXT_MESSAGE_CONTENT'; messageId: string; delta: string }
  | { type: 'TEXT_MESSAGE_END'; messageId: string }
  | { type: 'TOOL_CALL_START'; toolCallId: string; toolCallName: string; parentMessageId?: string }
  | { type: 'TOOL_CALL_ARGS'; toolCallId: string; delta: string }
  | { type: 'TOOL_CALL_END'; toolCallId: string }
  | { type: 'TOOL_CALL_RESULT'; messageId: string; toolCallId: string; content: string; role?: string }
  | { type: 'STATE_SNAPSHOT'; snapshot: unknown }
  | { type: 'STATE_DELTA'; delta: readonly unknown[] }
  | { type: 'MESSAGES_SNAPSHOT'; messages: readonly unknown[] }
  | { type: 'ACTIVITY_SNAPSHOT'; messageId: string; activityType: string; content: unknown; replace?: boolean }
  | { type: 'ACTIVITY_DELTA'; messageId: string; activityType: string; patch: readonly unknown[] }
  | { type: 'REASONING_START'; messageId: string }
  | { type: 'REASONING_MESSAGE_START'; messageId: string; role: 'reasoning' }
  | { type: 'REASONING_MESSAGE_CONTENT'; messageId: string; delta: string }
  | { type: 'REASONING_MESSAGE_END'; messageId: string }
  | { type: 'REASONING_END'; messageId: string }
  | { type: 'REASONING_ENCRYPTED_VALUE'; subtype: 'message' | 'tool-call'; entityId: string; encryptedValue: string }
  | { type: 'RAW'; event: unknown; source?: string }
  | { type: 'CUSTOM'; name: string; value: unknown }
)

export interface AgUiAdapterDiagnostic {
  code: 'missing_run_context' | 'invalid_event' | 'unsupported_event'
  message: string
  sourceIndex: number
}

export interface AgUiAdaptResult {
  events: CanonicalEvent[]
  diagnostics: AgUiAdapterDiagnostic[]
}

const deterministicEpoch = Date.parse('2026-07-13T00:00:00.000Z')

/**
 * Adapts one ordered AG-UI run stream. Canonical sequence numbers describe the
 * emitted stream order; they are not durable AG-UI replay cursors.
 */
export function adaptAgUiEvents(sourceEvents: readonly AgUiEvent[]): AgUiAdaptResult {
  const events: CanonicalEvent[] = []
  const diagnostics: AgUiAdapterDiagnostic[] = []
  let threadId: string | undefined
  let runId: string | undefined
  const messageRoles = new Map<string, string>()
  const toolPhases = new Map<string, 'arguments' | 'awaiting_result'>()
  const openSteps = new Map<string, string>()

  const diagnose = (code: AgUiAdapterDiagnostic['code'], message: string, sourceIndex: number) => {
    diagnostics.push({ code, message, sourceIndex })
  }

  sourceEvents.forEach((source, sourceIndex) => {
    const sourceType = source.type as string
    const hadRunContext = threadId !== undefined || runId !== undefined
    if (source.type === 'RUN_STARTED') {
      if (typeof source.threadId !== 'string' || typeof source.runId !== 'string') {
        diagnose('invalid_event', 'RUN_STARTED requires threadId and runId', sourceIndex)
        return
      }
      if (hadRunContext) diagnose('invalid_event', 'RUN_STARTED repeated within one AG-UI run stream', sourceIndex)
      else {
        threadId = source.threadId
        runId = source.runId
      }
    }
    if (!threadId || !runId) {
      diagnose('missing_run_context', `${sourceType} arrived before RUN_STARTED`, sourceIndex)
      return
    }

    const fallbackTimestamp = deterministicEpoch + sourceIndex * 1000
    const suppliedTimestamp = source.timestamp
    if (suppliedTimestamp !== undefined && !Number.isFinite(suppliedTimestamp)) {
      diagnose('invalid_event', `${sourceType} has an invalid timestamp`, sourceIndex)
    }
    const base = {
      schemaVersion: '0.1' as const,
      eventId: `ag-ui:${runId}:${events.length + 1}`,
      threadId,
      runId,
      sequence: events.length + 1,
      timestamp: new Date(suppliedTimestamp !== undefined && Number.isFinite(suppliedTimestamp) ? suppliedTimestamp : fallbackTimestamp).toISOString(),
      source: 'ag-ui' as const,
    }
    const observed = (): CanonicalEvent => ({ ...base, type: 'source.observed', data: { sourceType } })

    switch (source.type) {
      case 'RUN_STARTED':
        events.push(hadRunContext ? observed() : { ...base, type: 'run.started', data: {} })
        break
      case 'RUN_FINISHED':
        if (source.threadId !== threadId || source.runId !== runId) {
          diagnose('invalid_event', 'RUN_FINISHED context does not match RUN_STARTED', sourceIndex)
          events.push(observed())
        } else {
          if (source.result !== undefined) {
            events.push({ ...base, type: 'result.available', data: { kind: 'ag-ui.run-result', result: source.result } })
          }
          events.push({
            ...base,
            eventId: `ag-ui:${runId}:${events.length + 1}`,
            sequence: events.length + 1,
            type: 'run.completed',
            data: {},
          })
        }
        break
      case 'RUN_ERROR':
        events.push({ ...base, type: 'run.failed', data: { error: { code: source.code ?? 'ag_ui.run_error', message: source.message } } })
        break
      case 'STEP_STARTED': { // AG-UI pairs steps by name; source index disambiguates retries.
        const activityId = `step:${sourceIndex}:${source.stepName}`
        if (openSteps.has(source.stepName)) {
          diagnose('invalid_event', `Concurrent steps named ${source.stepName} cannot be correlated by AG-UI`, sourceIndex)
          events.push(observed())
        } else {
          openSteps.set(source.stepName, activityId)
          events.push({ ...base, type: 'activity.started', data: { activityId, kind: 'workflow', title: source.stepName } })
        }
        break
      }
      case 'STEP_FINISHED': {
        const activityId = openSteps.get(source.stepName)
        if (!activityId) {
          diagnose('invalid_event', `STEP_FINISHED has no matching STEP_STARTED for ${source.stepName}`, sourceIndex)
          events.push(observed())
        } else {
          openSteps.delete(source.stepName)
          events.push({ ...base, type: 'activity.completed', data: { activityId } })
        }
        break
      }
      case 'TEXT_MESSAGE_START':
        if (messageRoles.has(source.messageId)) diagnose('invalid_event', `TEXT_MESSAGE_START repeated for ${source.messageId}`, sourceIndex)
        else messageRoles.set(source.messageId, source.role)
        events.push(observed())
        break
      case 'TEXT_MESSAGE_CONTENT':
        if (!messageRoles.has(source.messageId)) {
          diagnose('invalid_event', `TEXT_MESSAGE_CONTENT has no matching start for ${source.messageId}`, sourceIndex)
          events.push(observed())
        } else if (messageRoles.get(source.messageId) === 'assistant') {
          events.push({ ...base, type: 'result.delta', data: { delta: source.delta } })
        } else events.push(observed())
        break
      case 'TEXT_MESSAGE_END':
        if (!messageRoles.delete(source.messageId)) diagnose('invalid_event', `TEXT_MESSAGE_END has no matching start for ${source.messageId}`, sourceIndex)
        events.push(observed())
        break
      case 'TOOL_CALL_START':
        if (toolPhases.has(source.toolCallId)) {
          diagnose('invalid_event', `TOOL_CALL_START repeated for ${source.toolCallId}`, sourceIndex)
          events.push(observed())
        } else {
          toolPhases.set(source.toolCallId, 'arguments')
          events.push({ ...base, type: 'tool.started', data: { activityId: `tool:${source.toolCallId}`, toolCallId: source.toolCallId, name: source.toolCallName } })
        }
        break
      case 'TOOL_CALL_ARGS':
        if (toolPhases.get(source.toolCallId) !== 'arguments') {
          diagnose('invalid_event', `TOOL_CALL_ARGS is outside the argument phase for ${source.toolCallId}`, sourceIndex)
          events.push(observed())
        } else events.push({ ...base, type: 'tool.args.delta', data: { toolCallId: source.toolCallId, delta: source.delta } })
        break
      case 'TOOL_CALL_END':
        if (toolPhases.get(source.toolCallId) !== 'arguments') diagnose('invalid_event', `TOOL_CALL_END is outside the argument phase for ${source.toolCallId}`, sourceIndex)
        else toolPhases.set(source.toolCallId, 'awaiting_result')
        // This closes argument streaming; TOOL_CALL_RESULT closes execution.
        events.push(observed())
        break
      case 'TOOL_CALL_RESULT':
        if (!toolPhases.delete(source.toolCallId)) {
          diagnose('invalid_event', `TOOL_CALL_RESULT has no matching start for ${source.toolCallId}`, sourceIndex)
          events.push(observed())
        } else events.push({ ...base, type: 'tool.completed', data: { toolCallId: source.toolCallId, output: source.content } })
        break
      case 'STATE_SNAPSHOT':
      case 'STATE_DELTA':
      case 'MESSAGES_SNAPSHOT':
      case 'ACTIVITY_SNAPSHOT':
      case 'ACTIVITY_DELTA':
      case 'REASONING_START':
      case 'REASONING_MESSAGE_START':
      case 'REASONING_MESSAGE_CONTENT':
      case 'REASONING_MESSAGE_END':
      case 'REASONING_END':
      case 'REASONING_ENCRYPTED_VALUE':
      case 'RAW':
      case 'CUSTOM':
        diagnose('unsupported_event', `${source.type} is preserved but not yet modeled`, sourceIndex)
        events.push(observed())
        break
      default:
        diagnose('unsupported_event', `${sourceType} is not recognized by this adapter version`, sourceIndex)
        events.push(observed())
    }
  })
  return { events, diagnostics }
}

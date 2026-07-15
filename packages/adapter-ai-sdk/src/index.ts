import type { CanonicalEvent } from '@agentic-chat/core'
import type { AdapterCapabilities } from '@agentic-chat/runtime'

export const aiSdkCapabilities: AdapterCapabilities = {
  send: false,
  sequence: 'synthesized-stream-order',
  replay: 'none',
  cancel: false,
  resume: false,
  retry: false,
  intervention: false,
  artifacts: false,
}

/** Structural UI Message Stream v1 chunk; no AI SDK runtime dependency is required. */
export interface AiSdkUIMessageChunk { type: string; [key: string]: unknown }

export interface AiSdkAdapterContext {
  threadId: string
  runId: string
  /** Used only to synthesize deterministic canonical timestamps. */
  startedAt?: string
}

export interface AiSdkAdapterDiagnostic {
  code: 'invalid_event' | 'unsupported_event'
  message: string
  sourceIndex: number
}

export interface AiSdkAdaptResult {
  events: CanonicalEvent[]
  diagnostics: AiSdkAdapterDiagnostic[]
}

const stringField = (chunk: AiSdkUIMessageChunk, key: string): string | undefined => typeof chunk[key] === 'string' && chunk[key] ? chunk[key] as string : undefined

/** Parse one SSE data payload. Comments/keep-alives return undefined; [DONE] returns null. */
export function parseAiSdkSseData(value: string): AiSdkUIMessageChunk | null | undefined {
  const data = value.trim()
  if (!data || data.startsWith(':')) return undefined
  if (data === '[DONE]') return null
  const parsed: unknown = JSON.parse(data)
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) || typeof (parsed as { type?: unknown }).type !== 'string') throw new Error('Invalid AI SDK UI Message Stream chunk')
  return parsed as AiSdkUIMessageChunk
}

/**
 * Adapts one complete AI SDK UI Message Stream v1 message. The transport owns
 * thread/run IDs because the wire chunks intentionally do not carry them.
 */
export function adaptAiSdkUIMessageChunks(chunks: readonly AiSdkUIMessageChunk[], context: AiSdkAdapterContext): AiSdkAdaptResult {
  if (!context.threadId.trim() || !context.runId.trim()) throw new Error('AI SDK adapter requires threadId and runId')
  const epoch = Date.parse(context.startedAt ?? '2026-07-13T02:00:00.000Z')
  if (!Number.isFinite(epoch)) throw new Error('AI SDK adapter startedAt is invalid')
  const events: CanonicalEvent[] = []
  const diagnostics: AiSdkAdapterDiagnostic[] = []
  const tools = new Map<string, { phase: 'input' | 'executing'; name: string; hasDelta: boolean }>()
  const textParts = new Set<string>()
  const reasoningParts = new Set<string>()
  let started = false
  let terminal = false
  let step = 0
  let openStepId: string | undefined

  const emit = (type: CanonicalEvent['type'], data: CanonicalEvent['data']) => {
    const sequence = events.length + 1
    events.push({ schemaVersion: '0.1', eventId: `ai-sdk:${context.runId}:${sequence}`, type, threadId: context.threadId, runId: context.runId, sequence, timestamp: new Date(epoch + (sequence - 1) * 1000).toISOString(), data, source: 'ai-sdk' } as CanonicalEvent)
  }
  const diagnose = (code: AiSdkAdapterDiagnostic['code'], message: string, sourceIndex: number) => diagnostics.push({ code, message, sourceIndex })
  const observed = (sourceType: string) => emit('source.observed', { sourceType })

  chunks.forEach((chunk, sourceIndex) => {
    const type = chunk.type
    if (!started && type !== 'start') {
      diagnose('invalid_event', `${type} arrived before start`, sourceIndex)
      return
    }
    if (terminal) {
      diagnose('invalid_event', `${type} arrived after a terminal chunk`, sourceIndex)
      return
    }
    switch (type) {
      case 'start':
        if (started) { diagnose('invalid_event', 'start repeated within one message stream', sourceIndex); observed(type) }
        else { started = true; emit('run.started', {}) }
        break
      case 'start-step':
        if (openStepId) { diagnose('invalid_event', 'start-step arrived before the previous step finished', sourceIndex); observed(type); break }
        openStepId = `step:${step++}`
        emit('activity.started', { activityId: openStepId, kind: 'workflow', title: `Model step ${step}` })
        break
      case 'finish-step':
        if (!openStepId) { diagnose('invalid_event', 'finish-step has no matching start-step', sourceIndex); observed(type); break }
        emit('activity.completed', { activityId: openStepId })
        openStepId = undefined
        break
      case 'text-start': { const id = stringField(chunk, 'id'); if (!id || textParts.has(id)) { diagnose('invalid_event', 'text-start requires a new id', sourceIndex); observed(type) } else { textParts.add(id); observed(type) } break }
      case 'text-delta': { const id = stringField(chunk, 'id'); const delta = stringField(chunk, 'delta'); if (!id || !textParts.has(id) || delta === undefined) { diagnose('invalid_event', 'text-delta requires an open id and delta', sourceIndex); observed(type) } else emit('result.delta', { delta }); break }
      case 'text-end': { const id = stringField(chunk, 'id'); if (!id || !textParts.delete(id)) diagnose('invalid_event', 'text-end requires an open id', sourceIndex); observed(type); break }
      case 'tool-input-start': { const id = stringField(chunk, 'toolCallId'); const name = stringField(chunk, 'toolName'); if (!id || !name || tools.has(id)) { diagnose('invalid_event', 'tool-input-start requires a new toolCallId and toolName', sourceIndex); observed(type) } else { tools.set(id, { phase: 'input', name, hasDelta: false }); emit('tool.started', { activityId: `tool:${id}`, toolCallId: id, name, ...(openStepId ? { parentActivityId: openStepId } : {}) }) } break }
      case 'tool-input-delta': { const id = stringField(chunk, 'toolCallId'); const delta = stringField(chunk, 'inputTextDelta'); const tool = id ? tools.get(id) : undefined; if (!id || !tool || tool.phase !== 'input' || delta === undefined) { diagnose('invalid_event', 'tool-input-delta requires a tool in its input phase', sourceIndex); observed(type) } else { tool.hasDelta = true; emit('tool.args.delta', { toolCallId: id, delta }) } break }
      case 'tool-input-available': { const id = stringField(chunk, 'toolCallId'); const name = stringField(chunk, 'toolName'); if (!id || !name) { diagnose('invalid_event', 'tool-input-available requires toolCallId and toolName', sourceIndex); observed(type); break } const existing = tools.get(id); if (!existing) { tools.set(id, { phase: 'executing', name, hasDelta: false }); emit('tool.started', { activityId: `tool:${id}`, toolCallId: id, name, input: chunk.input, ...(openStepId ? { parentActivityId: openStepId } : {}) }) } else if (existing.phase !== 'input' || existing.name !== name) { diagnose('invalid_event', `tool-input-available is incompatible with ${id}`, sourceIndex); observed(type) } else { existing.phase = 'executing'; observed(type) } break }
      case 'tool-output-available': { const id = stringField(chunk, 'toolCallId'); const tool = id ? tools.get(id) : undefined; if (!id || !tool) { diagnose('invalid_event', 'tool-output-available has no matching tool input', sourceIndex); observed(type) } else { tools.delete(id); emit('tool.completed', { toolCallId: id, output: chunk.output }) } break }
      case 'tool-output-error': { const id = stringField(chunk, 'toolCallId'); const tool = id ? tools.get(id) : undefined; if (!id || !tool) { diagnose('invalid_event', 'tool-output-error has no matching tool input', sourceIndex); observed(type) } else { tools.delete(id); emit('tool.failed', { toolCallId: id, error: { code: 'ai_sdk.tool_error', message: stringField(chunk, 'errorText') ?? 'AI SDK tool failed' } }) } break }
      case 'reasoning-start': { const id = stringField(chunk, 'id'); if (id) reasoningParts.add(id); diagnose('unsupported_event', 'Reasoning is hidden until visibility semantics are configured', sourceIndex); observed(type); break }
      case 'reasoning-delta':
      case 'reasoning-end': { const id = stringField(chunk, 'id'); if (type === 'reasoning-end' && id) reasoningParts.delete(id); diagnose('unsupported_event', 'Reasoning is hidden until visibility semantics are configured', sourceIndex); observed(type); break }
      case 'finish':
        if (tools.size || textParts.size || reasoningParts.size || openStepId) diagnose('invalid_event', 'finish arrived with open stream parts', sourceIndex)
        terminal = true
        emit('run.completed', {})
        break
      case 'abort': terminal = true; emit('run.cancelled', {}); break
      case 'error': terminal = true; emit('run.failed', { error: { code: 'ai_sdk.stream_error', message: stringField(chunk, 'errorText') ?? 'AI SDK stream failed' } }); break
      default:
        diagnose('unsupported_event', `${type} is preserved but not modeled`, sourceIndex)
        observed(type)
    }
  })
  return { events, diagnostics }
}

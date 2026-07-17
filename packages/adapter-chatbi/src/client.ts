import { createRuntime, type AgenticRuntime, type CommandReceipt } from '@agentic-chat/runtime'
import { adaptChatBiEvent, chatBiCapabilities, type ChatBiRunEvent } from './index.js'

/** @public */
export interface ChatBiRun {
  id: string
  session_id: string
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled'
  created_at?: string
}

/** @public */
export interface ChatBiTarget {
  source_id?: string
  dataset_id?: string
}

/** @public */
export interface ChatBiClientOptions {
  baseUrl?: string
  fetch?: typeof globalThis.fetch
}

/** @public */
export interface StreamOptions {
  afterSequence?: number
  signal?: AbortSignal
  onOpen?(): void
  onEvent(event: ChatBiRunEvent): void
}

const parseEvent = (value: unknown): ChatBiRunEvent => {
  if (typeof value !== 'object' || value === null) throw new Error('Invalid ChatBI event')
  const event = value as Partial<ChatBiRunEvent>
  if (event.protocol_version !== '1.0' || typeof event.event_id !== 'string' || typeof event.event_type !== 'string' || typeof event.session_id !== 'string' || typeof event.run_id !== 'string' || typeof event.sequence !== 'number' || typeof event.created_at !== 'string' || typeof event.payload !== 'object' || event.payload === null) {
    throw new Error('Incompatible ChatBI event protocol')
  }
  return event as ChatBiRunEvent
}

/** @public */
export function parseChatBiSseBuffer(buffer: string): { events: ChatBiRunEvent[]; remainder: string } {
  const blocks = buffer.split(/\r?\n\r?\n/)
  const remainder = blocks.pop() ?? ''
  const events: ChatBiRunEvent[] = []
  for (const block of blocks) {
    const data = block.split(/\r?\n/).filter((line) => line.startsWith('data:')).map((line) => line.slice(5).trimStart()).join('\n')
    if (data) events.push(parseEvent(JSON.parse(data) as unknown))
  }
  return { events, remainder }
}

/** @public */
export class ChatBiClient {
  readonly #baseUrl: string
  readonly #fetch: typeof globalThis.fetch

  constructor(options: ChatBiClientOptions = {}) {
    this.#baseUrl = (options.baseUrl ?? '/api/v1').replace(/\/$/, '')
    this.#fetch = options.fetch ?? globalThis.fetch.bind(globalThis)
  }

  async #request<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await this.#fetch(`${this.#baseUrl}${path}`, { ...init, headers: { 'Content-Type': 'application/json', ...init?.headers } })
    if (!response.ok) throw new Error(`ChatBI request failed: ${response.status}`)
    return response.json() as Promise<T>
  }

  createRun(sessionId: string, message: string, target: ChatBiTarget, idempotencyKey: string): Promise<ChatBiRun> {
    return this.#request(`/sessions/${sessionId}/runs`, { method: 'POST', headers: { 'Idempotency-Key': idempotencyKey }, body: JSON.stringify({ message, ...target }) })
  }

  cancelRun(sessionId: string, runId: string): Promise<ChatBiRun> {
    return this.#request(`/sessions/${sessionId}/runs/${runId}/cancel`, { method: 'POST' })
  }

  async streamRunEvents(sessionId: string, runId: string, options: StreamOptions): Promise<void> {
    const response = await this.#fetch(`${this.#baseUrl}/sessions/${sessionId}/runs/${runId}/events?after_sequence=${options.afterSequence ?? 0}`, { headers: { Accept: 'text/event-stream' }, ...(options.signal ? { signal: options.signal } : {}) })
    if (!response.ok || !response.body) throw new Error(`ChatBI event stream failed: ${response.status}`)
    const reader = response.body.getReader()
    options.onOpen?.()
    const decoder = new TextDecoder()
    let buffer = ''
    while (true) {
      const { value, done } = await reader.read()
      buffer += decoder.decode(value, { stream: !done })
      const parsed = parseChatBiSseBuffer(buffer)
      buffer = parsed.remainder
      parsed.events.forEach(options.onEvent)
      if (done) return
    }
  }
}

/** @public */
export interface ChatBiControllerOptions extends ChatBiClientOptions {
  sessionId: string
  target: ChatBiTarget
  maxReconnectAttempts?: number
  reconnectDelayMs?: number
}

/** @public */
export interface ChatBiController {
  runtime: AgenticRuntime
  start(message: string, signal?: AbortSignal, idempotencyKey?: string): Promise<string>
  connect(runId: string, signal?: AbortSignal): Promise<void>
  waitForRun(runId: string): Promise<void>
  cancel(runId: string): Promise<void>
}

/** @public */
export function createChatBiController(options: ChatBiControllerOptions): ChatBiController {
  const client = new ChatBiClient(options)
  const commands = {
    send: async (input: unknown, idempotencyKey: string): Promise<CommandReceipt> => {
      const message = typeof input === 'string' ? input : typeof input === 'object' && input !== null && typeof (input as { message?: unknown }).message === 'string' ? (input as { message: string }).message : undefined
      if (!message) throw new Error('ChatBI send requires a message')
      const run = await client.createRun(options.sessionId, message, options.target, idempotencyKey)
      return { commandId: run.id, accepted: true }
    },
    cancelRun: async (runId: string) => { await client.cancelRun(options.sessionId, runId) },
  }
  const runtime = createRuntime({ capabilities: chatBiCapabilities, commands })
  const completions = new Map<string, Promise<void>>()
  const settledCompletions = new Map<string, { ok: true } | { ok: false; error: unknown }>()

  const rememberSettledCompletion = (runId: string, result: { ok: true } | { ok: false; error: unknown }) => {
    settledCompletions.delete(runId)
    settledCompletions.set(runId, result)
    while (settledCompletions.size > 100) {
      const oldestRunId = settledCompletions.keys().next().value as string | undefined
      if (oldestRunId === undefined) break
      settledCompletions.delete(oldestRunId)
    }
  }

  const trackCompletion = (runId: string, completion: Promise<void>) => {
    completions.set(runId, completion)
    void completion.then(
      () => {
        if (completions.get(runId) === completion) completions.delete(runId)
        rememberSettledCompletion(runId, { ok: true })
      },
      (error: unknown) => {
        if (completions.get(runId) === completion) completions.delete(runId)
        rememberSettledCompletion(runId, { ok: false, error })
      },
    )
  }

  const connect = async (runId: string, signal?: AbortSignal): Promise<void> => {
    const maxAttempts = options.maxReconnectAttempts ?? 3
    let attempt = 0
    while (true) {
      attempt += 1
      runtime.setConnection({ status: attempt === 1 ? 'connecting' : 'reconnecting', attempt })
      try {
        const afterSequence = runtime.getState().streams[runId]?.lastSequence ?? 0
        await client.streamRunEvents(options.sessionId, runId, {
          afterSequence,
          ...(signal ? { signal } : {}),
          onOpen() {
            runtime.setConnection({ status: 'connected', attempt })
          },
          onEvent(sourceEvent) {
            const adapted = adaptChatBiEvent(sourceEvent)
            if (adapted.event) runtime.dispatch(adapted.event)
            if (adapted.diagnostic) runtime.reportDiagnostic({ source: 'chatbi', ...adapted.diagnostic })
          },
        })
        runtime.setConnection({ status: 'closed', attempt })
        return
      } catch (error) {
        if (signal?.aborted) {
          runtime.setConnection({ status: 'closed', attempt })
          throw error
        }
        if (attempt >= maxAttempts) {
          runtime.setConnection({ status: 'error', attempt, error: error instanceof Error ? error.message : String(error) })
          throw error
        }
        await new Promise((resolve) => setTimeout(resolve, options.reconnectDelayMs ?? 250))
      }
    }
  }

  return {
    runtime,
    async start(message, signal, idempotencyKey = crypto.randomUUID()) {
      const receipt = await runtime.executeCommand('send', () => runtime.commands.send!(message, idempotencyKey))
      runtime.hydrateRun({ id: receipt.commandId, threadId: options.sessionId, status: 'queued', attempt: 1, activityIds: [], createdAt: new Date().toISOString() })
      const completion = connect(receipt.commandId, signal)
      trackCompletion(receipt.commandId, completion)
      void completion.catch(() => undefined)
      return receipt.commandId
    },
    connect,
    async waitForRun(runId) {
      const completion = completions.get(runId)
      if (completion) {
        await completion
        return
      }
      const settled = settledCompletions.get(runId)
      if (settled && !settled.ok) throw settled.error
    },
    async cancel(runId) {
      await runtime.executeCommand(`cancel:${runId}`, () => runtime.commands.cancelRun!(runId))
    },
  }
}

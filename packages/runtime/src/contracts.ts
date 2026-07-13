import type { CanonicalEvent } from '@agentic-chat/core'

export interface AdapterCapabilities {
  send: boolean
  sequence: 'strict-per-run' | 'synthesized-stream-order' | 'unordered'
  replay: 'none' | 'completed-history' | 'live-resume' | 'snapshot-and-delta'
  cancel: boolean
  resume: boolean
  retry: boolean
  intervention: boolean
  artifacts: boolean
}

export interface AdapterContext {
  sourceIndex: number
  threadId?: string
  runId?: string
}

export interface AdapterDiagnostic {
  code: string
  message: string
  source?: unknown
}

export interface AdapterResult {
  events: CanonicalEvent[]
  diagnostics: AdapterDiagnostic[]
}

export interface AgentAdapter<TSourceEvent> {
  readonly id: string
  readonly capabilities: AdapterCapabilities
  adapt(event: TSourceEvent, context: AdapterContext): AdapterResult
}

export interface CommandReceipt {
  commandId: string
  accepted: boolean
}

export interface AgentCommands {
  send?(input: unknown, idempotencyKey: string): Promise<CommandReceipt>
  cancelRun?(runId: string): Promise<void>
  retryRun?(runId: string, idempotencyKey: string): Promise<CommandReceipt>
  respond?(interventionId: string, value: unknown, idempotencyKey: string): Promise<void>
  resumeRun?(runId: string): Promise<void>
}

export type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'closed' | 'error'

export interface ConnectionState {
  status: ConnectionStatus
  attempt: number
  error?: string
}

export interface CommandState {
  status: 'idle' | 'pending' | 'succeeded' | 'failed'
  error?: string
}

export interface RuntimeDiagnostic {
  source: string
  code: string
  message: string
}

export const noCapabilities: AdapterCapabilities = {
  send: false,
  sequence: 'unordered',
  replay: 'none',
  cancel: false,
  resume: false,
  retry: false,
  intervention: false,
  artifacts: false,
}

export function assertCommandCapabilities(capabilities: AdapterCapabilities, commands: AgentCommands): void {
  const pairs = [
    ['send', capabilities.send, commands.send],
    ['cancelRun', capabilities.cancel, commands.cancelRun],
    ['resumeRun', capabilities.resume, commands.resumeRun],
    ['retryRun', capabilities.retry, commands.retryRun],
    ['respond', capabilities.intervention, commands.respond],
  ] as const
  for (const [name, enabled, command] of pairs) {
    if (enabled !== (command !== undefined)) throw new Error(`Capability/command mismatch for ${name}`)
  }
}

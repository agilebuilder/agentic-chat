import type { CanonicalEvent } from '@agentic-chat/core'

export interface AdapterCapabilities {
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
  send(input: unknown, idempotencyKey: string): Promise<CommandReceipt>
  cancelRun?(runId: string): Promise<void>
  retryRun?(runId: string, idempotencyKey: string): Promise<CommandReceipt>
  respond?(interventionId: string, value: unknown, idempotencyKey: string): Promise<void>
  resumeRun?(runId: string): Promise<void>
}

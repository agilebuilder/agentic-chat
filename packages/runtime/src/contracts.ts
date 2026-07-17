import type { CanonicalEvent } from '@agentic-chat/core'

/** @public */
export interface AdapterCapabilities {
  send: boolean
  sequence: 'strict-per-run' | 'synthesized-stream-order'
  replay: 'none' | 'completed-history' | 'live-resume' | 'snapshot-and-delta'
  cancel: boolean
  resume: boolean
  retry: boolean
  intervention: boolean
  artifacts: boolean
}

/** @public */
export interface AdapterContext {
  sourceIndex: number
  threadId?: string
  runId?: string
}

/** @public */
export interface AdapterDiagnostic {
  code: string
  message: string
  source?: unknown
}

/** @public */
export interface AdapterResult {
  events: CanonicalEvent[]
  diagnostics: AdapterDiagnostic[]
}

/** @public */
export interface AgentAdapter<TSourceEvent> {
  readonly id: string
  readonly capabilities: AdapterCapabilities
  adapt(event: TSourceEvent, context: AdapterContext): AdapterResult
}

/** @public */
export interface CommandReceipt {
  commandId: string
  accepted: boolean
}

/** @public */
export interface AgentCommands {
  send?(input: unknown, idempotencyKey: string): Promise<CommandReceipt>
  cancelRun?(runId: string): Promise<void>
  retryRun?(runId: string, idempotencyKey: string): Promise<CommandReceipt>
  respond?(interventionId: string, value: unknown, idempotencyKey: string): Promise<void>
  resumeRun?(runId: string): Promise<void>
}

/** @public */
export type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'closed' | 'error'

/** @public */
export interface ConnectionState {
  status: ConnectionStatus
  attempt: number
  error?: string
}

/** @public */
export interface CommandState {
  status: 'idle' | 'pending' | 'succeeded' | 'failed'
  error?: string
}

/** @public */
export interface RuntimeDiagnostic {
  source: string
  code: string
  message: string
  runId?: string
  eventId?: string
}

/** @alpha */
export interface ExperimentalInspectedEvent {
  eventId: string
  type: CanonicalEvent['type']
  threadId: string
  runId: string
  sequence: number
  timestamp: string
  source?: string
  outcome: 'applied' | 'ignored' | 'diagnostic'
}

/** @alpha */
export interface ExperimentalInspectedConnection {
  status: ConnectionStatus
  attempt: number
}

/** @alpha */
export interface ExperimentalInspectionSnapshot {
  events: ExperimentalInspectedEvent[]
  connections: ExperimentalInspectedConnection[]
}

/** @alpha */
export interface ExperimentalInspectionOptions {
  /** Maximum retained event envelopes. Event payloads are never captured. */
  maxEvents?: number
  /** Maximum retained connection transitions. Error text is never captured. */
  maxConnections?: number
}

/** @public */
export const noCapabilities: AdapterCapabilities = {
  send: false,
  sequence: 'synthesized-stream-order',
  replay: 'none',
  cancel: false,
  resume: false,
  retry: false,
  intervention: false,
  artifacts: false,
}

/** @public */
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

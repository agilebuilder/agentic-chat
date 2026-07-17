import type { CanonicalEvent } from '@agentic-chat/core'
import type { AgentAdapter, AdapterContext, AdapterResult } from '@agentic-chat/runtime'

export interface AcmeEvent {
  id: string
  type: 'started' | 'completed'
  threadId: string
  runId: string
  sequence: number
  createdAt: string
}

export const acmeAdapter: AgentAdapter<AcmeEvent> = {
  id: 'acme',
  capabilities: { send: false, sequence: 'strict-per-run', replay: 'completed-history', cancel: false, resume: false, retry: false, intervention: false, artifacts: false },
  adapt(source: AcmeEvent, _context: AdapterContext): AdapterResult {
    const envelope = { schemaVersion: '0.1' as const, eventId: source.id, threadId: source.threadId, runId: source.runId, sequence: source.sequence, timestamp: source.createdAt, source: 'acme' }
    const event: CanonicalEvent = source.type === 'started'
      ? { ...envelope, type: 'run.started', data: {} }
      : { ...envelope, type: 'run.completed', data: {} }
    return { events: [event], diagnostics: [] }
  },
}

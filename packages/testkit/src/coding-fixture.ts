import type { CanonicalEvent } from '@agentic-chat/core'

/** @public */
export type CodingFixtureEvent =
  | { type: 'run_started' }
  | { type: 'subagent_started'; id: string; title: string }
  | { type: 'tool_started'; activityId: string; callId: string; name: string; parentId: string }
  | { type: 'tool_finished'; callId: string; output: unknown }
  | { type: 'approval_requested'; id: string; prompt: string; activityId: string }
  | { type: 'approval_resolved'; id: string; response: unknown }
  | { type: 'run_waiting' }
  | { type: 'run_resumed' }
  | { type: 'artifact_created'; id: string; name: string; kind: string; activityId: string }
  | { type: 'artifact_available'; id: string; sizeBytes: number }
  | { type: 'activity_finished'; id: string }
  | { type: 'run_finished' }

/** @public */
export const codingAgentSourceFixture: CodingFixtureEvent[] = [
  { type: 'run_started' },
  { type: 'subagent_started', id: 'subagent-tests', title: '检查测试' },
  { type: 'subagent_started', id: 'subagent-code', title: '检查实现' },
  { type: 'tool_started', activityId: 'tool-test', callId: 'call-test', name: 'shell', parentId: 'subagent-tests' },
  { type: 'tool_finished', callId: 'call-test', output: '4 passed' },
  { type: 'run_waiting' },
  { type: 'approval_requested', id: 'approval-1', prompt: '允许修改文件？', activityId: 'subagent-code' },
  { type: 'approval_resolved', id: 'approval-1', response: 'approved' },
  { type: 'run_resumed' },
  { type: 'artifact_created', id: 'patch-1', name: 'changes.patch', kind: 'text/x-diff', activityId: 'subagent-code' },
  { type: 'artifact_available', id: 'patch-1', sizeBytes: 512 },
  { type: 'activity_finished', id: 'subagent-tests' },
  { type: 'activity_finished', id: 'subagent-code' },
  { type: 'run_finished' },
]

/** @public */
export function adaptCodingFixture(source: readonly CodingFixtureEvent[]): CanonicalEvent[] {
  return source.map((item, index): CanonicalEvent => {
    const base = { schemaVersion: '0.1' as const, eventId: `coding:${index + 1}`, threadId: 'code-thread', runId: 'code-run', sequence: index + 1, timestamp: `2026-07-13T01:00:${String(index).padStart(2, '0')}Z`, source: 'coding-agent-behavioral-fixture' }
    switch (item.type) {
      case 'run_started': return { ...base, type: 'run.started', data: {} }
      case 'subagent_started': return { ...base, type: 'activity.started', data: { activityId: item.id, kind: 'subagent', title: item.title } }
      case 'tool_started': return { ...base, type: 'tool.started', data: { activityId: item.activityId, toolCallId: item.callId, name: item.name, parentActivityId: item.parentId } }
      case 'tool_finished': return { ...base, type: 'tool.completed', data: { toolCallId: item.callId, output: item.output } }
      case 'approval_requested': return { ...base, type: 'intervention.requested', data: { interventionId: item.id, kind: 'approval', prompt: item.prompt, activityId: item.activityId } }
      case 'approval_resolved': return { ...base, type: 'intervention.resolved', data: { interventionId: item.id, response: item.response } }
      case 'run_waiting': return { ...base, type: 'run.status.changed', data: { status: 'awaiting_input' } }
      case 'run_resumed': return { ...base, type: 'run.status.changed', data: { status: 'running' } }
      case 'artifact_created': return { ...base, type: 'artifact.created', data: { artifactId: item.id, name: item.name, kind: item.kind, provenance: { type: 'agent', activityId: item.activityId } } }
      case 'artifact_available': return { ...base, type: 'artifact.available', data: { artifactId: item.id, sizeBytes: item.sizeBytes } }
      case 'activity_finished': return { ...base, type: 'activity.completed', data: { activityId: item.id } }
      case 'run_finished': return { ...base, type: 'run.completed', data: {} }
    }
  })
}

const retryEvent = (runId: string, sequence: number, type: CanonicalEvent['type'], data: CanonicalEvent['data']): CanonicalEvent => ({
  schemaVersion: '0.1', eventId: `coding-retry:${runId}:${sequence}`, threadId: 'code-retry-thread', runId, sequence,
  timestamp: `2026-07-15T04:00:0${sequence}Z`, source: 'coding-agent-behavioral-fixture', type, data,
} as CanonicalEvent)

/** @public */
export const codingAgentRetryAttemptStreams: readonly CanonicalEvent[][] = [
  [
    retryEvent('code-attempt-1', 1, 'run.started', {}),
    retryEvent('code-attempt-1', 2, 'run.failed', { error: { code: 'test_failure', message: 'Tests failed' } }),
  ],
  [
    retryEvent('code-attempt-2', 1, 'run.started', { attempt: 2, retryOfRunId: 'code-attempt-1' }),
    retryEvent('code-attempt-2', 2, 'activity.started', { activityId: 'fix-tests', kind: 'subagent', title: 'Fix tests' }),
    retryEvent('code-attempt-2', 3, 'activity.completed', { activityId: 'fix-tests' }),
    retryEvent('code-attempt-2', 4, 'run.completed', {}),
  ],
]

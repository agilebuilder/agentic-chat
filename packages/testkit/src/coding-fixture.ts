import type { CanonicalEvent } from '@agentic-chat/core'

export type CodingFixtureEvent =
  | { type: 'run_started' }
  | { type: 'subagent_started'; id: string; title: string }
  | { type: 'tool_started'; activityId: string; callId: string; name: string; parentId: string }
  | { type: 'tool_finished'; callId: string; output: unknown }
  | { type: 'approval_requested'; id: string; prompt: string; activityId: string }
  | { type: 'approval_resolved'; id: string; response: unknown }
  | { type: 'activity_finished'; id: string }
  | { type: 'run_finished' }

export const codingAgentSourceFixture: CodingFixtureEvent[] = [
  { type: 'run_started' },
  { type: 'subagent_started', id: 'subagent-tests', title: '检查测试' },
  { type: 'subagent_started', id: 'subagent-code', title: '检查实现' },
  { type: 'tool_started', activityId: 'tool-test', callId: 'call-test', name: 'shell', parentId: 'subagent-tests' },
  { type: 'tool_finished', callId: 'call-test', output: '4 passed' },
  { type: 'approval_requested', id: 'approval-1', prompt: '允许修改文件？', activityId: 'subagent-code' },
  { type: 'approval_resolved', id: 'approval-1', response: 'approved' },
  { type: 'activity_finished', id: 'subagent-tests' },
  { type: 'activity_finished', id: 'subagent-code' },
  { type: 'run_finished' },
]

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
      case 'activity_finished': return { ...base, type: 'activity.completed', data: { activityId: item.id } }
      case 'run_finished': return { ...base, type: 'run.completed', data: {} }
    }
  })
}

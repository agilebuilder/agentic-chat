import { createInitialState, type CanonicalEvent, type RunStatus } from '@agentic-chat/core'
import { createRendererRegistry } from '@agentic-chat/react'
import { AgenticChat, SandboxedArtifactFrame } from '@agentic-chat/react-ui'
import { createRuntime, type AgenticRuntime } from '@agentic-chat/runtime'
import type { Meta, StoryObj } from '@storybook/react-vite'

const threadId = 'storybook-thread'
const runId = 'storybook-run'

function event(
  sequence: number,
  type: CanonicalEvent['type'],
  data: CanonicalEvent['data'],
): CanonicalEvent {
  return {
    schemaVersion: '0.1',
    eventId: `storybook:${sequence}`,
    type,
    threadId,
    runId,
    sequence,
    timestamp: `2026-07-14T02:00:${String(sequence).padStart(2, '0')}Z`,
    data,
    source: 'storybook',
  } as CanonicalEvent
}

function createRunRuntime(status: RunStatus): AgenticRuntime {
  const runtime = createRuntime()
  runtime.dispatch(event(1, 'run.started', {}))
  runtime.dispatch(event(2, 'status.delta', { activityId: 'status-1', content: 'Understanding the request and preparing a plan.' }))
  runtime.dispatch(event(3, 'tool.started', { activityId: 'tool-1', toolCallId: 'call-1', name: 'query_data', input: { metric: 'revenue' } }))

  if (status === 'running') return runtime

  if (status === 'failed') {
    runtime.dispatch(event(4, 'tool.failed', { toolCallId: 'call-1', error: { code: 'UPSTREAM_TIMEOUT', message: 'The data service timed out.' } }))
    runtime.dispatch(event(5, 'run.failed', { error: { code: 'UPSTREAM_TIMEOUT', message: 'The data service timed out.' } }))
    return runtime
  }

  runtime.dispatch(event(4, 'tool.completed', { toolCallId: 'call-1', output: { rows: 12 } }))
  runtime.dispatch(event(5, 'result.available', { kind: 'text', result: 'Revenue increased by 18% compared with the previous period.' }))
  runtime.dispatch(event(6, status === 'cancelled' ? 'run.cancelled' : 'run.completed', {}))
  return runtime
}

const stateRuntimes = {
  empty: createRuntime(),
  running: createRunRuntime('running'),
  completed: createRunRuntime('completed'),
  failed: createRunRuntime('failed'),
  cancelled: createRunRuntime('cancelled'),
}

function State({ status }: { status?: 'running' | 'completed' | 'failed' | 'cancelled' }) {
  const runtime = status ? stateRuntimes[status] : stateRuntimes.empty
  return <main className="story-surface"><div className="story-frame">
    <AgenticChat
      runtime={runtime}
      {...(status ? { runId } : {})}
      onSend={async () => undefined}
      onCancel={async () => undefined}
    />
  </div></main>
}

function createWorkspaceRuntime() {
  const state = createInitialState()
  state.runs[runId] = { id: runId, threadId, status: 'awaiting_input', attempt: 1, activityIds: [], createdAt: '2026-07-14T02:00:00Z' }
  state.tasks['task-1'] = { id: 'task-1', runId, title: 'Inspect the dataset', status: 'completed' }
  state.tasks['task-2'] = { id: 'task-2', runId, title: 'Confirm publication', status: 'blocked' }
  state.taskRevisionByRunId[runId] = 1
  state.artifacts['artifact-1'] = { id: 'artifact-1', runId, name: 'Revenue report.csv', kind: 'text/csv', status: 'available', version: 1, provenance: { type: 'agent' }, createdAt: '2026-07-14T02:00:00Z', uri: 'https://example.invalid/revenue.csv' }
  state.interventions['approval-1'] = { id: 'approval-1', runId, kind: 'approval', status: 'pending', prompt: 'Publish the generated report?', requestedAt: '2026-07-14T02:00:01Z' }
  return createRuntime({ initialState: state })
}

const workspaceRuntime = createWorkspaceRuntime()

function createAdvancedRuntime() {
  const runtime = createRuntime({
    capabilities: { send: false, sequence: 'strict-per-run', replay: 'completed-history', cancel: false, resume: false, retry: true, intervention: false, artifacts: false },
    commands: { retryRun: async () => ({ commandId: 'advanced-run-3', accepted: true }) },
  })
  const dispatch = (advancedRunId: string, sequence: number, type: CanonicalEvent['type'], data: CanonicalEvent['data']) => runtime.dispatch({
    schemaVersion: '0.1', eventId: `${advancedRunId}:${sequence}`, type, threadId, runId: advancedRunId, sequence,
    timestamp: `2026-07-14T03:00:${String(sequence).padStart(2, '0')}Z`, data, source: 'storybook',
  } as CanonicalEvent)
  dispatch('advanced-run-1', 1, 'run.started', {})
  dispatch('advanced-run-1', 2, 'run.failed', { error: { code: 'INITIAL_FAILURE', message: 'Initial attempt failed.' } })
  dispatch('advanced-run-2', 1, 'run.started', { attempt: 2, retryOfRunId: 'advanced-run-1' })
  dispatch('advanced-run-2', 2, 'activity.started', { activityId: 'subagent-tests', kind: 'subagent', title: 'Test agent' })
  dispatch('advanced-run-2', 3, 'activity.started', { activityId: 'subagent-code', kind: 'subagent', title: 'Implementation agent' })
  dispatch('advanced-run-2', 4, 'tool.started', { activityId: 'tool-tests', toolCallId: 'call-tests', name: 'run_tests', parentActivityId: 'subagent-tests' })
  dispatch('advanced-run-2', 5, 'tool.completed', { toolCallId: 'call-tests', output: '75 passed' })
  dispatch('advanced-run-2', 6, 'activity.completed', { activityId: 'subagent-tests' })
  dispatch('advanced-run-2', 7, 'tool.started', { activityId: 'tool-code', toolCallId: 'call-code', name: 'apply_patch', parentActivityId: 'subagent-code' })
  dispatch('advanced-run-2', 8, 'tool.completed', { toolCallId: 'call-code', output: 'Updated 3 files' })
  dispatch('advanced-run-2', 9, 'activity.completed', { activityId: 'subagent-code' })
  dispatch('advanced-run-2', 10, 'run.completed', {})
  return runtime
}

const advancedRuntime = createAdvancedRuntime()

function createHitlRuntime() {
  const runtime = createRuntime({
    capabilities: { send: false, sequence: 'strict-per-run', replay: 'snapshot-and-delta', cancel: false, resume: false, retry: false, intervention: true, artifacts: false },
    commands: { respond: async (interventionId) => { if (interventionId === 'form-permission') throw new Error('没有权限执行此操作') } },
  })
  const dispatch = (sequence: number, type: CanonicalEvent['type'], data: CanonicalEvent['data']) => runtime.dispatch({
    schemaVersion: '0.1', eventId: `hitl:${sequence}`, type, threadId, runId: 'hitl-run', sequence,
    timestamp: `2026-07-15T09:00:${String(sequence).padStart(2, '0')}Z`, data, source: 'storybook',
  } as CanonicalEvent)
  dispatch(1, 'run.started', {})
  dispatch(2, 'run.status.changed', { status: 'awaiting_input' })
  dispatch(3, 'intervention.requested', { interventionId: 'approval-release', kind: 'approval', prompt: '允许发布报告吗？', description: '报告将发布到团队工作区。', risk: '团队成员将能够查看报告内容。', impact: '发布后会通知 12 位成员。', expiresAt: '2026-07-15T10:00:00Z' })
  dispatch(4, 'intervention.requested', { interventionId: 'choice-format', kind: 'choice', prompt: '选择导出格式', options: [{ value: 'csv', label: 'CSV', description: '适合进一步分析' }, { value: 'pdf', label: 'PDF', description: '适合直接分享' }] })
  dispatch(5, 'intervention.requested', { interventionId: 'form-permission', kind: 'form', prompt: '补充发布信息', fields: [{ name: 'title', label: '标题', type: 'text', required: true }, { name: 'audience', label: '可见范围', type: 'select', required: true, options: [{ value: 'team', label: '团队' }, { value: 'private', label: '仅自己' }] }, { name: 'notify', label: '通知成员', type: 'checkbox' }] })
  dispatch(6, 'intervention.requested', { interventionId: 'confirm-restored', kind: 'confirm', prompt: '已恢复的确认记录' })
  dispatch(7, 'intervention.resolved', { interventionId: 'confirm-restored', response: true })
  dispatch(8, 'intervention.requested', { interventionId: 'text-expired', kind: 'text', prompt: '已过期的补充说明', expiresAt: '2026-07-15T10:00:00Z' })
  dispatch(9, 'intervention.expired', { interventionId: 'text-expired' })
  return runtime
}

const hitlRuntime = createHitlRuntime()

function createArtifactRuntime() {
  const runtime = createRuntime({ capabilities: { send: false, sequence: 'strict-per-run', replay: 'snapshot-and-delta', cancel: false, resume: false, retry: false, intervention: false, artifacts: true } })
  const dispatch = (sequence: number, type: CanonicalEvent['type'], data: CanonicalEvent['data']) => runtime.dispatch({
    schemaVersion: '0.1', eventId: `artifact:${sequence}`, type, threadId, runId: 'artifact-run', sequence,
    timestamp: `2026-07-15T10:00:${String(sequence).padStart(2, '0')}Z`, data, source: 'storybook',
  } as CanonicalEvent)
  dispatch(1, 'run.started', {})
  dispatch(2, 'activity.started', { activityId: 'report-step', kind: 'workflow', title: 'Generate report' })
  dispatch(3, 'artifact.created', { artifactId: 'report-v1', name: 'report.html', kind: 'text/html', provenance: { type: 'agent', activityId: 'report-step', label: 'Report agent' } })
  dispatch(4, 'artifact.available', { artifactId: 'report-v1', uri: 'http://127.0.0.1:6007/preview-fixture.html', sizeBytes: 8192, checksum: { algorithm: 'sha256', value: 'demo-checksum' }, expiresAt: '2026-07-16T10:00:00Z' })
  dispatch(5, 'artifact.created', { artifactId: 'report-v2', name: 'report.html', kind: 'text/html', version: 2, previousArtifactId: 'report-v1', provenance: { type: 'agent', activityId: 'report-step' } })
  dispatch(6, 'artifact.failed', { artifactId: 'report-v2', error: { code: 'render_failed', message: 'The updated report could not be rendered.' } })
  dispatch(7, 'artifact.created', { artifactId: 'dataset', name: 'dataset.csv', kind: 'text/csv' })
  dispatch(8, 'artifact.created', { artifactId: 'old-export', name: 'old-export.csv', kind: 'text/csv' })
  dispatch(9, 'artifact.available', { artifactId: 'old-export', uri: 'https://preview.example.invalid/old.csv' })
  dispatch(10, 'artifact.expired', { artifactId: 'old-export' })
  return runtime
}

const artifactRuntime = createArtifactRuntime()
const artifactRenderers = createRendererRegistry()
artifactRenderers.artifactPreview('text/html', ({ artifact }) => <SandboxedArtifactFrame artifact={artifact} allowUri={(uri) => uri === 'http://127.0.0.1:6007/preview-fixture.html'} />)

function WorkspaceState() {
  return <main className="story-surface"><div className="story-frame"><AgenticChat
    runtime={workspaceRuntime}
    runId={runId}
    onSend={async () => undefined}
    onRespond={async () => undefined}
  /></div></main>
}

const meta = {
  title: 'P2 Quality/AgenticChat States',
  component: State,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof State>

export default meta
type Story = StoryObj<typeof meta>

export const Empty: Story = { render: () => <State /> }
export const Running: Story = { render: () => <State status="running" /> }
export const Completed: Story = { render: () => <State status="completed" /> }
export const Failed: Story = { render: () => <State status="failed" /> }
export const Cancelled: Story = { render: () => <State status="cancelled" /> }
export const WorkspacePrimitives: Story = { render: () => <WorkspaceState /> }
export const ParallelSubagents: Story = { render: () => <main className="story-surface"><div className="story-frame"><AgenticChat runtime={advancedRuntime} runId="advanced-run-2" onSend={async () => undefined} onRetry={async () => undefined} /></div></main> }
export const HumanInTheLoop: Story = { render: () => <main className="story-surface"><div className="story-frame"><AgenticChat runtime={hitlRuntime} runId="hitl-run" onSend={async () => undefined} /></div></main> }
export const ArtifactWorkspace: Story = { render: () => <main className="story-surface"><div className="story-frame"><AgenticChat runtime={artifactRuntime} renderers={artifactRenderers} runId="artifact-run" onSend={async () => undefined} /></div></main> }

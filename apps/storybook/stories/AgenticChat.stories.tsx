import { createInitialState, type CanonicalEvent, type RunStatus } from '@agentic-chat/core'
import { AgenticChat } from '@agentic-chat/react-ui'
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
  state.runs[runId] = { id: runId, threadId, status: 'awaiting_input', activityIds: [], createdAt: '2026-07-14T02:00:00Z' }
  state.tasks['task-1'] = { id: 'task-1', runId, title: 'Inspect the dataset', status: 'completed' }
  state.tasks['task-2'] = { id: 'task-2', runId, title: 'Confirm publication', status: 'blocked' }
  state.artifacts['artifact-1'] = { id: 'artifact-1', runId, name: 'Revenue report.csv', kind: 'text/csv', status: 'available', uri: 'https://example.invalid/revenue.csv' }
  state.interventions['approval-1'] = { id: 'approval-1', runId, kind: 'approval', status: 'pending', prompt: 'Publish the generated report?' }
  return createRuntime({ initialState: state })
}

const workspaceRuntime = createWorkspaceRuntime()

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

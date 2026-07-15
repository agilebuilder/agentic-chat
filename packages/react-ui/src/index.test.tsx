import { createRuntime } from '@agentic-chat/runtime'
import { createInitialState, type CanonicalEvent } from '@agentic-chat/core'
import { AgenticChatProvider, createRendererRegistry } from '@agentic-chat/react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { AgenticChat, ArtifactCard, ArtifactPanel, Composer, InterventionPanel, Markdown, MessageList, MessageView, TaskPanel, ThreadList, ToolFallback } from './index.js'

const events: CanonicalEvent[] = [
  { schemaVersion: '0.1', eventId: 'ui-1', type: 'run.started', threadId: 'thread-1', runId: 'run-1', sequence: 1, timestamp: '2026-07-13T00:00:00Z', data: {} },
  { schemaVersion: '0.1', eventId: 'ui-2', type: 'tool.started', threadId: 'thread-1', runId: 'run-1', sequence: 2, timestamp: '2026-07-13T00:00:01Z', data: { activityId: 'activity-1', toolCallId: 'call-1', name: 'query_data_source' } },
  { schemaVersion: '0.1', eventId: 'ui-3', type: 'tool.completed', threadId: 'thread-1', runId: 'run-1', sequence: 3, timestamp: '2026-07-13T00:00:02Z', data: { toolCallId: 'call-1', output: { rows: 1 } } },
]

describe('React default UI', () => {
  it('renders run status and a tool activity from runtime state', () => {
    const runtime = createRuntime()
    events.forEach((event) => runtime.dispatch(event))
    const html = renderToStaticMarkup(<AgenticChat runtime={runtime} runId="run-1" onSend={async () => {}} />)
    expect(html).toContain('运行中')
    expect(html).toContain('query_data_source')
    expect(html).toContain('&quot;rows&quot;: 1')
  })

  it('uses registered tool and result renderers', () => {
    const runtime = createRuntime()
    ;[...events,
      { schemaVersion: '0.1', eventId: 'ui-4', type: 'result.available', threadId: 'thread-1', runId: 'run-1', sequence: 4, timestamp: '2026-07-13T00:00:03Z', data: { kind: 'demo.result', result: { answer: 42 } } } satisfies CanonicalEvent,
    ].forEach((event) => runtime.dispatch(event))
    const renderers = createRendererRegistry()
    renderers.tool('query_data_source', ({ tool }) => <strong>custom tool: {tool.name}</strong>)
    renderers.result('demo.result', ({ content }) => <section>custom result: {(content.value as { answer: number }).answer}</section>)

    const html = renderToStaticMarkup(<AgenticChat runtime={runtime} renderers={renderers} runId="run-1" onSend={async () => {}} />)

    expect(html).toContain('custom tool: query_data_source')
    expect(html).toContain('custom result: 42')
  })

  it('renders registered message and artifact components with stable fallbacks available', () => {
    const initialState = createInitialState()
    initialState.messages.message = { id: 'message', threadId: 'thread-1', role: 'assistant', content: { kind: 'markdown', value: '# answer' }, createdAt: '2026-07-13T00:00:00Z' }
    initialState.artifacts.artifact = { id: 'artifact', runId: 'run-1', name: 'sales.csv', kind: 'text/csv', status: 'available' }
    const runtime = createRuntime({ initialState })
    const renderers = createRendererRegistry()
    renderers.message('markdown', ({ message }) => <p>message: {String(message.content.value)}</p>)
    renderers.artifact('text/csv', ({ artifact }) => <p>artifact: {artifact.name}</p>)

    const html = renderToStaticMarkup(<AgenticChatProvider runtime={runtime} renderers={renderers}><MessageView messageId="message" /><ArtifactCard artifactId="artifact" /></AgenticChatProvider>)

    expect(html).toContain('message: # answer')
    expect(html).toContain('artifact: sales.csv')
  })

  it('renders workspace primitives from normalized state', () => {
    const state = createInitialState()
    state.threads['thread-1'] = { id: 'thread-1', title: '季度分析', messageIds: ['message'], runIds: ['run-1'] }
    state.messages.message = { id: 'message', threadId: 'thread-1', role: 'assistant', content: { kind: 'markdown', value: '**结论**：增长' }, createdAt: '2026-07-13T00:00:00Z' }
    state.tasks.task = { id: 'task', runId: 'run-1', title: '读取数据', status: 'completed' }
    state.artifacts.artifact = { id: 'artifact', runId: 'run-1', name: 'sales.csv', kind: 'text/csv', status: 'available', uri: 'https://example.com/sales.csv' }
    const runtime = createRuntime({ initialState: state })

    const html = renderToStaticMarkup(<AgenticChatProvider runtime={runtime}><ThreadList activeThreadId="thread-1" /><MessageList threadId="thread-1" /><TaskPanel runId="run-1" /><ArtifactPanel runId="run-1" /></AgenticChatProvider>)

    expect(html).toContain('季度分析')
    expect(html).toContain('<strong>结论</strong>')
    expect(html).toContain('读取数据')
    expect(html).toContain('https://example.com/sales.csv')
  })

  it('treats raw HTML and unsafe Markdown links as text', () => {
    const html = renderToStaticMarkup(<Markdown>{'<img src=x onerror="alert(1)">\n\n[危险](javascript:alert(1)) [安全](https://example.com)'}</Markdown>)

    expect(html).toContain('&lt;img src=x onerror=&quot;alert(1)&quot;&gt;')
    expect(html).not.toContain('<img')
    expect(html).not.toContain('javascript:')
    expect(html).toContain('href="https://example.com"')
    expect(html).toContain('rel="noreferrer noopener"')
  })

  it('shows tool input, output, failure details and duration in the fallback', () => {
    const html = renderToStaticMarkup(<ToolFallback mode="full" activity={{ id: 'activity', runId: 'run-1', kind: 'tool', status: 'failed', order: 0 }} tool={{ id: 'tool', runId: 'run-1', activityId: 'activity', name: 'query', status: 'failed', input: { sql: 'select 1' }, output: { rows: 0 }, error: { code: 'timeout', message: 'timed out' }, startedAt: '2026-07-13T00:00:00.000Z', endedAt: '2026-07-13T00:00:01.500Z' }} />)

    expect(html).toContain('1.5 s')
    expect(html).toContain('select 1')
    expect(html).toContain('timed out')
    expect(html).toContain('复制')
  })

  it('renders pending interventions and the extensible composer', () => {
    const state = createInitialState()
    state.interventions.approval = { id: 'approval', runId: 'run-1', kind: 'approval', status: 'pending', prompt: '允许执行查询吗？', requestedAt: '2026-07-13T00:00:00Z' }
    const runtime = createRuntime({ initialState: state })
    const html = renderToStaticMarkup(<AgenticChatProvider runtime={runtime}><InterventionPanel runId="run-1" onRespond={async () => {}} /><Composer running runningStrategy="queue" leadingSlot={<span>前置</span>} trailingSlot={<span>后置</span>} onAttach={() => {}} onSend={async () => {}} /></AgenticChatProvider>)

    expect(html).toContain('允许执行查询吗？')
    expect(html).toContain('批准')
    expect(html).toContain('添加附件')
    expect(html).toContain('前置')
    expect(html).toContain('后置')
  })

  it('renders structured HITL controls and restored terminal states', () => {
    const state = createInitialState()
    state.interventions.choice = { id: 'choice', runId: 'run-1', kind: 'choice', status: 'pending', prompt: '选择格式', requestedAt: '2026-07-13T00:00:00Z', options: [{ value: 'csv', label: 'CSV' }, { value: 'pdf', label: 'PDF' }] }
    state.interventions.form = { id: 'form', runId: 'run-1', kind: 'form', status: 'pending', prompt: '填写信息', requestedAt: '2026-07-13T00:00:01Z', fields: [{ name: 'title', label: '标题', type: 'text', required: true }, { name: 'notify', label: '通知', type: 'checkbox' }] }
    state.interventions.resolved = { id: 'resolved', runId: 'run-1', kind: 'confirm', status: 'resolved', prompt: '已确认', requestedAt: '2026-07-13T00:00:02Z', resolvedAt: '2026-07-13T00:00:03Z', response: true }
    state.interventions.expired = { id: 'expired', runId: 'run-1', kind: 'text', status: 'expired', prompt: '已超时', requestedAt: '2026-07-13T00:00:04Z', expiredAt: '2026-07-13T00:00:05Z' }
    const runtime = createRuntime({ initialState: state })
    const html = renderToStaticMarkup(<AgenticChatProvider runtime={runtime}><InterventionPanel runId="run-1" onRespond={async () => {}} /></AgenticChatProvider>)
    expect(html).toContain('CSV')
    expect(html).toContain('提交选择')
    expect(html).toContain('标题 *')
    expect(html).toContain('提交表单')
    expect(html).toContain('data-state="resolved"')
    expect(html).toContain('已处理')
    expect(html).toContain('data-state="expired"')
    expect(html).toContain('已过期')
    const readOnly = renderToStaticMarkup(<AgenticChatProvider runtime={runtime}><InterventionPanel runId="run-1" /></AgenticChatProvider>)
    expect(readOnly).toContain('当前 Runtime 不支持响应此请求')
  })

  it('groups parallel subagents, nests children, and shows attempt history', () => {
    const runtime = createRuntime()
    const dispatch = (runId: string, sequence: number, type: CanonicalEvent['type'], data: CanonicalEvent['data']) => runtime.dispatch({
      schemaVersion: '0.1', eventId: `${runId}:${sequence}`, type, threadId: 'thread-1', runId, sequence,
      timestamp: `2026-07-15T03:00:0${sequence}Z`, data, source: 'ui-test',
    } as CanonicalEvent)
    dispatch('attempt-1', 1, 'run.started', {})
    dispatch('attempt-1', 2, 'run.failed', { error: { code: 'failed', message: 'Failed' } })
    dispatch('attempt-2', 1, 'run.started', { attempt: 2, retryOfRunId: 'attempt-1' })
    dispatch('attempt-2', 2, 'activity.started', { activityId: 'subagent-a', kind: 'subagent', title: 'Agent A' })
    dispatch('attempt-2', 3, 'activity.started', { activityId: 'subagent-b', kind: 'subagent', title: 'Agent B' })
    dispatch('attempt-2', 4, 'tool.started', { activityId: 'child-tool', toolCallId: 'child-call', name: 'shell', parentActivityId: 'subagent-a' })
    const html = renderToStaticMarkup(<AgenticChat runtime={runtime} runId="attempt-2" onSend={async () => {}} />)
    expect(html).toContain('尝试历史')
    expect(html).toContain('第 2 次尝试')
    expect(html).toContain('Agent A')
    expect(html).toContain('Agent B')
    expect(html).toContain('<details open="">')
    expect(html).toContain('shell')
  })

  it('gates retry action through runtime capability', () => {
    const runtime = createRuntime({
      capabilities: { send: false, sequence: 'strict-per-run', replay: 'completed-history', cancel: false, resume: false, retry: true, intervention: false, artifacts: false },
      commands: { retryRun: async () => ({ commandId: 'attempt-2', accepted: true }) },
    })
    ;[
      { schemaVersion: '0.1', eventId: 'retry-1', type: 'run.started', threadId: 'thread-1', runId: 'attempt-1', sequence: 1, timestamp: '2026-07-15T03:00:00Z', data: {}, source: 'ui-test' },
      { schemaVersion: '0.1', eventId: 'retry-2', type: 'run.failed', threadId: 'thread-1', runId: 'attempt-1', sequence: 2, timestamp: '2026-07-15T03:00:01Z', data: { error: { code: 'failed', message: 'Failed' } }, source: 'ui-test' },
    ].forEach((item) => runtime.dispatch(item as CanonicalEvent))
    const html = renderToStaticMarkup(<AgenticChat runtime={runtime} runId="attempt-1" onSend={async () => {}} onRetry={async () => {}} />)
    expect(html).toContain('>重试</button>')
  })

  it('gates resume action to paused Runs and runtime capability', () => {
    const runtime = createRuntime({
      capabilities: { send: false, sequence: 'strict-per-run', replay: 'snapshot-and-delta', cancel: false, resume: true, retry: false, intervention: false, artifacts: false },
      commands: { resumeRun: async () => undefined },
    })
    runtime.dispatch({ schemaVersion: '0.1', eventId: 'resume-1', type: 'run.started', threadId: 'thread-1', runId: 'paused-run', sequence: 1, timestamp: '2026-07-15T09:00:00Z', data: {} })
    runtime.dispatch({ schemaVersion: '0.1', eventId: 'resume-2', type: 'run.status.changed', threadId: 'thread-1', runId: 'paused-run', sequence: 2, timestamp: '2026-07-15T09:00:01Z', data: { status: 'paused' } })
    const html = renderToStaticMarkup(<AgenticChat runtime={runtime} runId="paused-run" onSend={async () => {}} onResume={async () => {}} />)
    expect(html).toContain('>恢复运行</button>')
  })
})

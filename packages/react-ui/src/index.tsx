import type { AgenticRuntime } from '@agentic-chat/runtime'
import { AgenticChatProvider, useActivity, useArtifact, useCommandState, useConnection, useMessage, useRendererRegistry, useRendererVersion, useRun, useRunActivityIds, useRunResult, useToolCall, type ArtifactRendererProps, type MessageRendererProps, type RendererMode, type RendererRegistry, type ResultRendererProps, type ToolRendererProps } from '@agentic-chat/react'
import { Component, useState, type FormEvent, type ReactNode } from 'react'

const statusLabels = { queued: '排队中', running: '运行中', awaiting_input: '等待操作', paused: '已暂停', completed: '已完成', failed: '失败', cancelled: '已取消' } as const
const toolStatusLabels = { running: '执行中', completed: '已完成', failed: '失败', cancelled: '已取消' } as const

export function RunStatus({ runId }: { runId: string }) {
  const run = useRun(runId)
  if (!run) return null
  return <header className="ac-run-status" data-state={run.status} role="status" aria-live="polite"><span className="ac-status-dot" aria-hidden="true" /><strong>{statusLabels[run.status]}</strong></header>
}

function ActivityRow({ activityId }: { activityId: string }) {
  const activity = useActivity(activityId)
  const tool = useToolCall(activity?.toolCallId ?? '')
  if (!activity) return null
  return <li className="ac-activity" data-kind={activity.kind} data-state={activity.status}>
    <span className="ac-activity-marker" aria-hidden="true" />
    <div className="ac-activity-body">
      {tool ? <RegisteredTool tool={tool} activity={activity} mode="compact" /> : <div className="ac-activity-title">{activity.text ?? activity.kind}</div>}
    </div>
  </li>
}

function RegisteredTool({ tool, activity, mode }: ToolRendererProps) {
  const registry = useRendererRegistry()
  const version = useRendererVersion()
  const Renderer = registry.resolveTool(tool.name)
  const fallback = <ToolFallback tool={tool} activity={activity} mode={mode} />
  return Renderer ? <RendererErrorBoundary key={`${tool.id}:${tool.status}:${version}`} fallback={fallback}><Renderer tool={tool} activity={activity} mode={mode} /></RendererErrorBoundary> : fallback
}

export function ToolFallback({ tool }: ToolRendererProps) {
  return <><div className="ac-activity-title">{tool.name || '工具调用'}</div><div className="ac-tool-summary"><span>{toolStatusLabels[tool.status]}</span>{tool.output !== undefined ? <pre>{stringify(tool.output)}</pre> : null}</div></>
}

export function ActivityTimeline({ runId }: { runId: string }) {
  const activityIds = useRunActivityIds(runId)
  if (activityIds.length === 0) return <div className="ac-empty">等待 Agent 开始执行…</div>
  return <ol className="ac-timeline" aria-label="运行活动">{activityIds.map((id) => <ActivityRow activityId={id} key={id} />)}</ol>
}

export function RunResult({ runId, mode = 'full' }: { runId: string; mode?: RendererMode }) {
  const content = useRunResult(runId)
  const registry = useRendererRegistry()
  const version = useRendererVersion()
  if (content === undefined) return null
  const Renderer = registry.resolveResult(content.kind)
  const props: ResultRendererProps = { runId, content, mode }
  const fallback = <ResultFallback {...props} />
  return Renderer ? <RendererErrorBoundary key={`${content.kind}:${version}`} fallback={fallback}><Renderer {...props} /></RendererErrorBoundary> : fallback
}

export function ResultFallback({ content }: ResultRendererProps) {
  return <section className="ac-result" data-kind={content.kind}><h3>结果</h3><pre>{stringify(content.value)}</pre></section>
}

export function ArtifactCard({ artifactId, mode = 'full' }: { artifactId: string; mode?: RendererMode }) {
  const artifact = useArtifact(artifactId)
  const registry = useRendererRegistry()
  const version = useRendererVersion()
  if (!artifact) return null
  const Renderer = registry.resolveArtifact(artifact.kind)
  const props: ArtifactRendererProps = { artifact, mode }
  const fallback = <ArtifactFallback {...props} />
  return Renderer ? <RendererErrorBoundary key={`${artifact.id}:${artifact.status}:${version}`} fallback={fallback}><Renderer {...props} /></RendererErrorBoundary> : fallback
}

export function ArtifactFallback({ artifact }: ArtifactRendererProps) {
  return <article className="ac-artifact" data-kind={artifact.kind} data-state={artifact.status}><strong>{artifact.name}</strong><span>{artifact.kind} · {artifact.status}</span>{artifact.uri ? <code>{artifact.uri}</code> : null}</article>
}

export function MessageView({ messageId, mode = 'full' }: { messageId: string; mode?: RendererMode }) {
  const message = useMessage(messageId)
  const registry = useRendererRegistry()
  const version = useRendererVersion()
  if (!message) return null
  const Renderer = registry.resolveMessage(message.content.kind)
  const props: MessageRendererProps = { message, mode }
  const fallback = <MessageFallback {...props} />
  return Renderer ? <RendererErrorBoundary key={`${message.id}:${message.content.kind}:${version}`} fallback={fallback}><Renderer {...props} /></RendererErrorBoundary> : fallback
}

export function MessageFallback({ message }: MessageRendererProps) {
  return <article className="ac-message" data-role={message.role} data-kind={message.content.kind}><pre>{stringify(message.content.value)}</pre></article>
}

export function ConnectionNotice() {
  const connection = useConnection()
  if (!['reconnecting', 'error'].includes(connection.status)) return null
  return <div className="ac-connection" role="status">{connection.status === 'reconnecting' ? `连接中断，正在第 ${connection.attempt} 次重连…` : connection.error ?? '连接失败'}</div>
}

export function Composer({ onSend, disabled = false }: { onSend(message: string): Promise<void>; disabled?: boolean }) {
  const [message, setMessage] = useState('')
  const sendState = useCommandState('send')
  const submitting = sendState.status === 'pending'
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const value = message.trim()
    if (!value) return
    await onSend(value)
    setMessage('')
  }
  return <form className="ac-composer" onSubmit={submit}>
    <textarea aria-label="消息" value={message} onChange={(event) => setMessage(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) event.currentTarget.form?.requestSubmit() }} disabled={disabled || submitting} rows={2} />
    <button type="submit" disabled={disabled || submitting || !message.trim()}>{submitting ? '发送中…' : '发送'}</button>
  </form>
}

export interface AgenticChatProps {
  runtime: AgenticRuntime
  renderers?: RendererRegistry
  runId?: string
  onSend(message: string): Promise<void>
  onCancel?(runId: string): Promise<void>
}

export function AgenticChat({ runtime, renderers, runId, onSend, onCancel }: AgenticChatProps) {
  return <AgenticChatProvider runtime={runtime} {...(renderers ? { renderers } : {})}><div className="ac-root">
    <ConnectionNotice />
    {runId ? <><RunStatus runId={runId} /><ActivityTimeline runId={runId} /><RunResult runId={runId} />{onCancel && runtime.capabilities.cancel ? <CancelButton runId={runId} onCancel={onCancel} /> : null}</> : <div className="ac-empty">开始一个新的 Agent 任务</div>}
    <Composer onSend={onSend} />
  </div></AgenticChatProvider>
}

function CancelButton({ runId, onCancel }: { runId: string; onCancel(runId: string): Promise<void> }) {
  const run = useRun(runId)
  const state = useCommandState(`cancel:${runId}`)
  if (!run || !['queued', 'running'].includes(run.status)) return null
  return <button className="ac-cancel" type="button" disabled={state.status === 'pending'} onClick={() => void onCancel(runId)}>{state.status === 'pending' ? '正在停止…' : '停止运行'}</button>
}

const stringify = (value: unknown): string => typeof value === 'string' ? value : JSON.stringify(value, null, 2)

class RendererErrorBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}

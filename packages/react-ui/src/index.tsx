import type { AgenticRuntime, RuntimeSnapshot } from '@agentic-chat/runtime'
import { AgenticChatProvider, useActivity, useArtifact, useCommandState, useConnection, useMessage, useRendererRegistry, useRendererVersion, useRun, useRunActivityIds, useRunResult, useRuntimeSelector, useToolCall, type ArtifactRendererProps, type MessageRendererProps, type RendererMode, type RendererRegistry, type ResultRendererProps, type ToolRendererProps } from '@agentic-chat/react'
import { Component, useId, useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react'
import { Markdown } from './markdown.js'

export { Markdown, type MarkdownProps } from './markdown.js'

const statusLabels = { queued: '排队中', running: '运行中', awaiting_input: '等待操作', paused: '已暂停', completed: '已完成', failed: '失败', cancelled: '已取消' } as const
const toolStatusLabels = { running: '执行中', completed: '已完成', failed: '失败', cancelled: '已取消' } as const

export function RunStatus({ runId }: { runId: string }) {
  const run = useRun(runId)
  if (!run) return null
  return <div className="ac-run-status" data-state={run.status} role="status" aria-live="polite"><span className="ac-status-dot" aria-hidden="true" /><strong>{statusLabels[run.status]}</strong></div>
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
  const duration = getDuration(tool.startedAt, tool.endedAt)
  const hasDetails = tool.input !== undefined || tool.inputText !== undefined || tool.output !== undefined || tool.error !== undefined
  return <><div className="ac-activity-title">{tool.name || '工具调用'}</div><div className="ac-tool-summary">
    <span>{toolStatusLabels[tool.status]}{duration ? ` · ${duration}` : ''}</span>
    {hasDetails ? <details className="ac-tool-details" open={tool.status === 'failed'}><summary>查看调用详情</summary>
      {tool.inputText !== undefined ? <DataBlock label="输入" value={tool.inputText} /> : tool.input !== undefined ? <DataBlock label="输入" value={tool.input} /> : null}
      {tool.output !== undefined ? <DataBlock label="输出" value={tool.output} copyable /> : null}
      {tool.error ? <DataBlock label="错误" value={{ code: tool.error.code, message: tool.error.message, details: tool.error.details }} copyable /> : null}
    </details> : null}
  </div></>
}

function DataBlock({ label, value, copyable = false }: { label: string; value: unknown; copyable?: boolean }) {
  const content = stringify(value)
  return <section className="ac-data-block"><header><strong>{label}</strong>{copyable ? <button type="button" aria-label={`复制${label}`} onClick={() => void copyText(content)}>复制</button> : null}</header><pre>{content}</pre></section>
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
  const value = stringify(message.content.value)
  return <article className="ac-message" data-role={message.role} data-kind={message.content.kind}>{message.content.kind === 'markdown' ? <Markdown>{value}</Markdown> : <pre>{value}</pre>}</article>
}

export function ThreadList({ activeThreadId, onSelect }: { activeThreadId?: string; onSelect?(threadId: string): void }) {
  const threadMap = useRuntimeSelector((snapshot) => snapshot.state.threads)
  const threads = Object.values(threadMap)
  if (threads.length === 0) return <EmptyState title="暂无会话" description="发送第一条消息后，会话会显示在这里。" />
  return <nav className="ac-thread-list" aria-label="会话列表"><ul>{threads.map((thread) => <li key={thread.id}><button type="button" aria-current={thread.id === activeThreadId ? 'page' : undefined} onClick={() => onSelect?.(thread.id)}><strong>{thread.title || '未命名会话'}</strong><span>{thread.messageIds.length} 条消息</span></button></li>)}</ul></nav>
}

export function MessageList({ threadId, empty }: { threadId: string; empty?: ReactNode }) {
  const messageIds = useRuntimeSelector((snapshot) => snapshot.state.threads[threadId]?.messageIds ?? emptyIds)
  if (messageIds.length === 0) return <>{empty ?? <EmptyState title="暂无消息" description="开始一个新的 Agent 任务。" />}</>
  return <section className="ac-message-list" aria-label="消息列表">{messageIds.map((id) => <MessageView key={id} messageId={id} />)}</section>
}

export function TaskPanel({ runId }: { runId: string }) {
  const taskMap = useRuntimeSelector((snapshot) => snapshot.state.tasks)
  const tasks = Object.values(taskMap).filter((task) => task.runId === runId)
  if (tasks.length === 0) return null
  return <section className="ac-panel ac-task-panel" aria-labelledby={`tasks-${runId}`}><h3 id={`tasks-${runId}`}>任务</h3><ol>{tasks.map((task) => <li key={task.id} data-state={task.status}><span className="ac-task-indicator" aria-hidden="true" /><span><strong>{task.title}</strong><small>{task.status}</small></span></li>)}</ol></section>
}

export function ArtifactPanel({ runId }: { runId: string }) {
  const artifactMap = useRuntimeSelector((snapshot) => snapshot.state.artifacts)
  const artifactIds = Object.values(artifactMap).filter((artifact) => artifact.runId === runId).map((artifact) => artifact.id)
  if (artifactIds.length === 0) return null
  return <section className="ac-panel ac-artifact-panel" aria-labelledby={`artifacts-${runId}`}><h3 id={`artifacts-${runId}`}>产物</h3>{artifactIds.map((id) => <ArtifactCard key={id} artifactId={id} mode="compact" />)}</section>
}

export function InterventionPanel({ runId, onRespond }: { runId: string; onRespond(interventionId: string, response: unknown): Promise<void> }) {
  const interventionMap = useRuntimeSelector((snapshot) => snapshot.state.interventions)
  const interventions = Object.values(interventionMap).filter((item) => item.runId === runId && item.status === 'pending')
  if (interventions.length === 0) return null
  return <section className="ac-interventions" aria-label="需要操作">{interventions.map((item) => <InterventionCard key={item.id} intervention={item} onRespond={onRespond} />)}</section>
}

function InterventionCard({ intervention, onRespond }: { intervention: { id: string; kind: string; prompt: string }; onRespond(id: string, response: unknown): Promise<void> }) {
  const [value, setValue] = useState('')
  const [pending, setPending] = useState(false)
  const inputId = useId()
  const respond = async (response: unknown) => { setPending(true); try { await onRespond(intervention.id, response) } finally { setPending(false) } }
  if (intervention.kind === 'confirm' || intervention.kind === 'approval') return <article className="ac-intervention"><p>{intervention.prompt}</p><div><button type="button" disabled={pending} onClick={() => void respond(true)}>确认</button><button type="button" className="ac-secondary" disabled={pending} onClick={() => void respond(false)}>拒绝</button></div></article>
  return <form className="ac-intervention" onSubmit={(event) => { event.preventDefault(); if (value.trim()) void respond(value.trim()) }}><label htmlFor={inputId}>{intervention.prompt}</label><div><input id={inputId} value={value} onChange={(event) => setValue(event.target.value)} disabled={pending} /><button type="submit" disabled={pending || !value.trim()}>提交</button></div></form>
}

export type NoticeTone = 'info' | 'warning' | 'error' | 'success'
export function Notice({ tone = 'info', title, children, action }: { tone?: NoticeTone; title?: string; children?: ReactNode; action?: ReactNode }) {
  return <section className="ac-notice" data-tone={tone} role={tone === 'error' ? 'alert' : 'status'}>{title ? <strong>{title}</strong> : null}{children ? <div>{children}</div> : null}{action ? <div className="ac-notice-action">{action}</div> : null}</section>
}
export function LoadingState({ label = '正在加载…' }: { label?: string }) { return <div className="ac-state" role="status"><span className="ac-spinner" aria-hidden="true" />{label}</div> }
export function EmptyState({ title = '暂无内容', description, action }: { title?: string; description?: string; action?: ReactNode }) { return <section className="ac-state ac-empty-state"><strong>{title}</strong>{description ? <p>{description}</p> : null}{action}</section> }
export function ErrorState({ title = '出现问题', error, onRetry }: { title?: string; error?: string; onRetry?(): void }) { return <Notice tone="error" title={title} action={onRetry ? <button type="button" onClick={onRetry}>重试</button> : undefined}>{error}</Notice> }
export function RecoveryNotice({ message = '连接已恢复，内容已同步。', onDismiss }: { message?: string; onDismiss?(): void }) { return <Notice tone="success" action={onDismiss ? <button type="button" onClick={onDismiss}>知道了</button> : undefined}>{message}</Notice> }

export function ConnectionNotice() {
  const connection = useConnection()
  if (!['reconnecting', 'error'].includes(connection.status)) return null
  return <div className="ac-connection" role="status">{connection.status === 'reconnecting' ? `连接中断，正在第 ${connection.attempt} 次重连…` : connection.error ?? '连接失败'}</div>
}

export interface ComposerProps {
  onSend(message: string): Promise<void>
  disabled?: boolean
  running?: boolean
  runningStrategy?: 'disable' | 'queue' | 'intervene'
  leadingSlot?: ReactNode
  trailingSlot?: ReactNode
  onAttach?(files: readonly File[]): void
  placeholder?: string
}

export function Composer({ onSend, disabled = false, running = false, runningStrategy = 'disable', leadingSlot, trailingSlot, onAttach, placeholder = '输入消息…' }: ComposerProps) {
  const [message, setMessage] = useState('')
  const sendState = useCommandState('send')
  const submitting = sendState.status === 'pending'
  const blocked = disabled || submitting || (running && runningStrategy === 'disable')
  const label = submitting ? '发送中…' : running && runningStrategy === 'queue' ? '加入队列' : running && runningStrategy === 'intervene' ? '发送指令' : '发送'
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const value = message.trim()
    if (!value || blocked) return
    await onSend(value)
    setMessage('')
  }
  return <form className="ac-composer" onSubmit={submit}>
    {leadingSlot}
    {onAttach ? <label className="ac-attach"><span aria-hidden="true">＋</span><span className="ac-sr-only">添加附件</span><input type="file" multiple onChange={(event: ChangeEvent<HTMLInputElement>) => { if (event.target.files?.length) onAttach(Array.from(event.target.files)); event.target.value = '' }} /></label> : null}
    <textarea aria-label="消息" placeholder={placeholder} value={message} onChange={(event) => setMessage(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) event.currentTarget.form?.requestSubmit() }} disabled={blocked} rows={2} />
    {trailingSlot}
    <button type="submit" disabled={blocked || !message.trim()}>{label}</button>
  </form>
}

export interface AgenticChatProps {
  runtime: AgenticRuntime
  renderers?: RendererRegistry
  serverSnapshot?: RuntimeSnapshot
  runId?: string
  onSend(message: string): Promise<void>
  onCancel?(runId: string): Promise<void>
  onRespond?(interventionId: string, response: unknown): Promise<void>
  theme?: 'system' | 'light' | 'dark'
  className?: string
}

export function AgenticChat({ runtime, renderers, serverSnapshot, runId, onSend, onCancel, onRespond, theme = 'system', className }: AgenticChatProps) {
  const rootClassName = ['ac-root', className].filter(Boolean).join(' ')
  return <AgenticChatProvider runtime={runtime} {...(renderers ? { renderers } : {})} {...(serverSnapshot ? { serverSnapshot } : {})}><AgenticChatContent runtime={runtime} rootClassName={rootClassName} theme={theme} onSend={onSend} {...(runId ? { runId } : {})} {...(onCancel ? { onCancel } : {})} {...(onRespond ? { onRespond } : {})} /></AgenticChatProvider>
}

function AgenticChatContent({ runtime, rootClassName, theme, runId, onSend, onCancel, onRespond }: Omit<AgenticChatProps, 'renderers' | 'serverSnapshot' | 'className'> & { rootClassName: string; theme: NonNullable<AgenticChatProps['theme']> }) {
  const run = useRun(runId ?? '')
  const running = !!run && ['queued', 'running', 'awaiting_input', 'paused'].includes(run.status)
  return <div className={rootClassName} data-theme={theme}>
    <ConnectionNotice />
    {runId ? <><RunStatus runId={runId} /><ActivityTimeline runId={runId} /><RunResult runId={runId} /><TaskPanel runId={runId} /><ArtifactPanel runId={runId} />{onRespond ? <InterventionPanel runId={runId} onRespond={onRespond} /> : null}{onCancel && runtime.capabilities.cancel ? <CancelButton runId={runId} onCancel={onCancel} /> : null}</> : <EmptyState title="开始一个新的 Agent 任务" />}
    <Composer onSend={onSend} running={running} />
  </div>
}

function CancelButton({ runId, onCancel }: { runId: string; onCancel(runId: string): Promise<void> }) {
  const run = useRun(runId)
  const state = useCommandState(`cancel:${runId}`)
  if (!run || !['queued', 'running'].includes(run.status)) return null
  return <button className="ac-cancel" type="button" disabled={state.status === 'pending'} onClick={() => void onCancel(runId)}>{state.status === 'pending' ? '正在停止…' : '停止运行'}</button>
}

const stringify = (value: unknown): string => typeof value === 'string' ? value : JSON.stringify(value, null, 2)

export class ErrorBoundary extends Component<{ children: ReactNode; fallback: ReactNode; onError?(error: Error): void }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error: Error) {
    this.props.onError?.(error)
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}

const RendererErrorBoundary = ErrorBoundary
const emptyIds: string[] = []

function getDuration(startedAt: string, endedAt?: string): string | undefined {
  if (!endedAt) return undefined
  const duration = Date.parse(endedAt) - Date.parse(startedAt)
  if (!Number.isFinite(duration) || duration < 0) return undefined
  return duration < 1000 ? `${duration} ms` : `${(duration / 1000).toFixed(duration < 10_000 ? 1 : 0)} s`
}

async function copyText(value: string): Promise<void> {
  if (typeof navigator === 'undefined' || !navigator.clipboard) return
  try { await navigator.clipboard.writeText(value) } catch { /* Host may deny clipboard permission. */ }
}

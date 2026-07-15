import type { Artifact, Intervention, InterventionField } from '@agentic-chat/core'
import { selectRunAttemptHistory, type AgenticRuntime, type RuntimeSnapshot } from '@agentic-chat/runtime'
import { AgenticChatProvider, useActivity, useActivityArtifacts, useArtifact, useArtifactVersionHistory, useChildActivityIds, useCommandState, useConnection, useMessage, useRendererRegistry, useRendererVersion, useRootActivityIds, useRun, useRunArtifacts, useRunResult, useRuntimeSelector, useToolCall, type ArtifactPreviewRenderer, type ArtifactPreviewRendererProps, type ArtifactRendererProps, type MessageRendererProps, type RendererMode, type RendererRegistry, type ResultRendererProps, type ToolRendererProps } from '@agentic-chat/react'
import { Component, useId, useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react'
import { Markdown } from './markdown.js'

export { Markdown, type MarkdownProps } from './markdown.js'

const statusLabels = { queued: '排队中', running: '运行中', awaiting_input: '等待操作', paused: '已暂停', completed: '已完成', failed: '失败', cancelled: '已取消' } as const
const toolStatusLabels = { running: '执行中', completed: '已完成', failed: '失败', cancelled: '已取消' } as const
const activityStatusLabels = { pending: '等待中', running: '执行中', awaiting_input: '等待操作', completed: '已完成', failed: '失败', cancelled: '已取消', skipped: '已跳过' } as const

export function RunStatus({ runId }: { runId: string }) {
  const run = useRun(runId)
  if (!run) return null
  const duration = run.startedAt ? getDuration(run.startedAt, run.endedAt) : undefined
  return <div className="ac-run-status" data-state={run.status} role="status" aria-live="polite"><span className="ac-status-dot" aria-hidden="true" /><strong>{statusLabels[run.status]}</strong>{run.attempt > 1 ? <span>第 {run.attempt} 次尝试</span> : null}{duration ? <span>耗时 {duration}</span> : null}</div>
}

function ActivityRow({ activityId, depth = 0 }: { activityId: string; depth?: number }) {
  const activity = useActivity(activityId)
  const childIds = useChildActivityIds(activityId)
  const tool = useToolCall(activity?.toolCallId ?? '')
  const [expanded, setExpanded] = useState(activity?.status === 'running' || activity?.status === 'failed')
  if (!activity) return null
  const duration = activity.startedAt ? getDuration(activity.startedAt, activity.endedAt) : undefined
  const content = tool ? <RegisteredTool tool={tool} activity={activity} mode="compact" /> : <><div className="ac-activity-title">{activity.text ?? activity.kind}</div><small className="ac-activity-meta">{activityStatusLabels[activity.status]}{duration ? ` · ${duration}` : ''}</small></>
  const artifactLinks = <ActivityArtifactLinks activityId={activity.id} />
  if (activity.kind === 'subagent') return <li className="ac-activity ac-subagent" id={`ac-activity-${activity.id}`} data-kind={activity.kind} data-state={activity.status} data-depth={depth}>
    <details open={expanded} onToggle={(event) => setExpanded(event.currentTarget.open)}>
      <summary><span className="ac-activity-marker" aria-hidden="true" /><span><strong>{activity.text ?? 'Subagent'}</strong><small>{activityStatusLabels[activity.status]} · {childIds.length} 个子活动</small></span></summary>
      {artifactLinks}{childIds.length > 0 ? <ol className="ac-activity-children">{childIds.map((id) => <ActivityRow activityId={id} depth={depth + 1} key={id} />)}</ol> : <div className="ac-subagent-empty">暂无子活动</div>}
    </details>
  </li>
  return <li className="ac-activity" id={`ac-activity-${activity.id}`} data-kind={activity.kind} data-state={activity.status} data-depth={depth}><span className="ac-activity-marker" aria-hidden="true" /><div className="ac-activity-body">{content}{artifactLinks}
    {childIds.length > 0 ? <ol className="ac-activity-children">{childIds.map((id) => <ActivityRow activityId={id} depth={depth + 1} key={id} />)}</ol> : null}</div>
  </li>
}

function ActivityArtifactLinks({ activityId }: { activityId: string }) {
  const artifacts = useActivityArtifacts(activityId)
  if (artifacts.length === 0) return null
  return <ul className="ac-activity-artifacts" aria-label="此活动生成的产物">{artifacts.map((artifact) => <li key={artifact.id}><a href={`#ac-artifact-${artifact.id}`}>{artifact.name} · v{artifact.version}</a></li>)}</ul>
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
  const activityIds = useRootActivityIds(runId)
  if (activityIds.length === 0) return <div className="ac-empty">等待 Agent 开始执行…</div>
  return <ol className="ac-timeline" aria-label="运行活动">{activityIds.map((id) => <ActivityRow activityId={id} key={id} />)}</ol>
}

export function RunAttemptHistory({ runId }: { runId: string }) {
  const state = useRuntimeSelector((snapshot) => snapshot.state)
  const attempts = selectRunAttemptHistory(state, runId)
  if (attempts.length <= 1) return null
  return <section className="ac-attempts" aria-label="运行尝试历史"><strong>尝试历史</strong><ol>{attempts.map((run) => <li key={run.id} data-current={run.id === runId ? 'true' : undefined}><span>第 {run.attempt} 次</span><small>{statusLabels[run.status]}</small></li>)}</ol></section>
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
  const history = useArtifactVersionHistory(artifact.id)
  const registry = useRendererRegistry()
  const rendererVersion = useRendererVersion()
  const Preview = registry.resolveArtifactPreview(artifact.kind)
  const source = artifact.provenance.label ?? (artifact.provenance.type === 'tool' ? '工具生成' : artifact.provenance.type === 'user' ? '用户提供' : artifact.provenance.type === 'external' ? '外部来源' : 'Agent 生成')
  return <article className="ac-artifact" id={`ac-artifact-${artifact.id}`} data-kind={artifact.kind} data-state={artifact.status}><header><strong>{artifact.name}</strong><span>{artifactStatusLabels[artifact.status]}</span></header><div className="ac-artifact-meta"><span>{artifact.kind}</span><span>版本 v{artifact.version}</span><span>{source}</span>{artifact.sizeBytes !== undefined ? <span>{formatBytes(artifact.sizeBytes)}</span> : null}</div>{history.length > 1 ? <ol className="ac-artifact-versions" aria-label="产物版本">{history.map((version) => <li key={version.id} data-current={version.id === artifact.id ? 'true' : undefined}>v{version.version} · {artifactStatusLabels[version.status]}</li>)}</ol> : null}{artifact.provenance.activityId ? <a className="ac-artifact-source" href={`#ac-activity-${artifact.provenance.activityId}`}>查看来源步骤</a> : null}{artifact.status === 'failed' && artifact.error ? <p className="ac-artifact-error" role="status">{artifact.error.message}</p> : null}{artifact.expiresAt ? <small>有效期至 {artifact.expiresAt}</small> : null}{artifact.checksum ? <small>{artifact.checksum.algorithm}: {artifact.checksum.value}</small> : null}{artifact.uri ? <code>{artifact.uri}</code> : null}{Preview && artifact.status === 'available' ? <ArtifactPreviewSlot key={`${artifact.id}:${rendererVersion}`} artifact={artifact} mode="panel" Preview={Preview} /> : null}</article>
}

function ArtifactPreviewSlot({ artifact, mode, Preview }: ArtifactPreviewRendererProps & { Preview: ArtifactPreviewRenderer }) {
  const [open, setOpen] = useState(false)
  return <details className="ac-artifact-preview" onToggle={(event) => setOpen(event.currentTarget.open)}><summary>预览产物</summary>{open ? <RendererErrorBoundary fallback={<Notice tone="error">预览组件加载失败。</Notice>}><Preview artifact={artifact} mode={mode} /></RendererErrorBoundary> : null}</details>
}

export function SandboxedArtifactFrame({ artifact, allowUri, title }: { artifact: Artifact; allowUri(uri: string, artifact: Artifact): boolean; title?: string }) {
  const uri = artifact.uri
  if (!uri || !isSafeHttpUri(uri) || !allowUri(uri, artifact)) return <Notice tone="warning">此产物未通过宿主预览策略。</Notice>
  return <iframe className="ac-artifact-frame" src={uri} title={title ?? `${artifact.name} 预览`} sandbox="" referrerPolicy="no-referrer" loading="lazy" />
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
  const artifacts = useRunArtifacts(runId)
  if (artifacts.length === 0) return null
  return <section className="ac-panel ac-artifact-panel" aria-labelledby={`artifacts-${runId}`}><h3 id={`artifacts-${runId}`}>产物</h3>{artifacts.map((artifact) => <ArtifactCard key={artifact.id} artifactId={artifact.id} mode="compact" />)}</section>
}

export type InterventionResponder = (interventionId: string, response: unknown, idempotencyKey: string) => Promise<void>

export function InterventionPanel({ runId, onRespond }: { runId: string; onRespond?: InterventionResponder }) {
  const interventionMap = useRuntimeSelector((snapshot) => snapshot.state.interventions)
  const interventions = Object.values(interventionMap).filter((item) => item.runId === runId).sort((left, right) => left.requestedAt.localeCompare(right.requestedAt) || left.id.localeCompare(right.id))
  if (interventions.length === 0) return null
  return <section className="ac-interventions" aria-label="人工介入">{interventions.map((item) => <InterventionCard key={item.id} intervention={item} {...(onRespond ? { onRespond } : {})} />)}</section>
}

let fallbackIdempotencySequence = 0
const nextIdempotencyKey = (interventionId: string): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  fallbackIdempotencySequence += 1
  return `${interventionId}:${Date.now()}:${fallbackIdempotencySequence}`
}

function InterventionCard({ intervention, onRespond }: { intervention: Intervention; onRespond?: InterventionResponder }) {
  const [value, setValue] = useState('')
  const [formValues, setFormValues] = useState<Record<string, string | boolean>>({})
  const [localPending, setLocalPending] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [localError, setLocalError] = useState<string>()
  const submission = useRef<{ fingerprint: string; key: string } | undefined>(undefined)
  const command = useCommandState(`respond:${intervention.id}`)
  const inputId = useId()
  const pending = localPending || command.status === 'pending'
  const accepted = submitted || command.status === 'succeeded'
  const error = localError ?? (command.status === 'failed' ? command.error : undefined)
  const respond = async (response: unknown) => {
    if (!onRespond) return
    const fingerprint = stringify(response)
    if (!submission.current || submission.current.fingerprint !== fingerprint) submission.current = { fingerprint, key: nextIdempotencyKey(intervention.id) }
    setLocalPending(true)
    setLocalError(undefined)
    try {
      await onRespond(intervention.id, response, submission.current.key)
      setSubmitted(true)
    } catch (reason) {
      setLocalError(reason instanceof Error ? reason.message : String(reason))
    } finally {
      setLocalPending(false)
    }
  }
  const meta = <><header><strong>{intervention.prompt}</strong><span>{intervention.status === 'pending' ? '等待操作' : intervention.status === 'resolved' ? '已处理' : '已过期'}</span></header>{intervention.description ? <p>{intervention.description}</p> : null}{intervention.risk ? <p><b>风险：</b>{intervention.risk}</p> : null}{intervention.impact ? <p><b>影响：</b>{intervention.impact}</p> : null}{intervention.expiresAt ? <small>有效期至 {intervention.expiresAt}</small> : null}</>
  if (intervention.status !== 'pending') return <article className="ac-intervention" data-state={intervention.status}>{meta}</article>
  if (!onRespond) return <article className="ac-intervention" data-state="pending">{meta}<p className="ac-intervention-feedback" role="status">当前 Runtime 不支持响应此请求。</p></article>
  const feedback = <>{pending ? <p className="ac-intervention-feedback" role="status">正在提交…</p> : null}{accepted ? <p className="ac-intervention-feedback" role="status">响应已接收，等待 Agent 更新状态。</p> : null}{error ? <p className="ac-intervention-error" role="alert">提交失败：{error}，您可以重试。</p> : null}</>
  if (intervention.kind === 'confirm' || intervention.kind === 'approval') {
    const positive = intervention.kind === 'approval' ? 'approved' : true
    const negative = intervention.kind === 'approval' ? 'rejected' : false
    return <article className="ac-intervention" data-state="pending">{meta}<div className="ac-intervention-actions"><button type="button" disabled={pending || accepted} onClick={() => void respond(positive)}>{intervention.kind === 'approval' ? '批准' : '确认'}</button><button type="button" className="ac-secondary" disabled={pending || accepted} onClick={() => void respond(negative)}>{intervention.kind === 'approval' ? '拒绝' : '取消'}</button></div>{feedback}</article>
  }
  if (intervention.kind === 'choice') return <form className="ac-intervention" data-state="pending" onSubmit={(event) => { event.preventDefault(); if (value) void respond(value) }}>{meta}<fieldset disabled={pending || accepted}><legend>请选择一项</legend>{intervention.options?.map((option) => <label className="ac-choice" key={option.value}><input type="radio" name={inputId} value={option.value} checked={value === option.value} onChange={(event) => setValue(event.target.value)} /><span><strong>{option.label}</strong>{option.description ? <small>{option.description}</small> : null}</span></label>)}</fieldset><button type="submit" disabled={pending || accepted || !value}>提交选择</button>{feedback}</form>
  if (intervention.kind === 'form') {
    const missingRequired = intervention.fields?.some((field) => field.required && !formValues[field.name]) ?? true
    const submitForm = () => {
      const response = Object.fromEntries((intervention.fields ?? []).map((field) => [field.name, normalizeFieldValue(field, formValues[field.name])]))
      void respond(response)
    }
    return <form className="ac-intervention" data-state="pending" onSubmit={(event) => { event.preventDefault(); if (!missingRequired) submitForm() }}>{meta}<div className="ac-intervention-fields">{intervention.fields?.map((field) => <InterventionFieldInput key={field.name} field={field} value={formValues[field.name]} disabled={pending || accepted} onChange={(next) => setFormValues((current) => ({ ...current, [field.name]: next }))} />)}</div><button type="submit" disabled={pending || accepted || missingRequired}>提交表单</button>{feedback}</form>
  }
  return <form className="ac-intervention" data-state="pending" onSubmit={(event) => { event.preventDefault(); if (value.trim()) void respond(value.trim()) }}>{meta}<label htmlFor={inputId}>您的回复</label><div className="ac-intervention-actions"><textarea id={inputId} value={value} onChange={(event) => setValue(event.target.value)} disabled={pending || accepted} /><button type="submit" disabled={pending || accepted || !value.trim()}>提交</button></div>{feedback}</form>
}

function normalizeFieldValue(field: InterventionField, value: string | boolean | undefined): string | number | boolean {
  if (field.type === 'checkbox') return value === true
  if (field.type === 'number') return Number(value)
  return typeof value === 'string' ? value : ''
}

function InterventionFieldInput({ field, value, disabled, onChange }: { field: InterventionField; value: string | boolean | undefined; disabled: boolean; onChange(value: string | boolean): void }) {
  const id = useId()
  if (field.type === 'checkbox') return <label className="ac-checkbox" htmlFor={id}><input id={id} type="checkbox" checked={value === true} disabled={disabled} onChange={(event) => onChange(event.target.checked)} />{field.label}</label>
  return <label htmlFor={id}><span>{field.label}{field.required ? ' *' : ''}</span>{field.type === 'textarea' ? <textarea id={id} value={typeof value === 'string' ? value : ''} placeholder={field.placeholder} required={field.required} disabled={disabled} onChange={(event) => onChange(event.target.value)} /> : field.type === 'select' ? <select id={id} value={typeof value === 'string' ? value : ''} required={field.required} disabled={disabled} onChange={(event) => onChange(event.target.value)}><option value="">请选择</option>{field.options?.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select> : <input id={id} type={field.type} value={typeof value === 'string' ? value : ''} placeholder={field.placeholder} required={field.required} disabled={disabled} onChange={(event) => onChange(event.target.value)} />}</label>
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
  onRetry?(runId: string): Promise<void>
  onResume?(runId: string): Promise<void>
  onRespond?: InterventionResponder
  theme?: 'system' | 'light' | 'dark'
  className?: string
  /** Experimental opt-in inspector. Runtime collection must also be enabled explicitly. */
  experimentalInspector?: { revealDiagnosticMessages?: boolean }
}

export function AgenticChat({ runtime, renderers, serverSnapshot, runId, onSend, onCancel, onRetry, onResume, onRespond, theme = 'system', className, experimentalInspector }: AgenticChatProps) {
  const rootClassName = ['ac-root', className].filter(Boolean).join(' ')
  return <AgenticChatProvider runtime={runtime} {...(renderers ? { renderers } : {})} {...(serverSnapshot ? { serverSnapshot } : {})}><AgenticChatContent runtime={runtime} rootClassName={rootClassName} theme={theme} onSend={onSend} {...(runId ? { runId } : {})} {...(onCancel ? { onCancel } : {})} {...(onRetry ? { onRetry } : {})} {...(onResume ? { onResume } : {})} {...(onRespond ? { onRespond } : {})} {...(experimentalInspector ? { experimentalInspector } : {})} /></AgenticChatProvider>
}

function AgenticChatContent({ runtime, rootClassName, theme, runId, onSend, onCancel, onRetry, onResume, onRespond, experimentalInspector }: Omit<AgenticChatProps, 'renderers' | 'serverSnapshot' | 'className'> & { rootClassName: string; theme: NonNullable<AgenticChatProps['theme']> }) {
  const run = useRun(runId ?? '')
  const running = !!run && ['queued', 'running', 'awaiting_input', 'paused'].includes(run.status)
  const responder = onRespond ?? (runtime.capabilities.intervention ? runtime.respondToIntervention : undefined)
  return <div className={rootClassName} data-theme={theme}>
    <ConnectionNotice />
    {experimentalInspector ? <ExperimentalRuntimeInspector {...(runId ? { runId } : {})} {...(experimentalInspector.revealDiagnosticMessages !== undefined ? { revealDiagnosticMessages: experimentalInspector.revealDiagnosticMessages } : {})} /> : null}
    {runId ? <><RunStatus runId={runId} /><RunAttemptHistory runId={runId} /><ActivityTimeline runId={runId} /><RunResult runId={runId} /><TaskPanel runId={runId} /><ArtifactPanel runId={runId} /><InterventionPanel runId={runId} {...(responder ? { onRespond: responder } : {})} />{onCancel && runtime.capabilities.cancel ? <CancelButton runId={runId} onCancel={onCancel} /> : null}{onRetry && runtime.capabilities.retry ? <RetryButton runId={runId} onRetry={onRetry} /> : null}{onResume && runtime.capabilities.resume ? <ResumeButton runId={runId} onResume={onResume} /> : null}</> : <EmptyState title="开始一个新的 Agent 任务" />}
    <Composer onSend={onSend} running={running} />
  </div>
}

export function ExperimentalRuntimeInspector({ runId, revealDiagnosticMessages = false }: { runId?: string; revealDiagnosticMessages?: boolean }) {
  const snapshot = useRuntimeSelector((value) => value)
  const inspection = snapshot.experimentalInspection
  if (!inspection) return <Notice tone="warning" title="Inspector 未启用">创建 Runtime 时传入 experimentalInspection 才会采集有界事件元数据。</Notice>
  const events = runId ? inspection.events.filter((item) => item.runId === runId) : inspection.events
  const domainDiagnostics = runId ? snapshot.state.diagnostics.filter((item) => item.runId === runId) : snapshot.state.diagnostics
  const runtimeDiagnostics = runId ? snapshot.diagnostics.filter((item) => !item.runId || item.runId === runId) : snapshot.diagnostics
  const diagnosticCount = domainDiagnostics.length + runtimeDiagnostics.length
  return <aside className="ac-inspector" aria-label="Runtime Inspector">
    <details><summary><strong>Runtime Inspector</strong><span>{events.length} 个事件 · {diagnosticCount} 条诊断</span></summary>
      <section aria-labelledby="ac-inspector-connection"><h3 id="ac-inspector-connection">连接</h3><p><strong>{snapshot.connection.status}</strong> · 第 {snapshot.connection.attempt} 次尝试</p>{inspection.connections.length ? <ol className="ac-inspector-connections">{inspection.connections.map((item, index) => <li key={`${item.status}:${item.attempt}:${index}`}>{item.status} · {item.attempt}</li>)}</ol> : null}</section>
      <section aria-labelledby="ac-inspector-events"><h3 id="ac-inspector-events">事件 envelope</h3>{events.length ? <div className="ac-inspector-table-wrap"><table><thead><tr><th scope="col">序号</th><th scope="col">类型</th><th scope="col">Run</th><th scope="col">结果</th></tr></thead><tbody>{events.map((item, index) => <tr key={`${item.eventId}:${index}`}><td>{item.sequence}</td><td><code>{item.type}</code></td><td><code>{item.runId}</code></td><td data-outcome={item.outcome}>{item.outcome}</td></tr>)}</tbody></table></div> : <p>暂无事件。</p>}</section>
      <section aria-labelledby="ac-inspector-diagnostics"><h3 id="ac-inspector-diagnostics">诊断</h3>{diagnosticCount ? <ul className="ac-inspector-diagnostics">{domainDiagnostics.map((item, index) => <li key={`domain:${item.eventId}:${index}`}><code>core/{item.code}</code>{revealDiagnosticMessages ? <span>{item.message}</span> : <span>详细信息已隐藏</span>}</li>)}{runtimeDiagnostics.map((item, index) => <li key={`runtime:${item.source}:${item.code}:${index}`}><code>{item.source}/{item.code}</code>{revealDiagnosticMessages ? <span>{item.message}</span> : <span>详细信息已隐藏</span>}</li>)}</ul> : <p>暂无诊断。</p>}</section>
      <p className="ac-inspector-privacy">仅保留事件 envelope 与连接状态；不采集事件 payload、连接错误文本、消息正文或工具参数。</p>
    </details>
  </aside>
}

function ResumeButton({ runId, onResume }: { runId: string; onResume(runId: string): Promise<void> }) {
  const run = useRun(runId)
  const state = useCommandState(`resume:${runId}`)
  if (!run || run.status !== 'paused') return null
  return <button className="ac-resume" type="button" disabled={state.status === 'pending'} onClick={() => void onResume(runId)}>{state.status === 'pending' ? '正在恢复…' : '恢复运行'}</button>
}

function RetryButton({ runId, onRetry }: { runId: string; onRetry(runId: string): Promise<void> }) {
  const run = useRun(runId)
  const state = useCommandState(`retry:${runId}`)
  if (!run || !['failed', 'cancelled'].includes(run.status)) return null
  return <button className="ac-retry" type="button" disabled={state.status === 'pending'} onClick={() => void onRetry(runId)}>{state.status === 'pending' ? '正在重试…' : '重试'}</button>
}

function CancelButton({ runId, onCancel }: { runId: string; onCancel(runId: string): Promise<void> }) {
  const run = useRun(runId)
  const state = useCommandState(`cancel:${runId}`)
  if (!run || !['queued', 'running'].includes(run.status)) return null
  return <button className="ac-cancel" type="button" disabled={state.status === 'pending'} onClick={() => void onCancel(runId)}>{state.status === 'pending' ? '正在停止…' : '停止运行'}</button>
}

const stringify = (value: unknown): string => typeof value === 'string' ? value : JSON.stringify(value, null, 2)

const artifactStatusLabels = { generating: '生成中', available: '可用', failed: '生成失败', expired: '已过期' } as const

function formatBytes(value: number): string {
  if (value < 1024) return `${value} B`
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`
  return `${(value / (1024 * 1024)).toFixed(1)} MB`
}

function isSafeHttpUri(value: string): boolean {
  try { return ['http:', 'https:'].includes(new URL(value).protocol) } catch { return false }
}

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

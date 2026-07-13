import type { AgenticRuntime } from '@agentic-chat/runtime'
import { AgenticChatProvider, useActivity, useCommandState, useConnection, useRun, useRunActivityIds, useRunResult, useToolCall } from '@agentic-chat/react'
import { useState, type FormEvent } from 'react'

const statusLabels = { queued: '排队中', running: '运行中', awaiting_input: '等待操作', paused: '已暂停', completed: '已完成', failed: '失败', cancelled: '已取消' } as const

export function RunStatus({ runId }: { runId: string }) {
  const run = useRun(runId)
  if (!run) return null
  return <header className="ac-run-status" data-state={run.status}><span className="ac-status-dot" aria-hidden="true" /><strong>{statusLabels[run.status]}</strong></header>
}

function ActivityRow({ activityId }: { activityId: string }) {
  const activity = useActivity(activityId)
  const tool = useToolCall(activity?.toolCallId ?? '')
  if (!activity) return null
  return <li className="ac-activity" data-kind={activity.kind} data-state={activity.status}>
    <span className="ac-activity-marker" aria-hidden="true" />
    <div className="ac-activity-body">
      <div className="ac-activity-title">{activity.kind === 'tool' ? tool?.name ?? '工具调用' : activity.text ?? activity.kind}</div>
      {tool ? <div className="ac-tool-summary"><span>{tool.status}</span>{tool.output !== undefined ? <pre>{stringify(tool.output)}</pre> : null}</div> : null}
    </div>
  </li>
}

export function ActivityTimeline({ runId }: { runId: string }) {
  const activityIds = useRunActivityIds(runId)
  if (activityIds.length === 0) return <div className="ac-empty">等待 Agent 开始执行…</div>
  return <ol className="ac-timeline" aria-label="运行活动">{activityIds.map((id) => <ActivityRow activityId={id} key={id} />)}</ol>
}

export function RunResult({ runId }: { runId: string }) {
  const result = useRunResult(runId)
  if (result === undefined) return null
  return <section className="ac-result"><h3>结果</h3><pre>{stringify(result)}</pre></section>
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
    <textarea aria-label="消息" value={message} onChange={(event) => setMessage(event.target.value)} disabled={disabled || submitting} rows={2} />
    <button type="submit" disabled={disabled || submitting || !message.trim()}>{submitting ? '发送中…' : '发送'}</button>
  </form>
}

export interface AgenticChatProps {
  runtime: AgenticRuntime
  runId?: string
  onSend(message: string): Promise<void>
  onCancel?(runId: string): Promise<void>
}

export function AgenticChat({ runtime, runId, onSend, onCancel }: AgenticChatProps) {
  return <AgenticChatProvider runtime={runtime}><div className="ac-root">
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

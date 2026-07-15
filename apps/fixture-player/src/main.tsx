import type { CanonicalEvent } from '@agentic-chat/core'
import { adaptAgUiEvents, agUiCapabilities, type AgUiEvent } from '@agentic-chat/adapter-ag-ui'
import { adaptAiSdkUIMessageChunks, aiSdkCapabilities, type AiSdkUIMessageChunk } from '@agentic-chat/adapter-ai-sdk'
import { adaptChatBiEvent, chatBiCapabilities, type ChatBiRunEvent } from '@agentic-chat/adapter-chatbi'
import { AgenticChat } from '@agentic-chat/react-ui'
import '@agentic-chat/react-ui/styles.css'
import { createRuntime, type AdapterCapabilities } from '@agentic-chat/runtime'
import { rawChatBiSuccessfulRun } from '@agentic-chat/testkit'
import { StrictMode, useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'

interface FixtureDefinition { label: string; protocol: string; capabilities: AdapterCapabilities; events: readonly CanonicalEvent[]; diagnostics: readonly string[] }

const chatBiAdapted = rawChatBiSuccessfulRun.map((source) => adaptChatBiEvent(source as ChatBiRunEvent))
const agUiSource: AgUiEvent[] = [
  { type: 'RUN_STARTED', threadId: 'ag-thread', runId: 'ag-run' }, { type: 'STEP_STARTED', stepName: 'research' },
  { type: 'TOOL_CALL_START', toolCallId: 'ag-call', toolCallName: 'web_search' }, { type: 'TOOL_CALL_ARGS', toolCallId: 'ag-call', delta: '{"query":"agent UI"}' },
  { type: 'TOOL_CALL_END', toolCallId: 'ag-call' }, { type: 'TOOL_CALL_RESULT', messageId: 'tool-result', toolCallId: 'ag-call', content: '3 sources' },
  { type: 'STEP_FINISHED', stepName: 'research' }, { type: 'TEXT_MESSAGE_START', messageId: 'ag-answer', role: 'assistant' },
  { type: 'TEXT_MESSAGE_CONTENT', messageId: 'ag-answer', delta: 'AG-UI research complete.' }, { type: 'TEXT_MESSAGE_END', messageId: 'ag-answer' },
  { type: 'RUN_FINISHED', threadId: 'ag-thread', runId: 'ag-run' },
]
const agUiAdapted = adaptAgUiEvents(agUiSource)
const aiSdkSource: AiSdkUIMessageChunk[] = [
  { type: 'start', messageId: 'ai-message' }, { type: 'start-step' },
  { type: 'tool-input-available', toolCallId: 'ai-call', toolName: 'get_weather', input: { city: 'Shanghai' } },
  { type: 'tool-output-available', toolCallId: 'ai-call', output: { temperature: 31 } }, { type: 'finish-step' },
  { type: 'start-step' }, { type: 'text-start', id: 'ai-text' }, { type: 'text-delta', id: 'ai-text', delta: 'AI SDK: Shanghai is 31°C.' },
  { type: 'text-end', id: 'ai-text' }, { type: 'finish-step' }, { type: 'finish', finishReason: 'stop' },
]
const aiSdkAdapted = adaptAiSdkUIMessageChunks(aiSdkSource, { threadId: 'ai-sdk-thread', runId: 'ai-sdk-run' })

const fixtures = {
  chatbi: { label: 'ChatBI', protocol: 'ChatBI protocol 1.0 · strict per-run sequence', capabilities: chatBiCapabilities, events: chatBiAdapted.flatMap((item) => item.event ? [item.event] : []), diagnostics: chatBiAdapted.flatMap((item) => item.diagnostic ? [item.diagnostic.message] : []) },
  agUi: { label: 'AG-UI', protocol: 'AG-UI events · synthesized stream order', capabilities: agUiCapabilities, events: agUiAdapted.events, diagnostics: agUiAdapted.diagnostics.map((item) => item.message) },
  aiSdk: { label: 'AI SDK', protocol: 'UI Message Stream v1 · synthesized stream order', capabilities: aiSdkCapabilities, events: aiSdkAdapted.events, diagnostics: aiSdkAdapted.diagnostics.map((item) => item.message) },
} satisfies Record<string, FixtureDefinition>

type FixtureName = keyof typeof fixtures

function App() {
  const [fixtureName, setFixtureName] = useState<FixtureName>('chatbi')
  const [cursor, setCursor] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [intervalMs, setIntervalMs] = useState(250)
  const [generation, setGeneration] = useState(0)
  const fixture = fixtures[fixtureName]
  const events = fixture.events
  const runtime = useMemo(() => createRuntime({ capabilities: { ...fixture.capabilities, send: false, cancel: false, resume: false, retry: false, intervention: false } }), [fixtureName, generation])
  const runId = events[0]?.runId

  useEffect(() => { setCursor(0); setPlaying(false) }, [fixtureName])
  useEffect(() => {
    if (!playing || cursor >= events.length) return
    const timer = window.setTimeout(() => { const event = events[cursor]; if (event) runtime.dispatch(event); setCursor((value) => value + 1) }, intervalMs)
    return () => window.clearTimeout(timer)
  }, [cursor, events, intervalMs, playing, runtime])
  useEffect(() => { if (cursor >= events.length) setPlaying(false) }, [cursor, events.length])

  const step = () => { const event = events[cursor]; if (!event) return; runtime.dispatch(event); setCursor((value) => value + 1) }
  return <main>
    <header><div><p>Multi-runtime integration</p><h1>Adapter Runtime Switcher</h1><span data-testid="active-adapter">{fixture.label}</span><small>{fixture.protocol}</small></div><label>事件源<select aria-label="事件源" value={fixtureName} onChange={(event) => setFixtureName(event.target.value as FixtureName)}>{Object.entries(fixtures).map(([name, item]) => <option key={name} value={name}>{item.label}</option>)}</select></label></header>
    <section className="player" aria-label="Fixture playback controls"><button type="button" onClick={() => setPlaying((value) => !value)} disabled={cursor >= events.length}>{playing ? '暂停' : '播放'}</button><button type="button" onClick={step} disabled={playing || cursor >= events.length}>单步</button><button type="button" onClick={() => { setCursor(0); setPlaying(false); setGeneration((value) => value + 1) }}>重置</button><label>间隔<select value={intervalMs} onChange={(event) => setIntervalMs(Number(event.target.value))}><option value={700}>正常</option><option value={250}>快速</option><option value={50}>测试</option></select></label><output>{cursor} / {events.length}</output></section>
    <section className="runtime-output" aria-labelledby="runtime-output-title"><h2 id="runtime-output-title">运行结果</h2><AgenticChat runtime={runtime} {...(runId ? { runId } : {})} onSend={async () => {}} /></section>
    {fixture.diagnostics.length ? <details><summary>Adapter diagnostics ({fixture.diagnostics.length})</summary><ul>{fixture.diagnostics.map((item) => <li key={item}>{item}</li>)}</ul></details> : null}
    <details><summary>下一事件</summary><pre>{JSON.stringify(events[cursor] ?? null, null, 2)}</pre></details>
  </main>
}

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>)

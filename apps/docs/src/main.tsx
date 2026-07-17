import { Markdown } from '@agentic-chat/react-ui'
import '@agentic-chat/react-ui/styles.css'
import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'

const guides = [
  ['Quick Start', '10-quick-start.md'],
  ['Concept and architecture', '02-technical-architecture.md'],
  ['Canonical Schema 1.0', '24-canonical-schema-1.0.md'],
  ['Adapter guide', '12-adapter-guide.md'],
  ['Renderer guide', '09-renderer-guide.md'],
  ['Theming', '11-theming.md'],
  ['API lifecycle and support', '25-api-lifecycle-and-support.md'],
  ['Migration to 1.0', '26-migration-to-1.0.md'],
  ['HITL and Artifacts', '28-hitl-and-artifacts.md'],
  ['Snapshot and recovery', '29-snapshot-and-recovery.md'],
  ['Security and troubleshooting', '30-security-performance-troubleshooting.md'],
  ['Host integration cases', '31-host-integration-cases.md'],
] as const
const references = ['core', 'runtime', 'react', 'react-ui', 'testkit', 'adapter-chatbi', 'adapter-ai-sdk'] as const

function selectedDocument(): string | undefined {
  const value = new URLSearchParams(location.search).get('doc')
  return value?.replace(/[^a-z0-9.-]/giu, '') || undefined
}

function App() {
  const [documentName, setDocumentName] = useState(selectedDocument)
  const [content, setContent] = useState('')
  useEffect(() => {
    if (!documentName) { setContent(''); return }
    fetch(`${import.meta.env.BASE_URL}content/${documentName}`).then(async (response) => {
      if (!response.ok) throw new Error(`Documentation request failed: ${response.status}`)
      setContent(await response.text())
    }).catch((error: unknown) => setContent(`# Unable to load documentation\n\n${error instanceof Error ? error.message : String(error)}`))
  }, [documentName])
  const open = (name: string) => {
    history.pushState({}, '', `?doc=${encodeURIComponent(name)}`)
    setDocumentName(name)
    window.scrollTo({ top: 0 })
  }
  if (documentName) return <main className="docs-shell"><button className="back" type="button" onClick={() => { history.pushState({}, '', location.pathname); setDocumentName(undefined) }}>← Documentation home</button><article><Markdown>{content}</Markdown></article></main>
  return <main className="docs-shell">
    <header><span className="eyebrow">Agentic Chat · 1.0 candidate</span><h1>Build durable Agent UIs on one canonical runtime</h1><p>Framework-independent events and state, headless React bindings, accessible default UI, conformance-tested adapters and trusted releases.</p><div className="actions"><button type="button" onClick={() => open('10-quick-start.md')}>Start integrating</button><a href={`${import.meta.env.BASE_URL}demo/`}>Open live demo</a><a href="https://github.com/agilebuilder/agentic-chat">GitHub</a></div></header>
    <section><h2>Guides</h2><div className="grid">{guides.map(([label, file]) => <button type="button" className="card" onClick={() => open(file)} key={file}><strong>{label}</strong><span>{file}</span></button>)}</div></section>
    <section><h2>API reference</h2><p>Generated from the reviewed API Extractor reports used by CI.</p><div className="grid compact">{references.map((name) => <button type="button" className="card" onClick={() => open(`${name}.api.md`)} key={name}><strong>@agentic-chat/{name}</strong></button>)}</div></section>
    <footer>Event wire 0.1 · Snapshot wire 0.2 · Node 20/22 · React 18/19 target</footer>
  </main>
}

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>)

import { Fragment, type ReactNode } from 'react'

/** @public */
export interface MarkdownProps {
  children: string
  className?: string
}

/**
 * A deliberately conservative Markdown renderer for untrusted agent output.
 * It never interprets raw HTML and only emits React elements, so HTML remains text.
 * @public
 */
export function Markdown({ children, className }: MarkdownProps) {
  const blocks = parseBlocks(children)
  return <div className={['ac-markdown', className].filter(Boolean).join(' ')}>{blocks.map(renderBlock)}</div>
}

type Block =
  | { type: 'code'; language?: string; value: string; key: number }
  | { type: 'heading'; level: number; value: string; key: number }
  | { type: 'list'; values: string[]; key: number }
  | { type: 'paragraph'; value: string; key: number }

function parseBlocks(source: string): Block[] {
  const lines = source.replace(/\r\n?/g, '\n').split('\n')
  const blocks: Block[] = []
  let index = 0
  while (index < lines.length) {
    const line = lines[index] ?? ''
    if (!line.trim()) { index += 1; continue }

    const fence = /^```([^`]*)$/.exec(line)
    if (fence) {
      const start = index++
      const content: string[] = []
      while (index < lines.length && !/^```\s*$/.test(lines[index] ?? '')) content.push(lines[index++] ?? '')
      if (index < lines.length) index += 1
      const language = fence[1]?.trim()
      blocks.push({ type: 'code', ...(language ? { language } : {}), value: content.join('\n'), key: start })
      continue
    }

    const heading = /^(#{1,6})\s+(.+)$/.exec(line)
    if (heading) {
      blocks.push({ type: 'heading', level: heading[1]?.length ?? 1, value: heading[2] ?? '', key: index++ })
      continue
    }

    if (/^\s*[-*+]\s+/.test(line)) {
      const start = index
      const values: string[] = []
      while (index < lines.length && /^\s*[-*+]\s+/.test(lines[index] ?? '')) values.push((lines[index++] ?? '').replace(/^\s*[-*+]\s+/, ''))
      blocks.push({ type: 'list', values, key: start })
      continue
    }

    const start = index
    const paragraph: string[] = []
    while (index < lines.length && (lines[index] ?? '').trim() && !/^```/.test(lines[index] ?? '') && !/^(#{1,6})\s+/.test(lines[index] ?? '') && !/^\s*[-*+]\s+/.test(lines[index] ?? '')) paragraph.push(lines[index++] ?? '')
    blocks.push({ type: 'paragraph', value: paragraph.join('\n'), key: start })
  }
  return blocks
}

function renderBlock(block: Block): ReactNode {
  if (block.type === 'code') return <pre key={block.key}><code {...(block.language ? { 'data-language': block.language } : {})}>{block.value}</code></pre>
  if (block.type === 'list') return <ul key={block.key}>{block.values.map((value, index) => <li key={index}>{renderInline(value)}</li>)}</ul>
  if (block.type === 'paragraph') return <p key={block.key}>{renderInline(block.value)}</p>
  const content = renderInline(block.value)
  switch (block.level) {
    case 1: return <h1 key={block.key}>{content}</h1>
    case 2: return <h2 key={block.key}>{content}</h2>
    case 3: return <h3 key={block.key}>{content}</h3>
    case 4: return <h4 key={block.key}>{content}</h4>
    case 5: return <h5 key={block.key}>{content}</h5>
    default: return <h6 key={block.key}>{content}</h6>
  }
}

function renderInline(value: string): ReactNode[] {
  const nodes: ReactNode[] = []
  const pattern = /(`[^`\n]+`|\*\*[^*\n]+\*\*|\[[^\]\n]+\]\([^\s)]+\))/g
  let cursor = 0
  for (const match of value.matchAll(pattern)) {
    const position = match.index ?? 0
    if (position > cursor) nodes.push(value.slice(cursor, position))
    const token = match[0]
    const key = `${position}:${token}`
    if (token.startsWith('`')) nodes.push(<code key={key}>{token.slice(1, -1)}</code>)
    else if (token.startsWith('**')) nodes.push(<strong key={key}>{token.slice(2, -2)}</strong>)
    else {
      const link = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(token)
      const href = link?.[2]
      nodes.push(link && href && isSafeHref(href)
        ? <a key={key} href={href} target="_blank" rel="noreferrer noopener">{link[1]}</a>
        : <Fragment key={key}>{link?.[1] ?? token}</Fragment>)
    }
    cursor = position + token.length
  }
  if (cursor < value.length) nodes.push(value.slice(cursor))
  return nodes
}

function isSafeHref(href: string): boolean {
  return /^(https?:|mailto:)/i.test(href)
}

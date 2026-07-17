import type { Activity, Artifact, Message, RenderableContent, ToolCall } from '@agentic-chat/core'
import type { ComponentType } from 'react'

export type RendererMode = 'compact' | 'full' | 'panel'
export type Unsubscribe = () => void

export interface ToolRendererProps {
  tool: ToolCall
  activity: Activity
  mode: RendererMode
}

export interface ResultRendererProps {
  runId: string
  content: RenderableContent
  mode: RendererMode
}

export interface ArtifactRendererProps {
  artifact: Artifact
  mode: RendererMode
}

export interface ArtifactPreviewRendererProps {
  artifact: Artifact
  mode: RendererMode
}

export interface MessageRendererProps {
  message: Message
  mode: RendererMode
}

export type ToolRenderer = ComponentType<ToolRendererProps>
export type ResultRenderer = ComponentType<ResultRendererProps>
export type ArtifactRenderer = ComponentType<ArtifactRendererProps>
export type ArtifactPreviewRenderer = ComponentType<ArtifactPreviewRendererProps>
export type MessageRenderer = ComponentType<MessageRendererProps>

export interface RendererRegistry {
  tool(name: string, renderer: ToolRenderer): Unsubscribe
  result(kind: string, renderer: ResultRenderer): Unsubscribe
  artifact(kind: string, renderer: ArtifactRenderer): Unsubscribe
  artifactPreview(kind: string, renderer: ArtifactPreviewRenderer): Unsubscribe
  message(kind: string, renderer: MessageRenderer): Unsubscribe
  resolveTool(name: string): ToolRenderer | undefined
  resolveResult(kind: string): ResultRenderer | undefined
  resolveArtifact(kind: string): ArtifactRenderer | undefined
  resolveArtifactPreview(kind: string): ArtifactPreviewRenderer | undefined
  resolveMessage(kind: string): MessageRenderer | undefined
  subscribe(listener: () => void): Unsubscribe
  getVersion(): number
}

export function createRendererRegistry(): RendererRegistry {
  const tools = new Map<string, ToolRenderer>()
  const results = new Map<string, ResultRenderer>()
  const artifacts = new Map<string, ArtifactRenderer>()
  const artifactPreviews = new Map<string, ArtifactPreviewRenderer>()
  const messages = new Map<string, MessageRenderer>()
  const listeners = new Set<() => void>()
  let version = 0

  const notify = () => {
    version += 1
    listeners.forEach((listener) => listener())
  }

  const register = <TRenderer>(registry: Map<string, TRenderer>, key: string, renderer: TRenderer): Unsubscribe => {
    registry.set(key, renderer)
    notify()
    return () => {
      if (registry.get(key) !== renderer) return
      registry.delete(key)
      notify()
    }
  }

  return {
    tool: (name, renderer) => register(tools, name, renderer),
    result: (kind, renderer) => register(results, kind, renderer),
    artifact: (kind, renderer) => register(artifacts, kind, renderer),
    artifactPreview: (kind, renderer) => register(artifactPreviews, kind, renderer),
    message: (kind, renderer) => register(messages, kind, renderer),
    resolveTool: (name) => tools.get(name) ?? tools.get('*'),
    resolveResult: (kind) => results.get(kind) ?? results.get('*'),
    resolveArtifact: (kind) => artifacts.get(kind) ?? artifacts.get('*'),
    resolveArtifactPreview: (kind) => artifactPreviews.get(kind) ?? artifactPreviews.get('*'),
    resolveMessage: (kind) => messages.get(kind) ?? messages.get('*'),
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    getVersion: () => version,
  }
}

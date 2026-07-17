import type { Activity, AgentRun, Artifact, Message, RenderableContent, ToolCall } from '@agentic-chat/core'
import { selectArtifactsForActivity, selectArtifactVersionHistory, selectRunArtifacts, type AgenticRuntime, type RuntimeSnapshot } from '@agentic-chat/runtime'
import { createContext, useContext, useMemo, useRef, useSyncExternalStore, type PropsWithChildren } from 'react'
import { createRendererRegistry, type RendererRegistry } from './renderers.js'

export * from './renderers.js'

interface RuntimeProviderValue {
  runtime: AgenticRuntime
  serverSnapshot?: RuntimeSnapshot
}

const RuntimeContext = createContext<RuntimeProviderValue | null>(null)
const RendererContext = createContext<RendererRegistry | null>(null)

/** @public */
export interface AgenticChatProviderProps extends PropsWithChildren {
  runtime: AgenticRuntime
  renderers?: RendererRegistry
  /** Snapshot serialized by the server and reused for the first hydration render. */
  serverSnapshot?: RuntimeSnapshot
}

/** @public */
export function AgenticChatProvider({ runtime, renderers, serverSnapshot, children }: AgenticChatProviderProps) {
  const defaultRenderers = useRef<RendererRegistry | null>(null)
  if (!defaultRenderers.current) defaultRenderers.current = createRendererRegistry()
  const runtimeValue = useRef<RuntimeProviderValue>({ runtime, ...(serverSnapshot ? { serverSnapshot } : {}) })
  if (runtimeValue.current.runtime !== runtime || runtimeValue.current.serverSnapshot !== serverSnapshot) {
    runtimeValue.current = { runtime, ...(serverSnapshot ? { serverSnapshot } : {}) }
  }
  return <RuntimeContext.Provider value={runtimeValue.current}><RendererContext.Provider value={renderers ?? defaultRenderers.current}>{children}</RendererContext.Provider></RuntimeContext.Provider>
}

/** @public */
export function useAgenticRuntime(): AgenticRuntime {
  const runtime = useContext(RuntimeContext)
  if (!runtime) throw new Error('AgenticChatProvider is missing')
  return runtime.runtime
}

/** @public */
export function useRendererRegistry(): RendererRegistry {
  const registry = useContext(RendererContext)
  if (!registry) throw new Error('AgenticChatProvider is missing')
  return registry
}

/** @public */
export function useRendererVersion(): number {
  const registry = useRendererRegistry()
  return useSyncExternalStore(registry.subscribe, registry.getVersion, registry.getVersion)
}

/** @public */
export function useRuntimeSelector<T>(selector: (snapshot: RuntimeSnapshot) => T): T {
  const context = useContext(RuntimeContext)
  if (!context) throw new Error('AgenticChatProvider is missing')
  const { runtime, serverSnapshot } = context
  return useSyncExternalStore(
    runtime.subscribe,
    () => selector(runtime.getSnapshot()),
    () => selector(serverSnapshot ?? runtime.getSnapshot()),
  )
}

/** @public */
export const useRun = (runId: string): AgentRun | undefined => useRuntimeSelector((snapshot) => snapshot.state.runs[runId])
/** @public */
export const useActivity = (activityId: string): Activity | undefined => useRuntimeSelector((snapshot) => snapshot.state.activities[activityId])
/** @public */
export const useToolCall = (toolCallId: string): ToolCall | undefined => useRuntimeSelector((snapshot) => snapshot.state.toolCalls[toolCallId])
/** @public */
export const useMessage = (messageId: string): Message | undefined => useRuntimeSelector((snapshot) => snapshot.state.messages[messageId])
/** @public */
export const useArtifact = (artifactId: string): Artifact | undefined => useRuntimeSelector((snapshot) => snapshot.state.artifacts[artifactId])
/** @public */
export function useRunArtifacts(runId: string): Artifact[] {
  const state = useRuntimeSelector((snapshot) => snapshot.state)
  return useMemo(() => selectRunArtifacts(state, runId), [state, runId])
}

/** @public */
export function useActivityArtifacts(activityId: string): Artifact[] {
  const state = useRuntimeSelector((snapshot) => snapshot.state)
  return useMemo(() => selectArtifactsForActivity(state, activityId), [state, activityId])
}

/** @public */
export function useArtifactVersionHistory(artifactId: string): Artifact[] {
  const state = useRuntimeSelector((snapshot) => snapshot.state)
  return useMemo(() => selectArtifactVersionHistory(state, artifactId), [state, artifactId])
}
/** @public */
export const useRunActivityIds = (runId: string): string[] => useRuntimeSelector((snapshot) => snapshot.state.runs[runId]?.activityIds ?? emptyIds)
/** @public */
export const useRootActivityIds = (runId: string): readonly string[] => useRuntimeSelector((snapshot) => snapshot.state.rootActivityIdsByRunId[runId] ?? emptyIds)
/** @public */
export const useChildActivityIds = (activityId: string): readonly string[] => useRuntimeSelector((snapshot) => snapshot.state.childActivityIdsByParentId[activityId] ?? emptyIds)
/** @public */
export const useRunResult = (runId: string): RenderableContent | undefined => useRuntimeSelector((snapshot) => snapshot.state.results[runId])
/** @public */
export const useConnection = () => useRuntimeSelector((snapshot) => snapshot.connection)
/** @public */
export const useCommandState = (key: string) => useRuntimeSelector((snapshot) => snapshot.commands[key] ?? idleCommand)

const emptyIds: string[] = []
const idleCommand = { status: 'idle' as const }

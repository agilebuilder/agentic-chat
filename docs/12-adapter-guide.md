# Adapter 接入指南

Adapter 把某个 Agent 后端的事件协议转换为 `CanonicalEvent`，并声明它能提供的命令和恢复能力。它不渲染 UI，也不应把凭据或 transport 放进 renderer。

## 最小 Adapter

```ts
import type { CanonicalEvent } from '@agentic-chat/core'
import type { AgentAdapter, AdapterContext, AdapterResult } from '@agentic-chat/runtime'

interface SourceEvent {
  id: string
  runId: string
  threadId: string
  sequence: number
  createdAt: string
  type: 'started' | 'completed'
}

export const adapter: AgentAdapter<SourceEvent> = {
  id: 'acme',
  capabilities: {
    send: false,
    sequence: 'strict-per-run',
    replay: 'live-resume',
    cancel: false,
    resume: false,
    retry: false,
    intervention: false,
    artifacts: false,
  },
  adapt(source: SourceEvent, _context: AdapterContext): AdapterResult {
    const event: CanonicalEvent = source.type === 'started'
      ? { schemaVersion: '0.1', eventId: source.id, type: 'run.started', threadId: source.threadId, runId: source.runId, sequence: source.sequence, timestamp: source.createdAt, data: {}, source: 'acme' }
      : { schemaVersion: '0.1', eventId: source.id, type: 'run.completed', threadId: source.threadId, runId: source.runId, sequence: source.sequence, timestamp: source.createdAt, data: {}, source: 'acme' }
    return { events: [event], diagnostics: [] }
  },
}
```

无法安全转换的源事件不要伪装成业务事件：返回 diagnostic；仅用于观测的 heartbeat、snapshot marker 等可映射为 `source.observed`，默认 UI 会静默处理。

## Runtime 命令

命令实现和 capability 必须一致，否则 `createRuntime` 会立即报错：

```ts
import { createRuntime } from '@agentic-chat/runtime'

const runtime = createRuntime({
  capabilities: { ...adapter.capabilities, send: true },
  commands: {
    async send(input, idempotencyKey) {
      const response = await fetch('/api/runs', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'idempotency-key': idempotencyKey },
        body: JSON.stringify(input),
      })
      const run = await response.json() as { id: string }
      return { commandId: run.id, accepted: true }
    },
  },
})
```

`send`、`retryRun` 和 `respond` 的幂等键必须贯穿客户端、API 和存储层。网络重试复用同一个 key，不应为每次 retry 生成新 key。

## 顺序、重放与错误

- `strict-per-run`：每个 Run 从 sequence 1 开始严格递增；缺口会阻塞后续事件，直到补齐。
- `synthesized-stream-order`：源协议没有序号，adapter 按已观察顺序合成；必须说明重连限制。
- `unordered`：只适合不能保证顺序的降级集成，功能和恢复能力有限。
- eventId 在重放时必须稳定；同 eventId 会被 reducer 去重。
- terminal Run 不会被迟到的 started/progress 事件复活，异常会写入 diagnostic。

## Conformance 测试

公开 adapter 至少准备成功、失败和取消夹具，并用同一套 testkit 检查：

```ts
import { checkAdapterConformance } from '@agentic-chat/testkit'

const result = checkAdapterConformance(events, {
  expectedStatus: 'completed',
  sequence: adapter.capabilities.sequence,
})
if (result.issues.length > 0) throw new Error(result.issues.join('\n'))
```

该检查会验证单 Run/Thread、event ID、顺序、唯一终态、reducer diagnostic、未结束 ToolCall 和重复 replay 幂等性。`checkRunConformance` 暂时保留为兼容别名，新代码应使用 `checkAdapterConformance`。

测试仍需在 adapter 自己的测试中覆盖源协议解析、重连、未知事件降级、敏感字段脱敏和 capability/command 对齐；这些来源特有行为不能只靠 canonical fixture 证明。自定义 Result、Tool、Artifact 或 Message 的 UI 接入见 [Renderer 指南](09-renderer-guide.md)。

需要验证 snapshot 恢复的 adapter 可以选择一个 Run 中间切点：

```ts
import { checkSnapshotReplayConformance } from '@agentic-chat/testkit'

const result = checkSnapshotReplayConformance(events, splitIndex)
if (result.issues.length > 0) throw new Error(result.issues.join('\n'))
```

该检查先 replay 前缀并创建 0.2 `CanonicalSnapshot`，再导入 snapshot、replay 后缀，最后与完整事件 replay 的持久化结果比较。切点不能位于 sequence gap 后。

### AG-UI Task state 约定（experimental）

AG-UI 的共享 state 不会默认导入 canonical store。当前只识别显式命名空间中的完整任务集合：

```ts
{
  agenticChat: {
    tasks: {
      revision: 2,
      items: [{ id: 'research', title: 'Research', status: 'in_progress' }],
    },
  },
}
```

`STATE_SNAPSHOT` 可携带该结构；`STATE_DELTA` 只接受单个 `add`/`replace` 操作，路径必须精确为 `/agenticChat/tasks`，value 是同一完整结构。任意其他共享状态继续转换为无 payload 的 `source.observed`。这是 0.x experimental 映射，不代表 AG-UI 官方字段。

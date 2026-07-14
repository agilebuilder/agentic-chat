# Quick Start

本指南用于在一个全新的 React/Vite 应用中接入 Agentic Chat。完成后应用只依赖公开 npm 包、React 和 Vite，不需要 ChatBI、Zustand或仓库源码 alias。

## 环境要求

- Node.js 20.19+ 或 22.12+
- React 18 或 19
- TypeScript 5（推荐）

## 安装

```bash
pnpm create vite my-agent-chat --template react-ts
cd my-agent-chat
pnpm add @agentic-chat/core @agentic-chat/runtime @agentic-chat/react-ui
pnpm install
```

Alpha 尚未正式发布时，可在本仓库运行以下等价示例：

```bash
pnpm --filter "@agentic-chat/minimal^..." build
pnpm --filter @agentic-chat/minimal dev
```

源码位于 `apps/minimal`。该应用没有 ChatBI 或第三方状态管理依赖，并通过各包的公开 exports 构建。

## 创建 runtime 和 UI

```tsx
import type { CanonicalEvent } from '@agentic-chat/core'
import { createRuntime } from '@agentic-chat/runtime'
import { AgenticChat } from '@agentic-chat/react-ui'
import '@agentic-chat/react-ui/styles.css'
import { useRef, useState } from 'react'

export function Chat() {
  const runtime = useRef(createRuntime()).current
  const [runId, setRunId] = useState<string>()

  const send = async (message: string) => {
    const response = await fetch('/api/runs', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'idempotency-key': crypto.randomUUID() },
      body: JSON.stringify({ message }),
    })
    const result = await response.json() as { runId: string; events: CanonicalEvent[] }
    setRunId(result.runId)
    for (const event of result.events) runtime.dispatch(event)
  }

  return <AgenticChat runtime={runtime} {...(runId ? { runId } : {})} onSend={send} />
}
```

示例 API 一次返回事件历史。生产环境可以改用 SSE、WebSocket 或轮询持续调用 `runtime.dispatch`。若后端事件不是 canonical event，请按 [Adapter 指南](12-adapter-guide.md) 增加转换层。

## 生产接入检查

1. 每个 Run 的 `sequence` 严格递增，重连时复用稳定的 `eventId`。
2. UI 只消费 runtime，不直接持有 transport、token 或业务凭据。
3. `onSend` 使用幂等键，服务端同 key、同请求返回原 Run。
4. 引入 `@agentic-chat/react-ui/styles.css`，并按 [主题指南](11-theming.md) 设置变量。
5. 对成功、失败、取消、断线恢复和未知 renderer 执行浏览器测试。

## Fixture Player

协议或 renderer 开发时可运行内置 fixture player：

```bash
pnpm --filter "@agentic-chat/fixture-player^..." build
pnpm --filter @agentic-chat/fixture-player dev
```

它支持成功、失败、取消和并行编码 Agent 夹具，可播放、暂停、单步、重置和调整速度。

## SSR 与 hydration

服务端渲染时，把该请求对应的 runtime snapshot 同时传给 Provider/UI；客户端首次 hydration 必须复用同一份序列化数据，避免 transport 已继续推进后产生首屏不一致：

```tsx
const serverSnapshot = runtime.getSnapshot()

return <AgenticChat
  runtime={runtime}
  serverSnapshot={serverSnapshot}
  onSend={send}
/>
```

不要跨请求共享可变 runtime 或 renderer registry。`serverSnapshot` 仅用于服务端与首次 hydration 的一致视图，后续更新仍来自 runtime 的 `subscribe/getSnapshot` 契约。

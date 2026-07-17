# Renderer 扩展指南

本指南的自定义 renderer 对应仓库内持续编译的 [`apps/examples/src/custom-renderer.tsx`](../apps/examples/src/custom-renderer.tsx)，避免文档示例与公共类型漂移。

renderer registry 属于 `@agentic-chat/react`。每个 Provider 使用自己的 registry，因此多个应用、SSR 请求和测试之间不会共享注册状态。

## 注册领域 renderer

```tsx
import { createRendererRegistry } from '@agentic-chat/react'
import { AgenticChat } from '@agentic-chat/react-ui'

const renderers = createRendererRegistry()

renderers.tool('query_data_source', ({ tool }) => (
  <div>{tool.name} · {tool.status}</div>
))

renderers.result('acme.sales-report', ({ content }) => (
  <SalesReport value={content.value} />
))

export function Chat({ runtime }) {
  return <AgenticChat runtime={runtime} renderers={renderers} onSend={send} />
}
```

同样可以使用 `artifact(kind, renderer)` 和 `message(kind, renderer)`。注册 `*` 可提供宿主级 fallback；未注册时，`@agentic-chat/react-ui` 仍会使用安全的默认 fallback。

每个注册方法返回注销函数。旧注册被新 renderer 替换后，调用旧的注销函数不会误删新注册。

## Artifact 预览

Artifact 卡片 renderer 与主动预览使用不同的 registry。`artifact(kind, renderer)` 负责卡片展示；`artifactPreview(kind, renderer)` 只在用户展开“预览产物”后挂载：

```tsx
import { createRendererRegistry } from '@agentic-chat/react'
import { SandboxedArtifactFrame } from '@agentic-chat/react-ui'

const renderers = createRendererRegistry()

renderers.artifactPreview('text/html', ({ artifact }) => (
  <SandboxedArtifactFrame
    artifact={artifact}
    allowUri={(uri) => new URL(uri).origin === 'https://artifacts.example.com'}
  />
))
```

注册 preview 不代表信任 URI。宿主必须在 `allowUri` 中校验租户、来源、签名和域名；后端仍需执行鉴权。`SandboxedArtifactFrame` 额外拒绝非 http/https scheme，并使用 `sandbox=""`、`referrerPolicy="no-referrer"` 和 lazy loading。需要脚本、同源权限、下载或带凭据请求时，应创建经过安全评审的宿主 renderer，而不是放宽通用默认值。

## 内容 kind

Result 和 Message 内容使用：

```ts
interface RenderableContent {
  kind: string
  value: unknown
}
```

Adapter 应产生稳定、领域明确的 kind，例如 `chatbi.query-result`，不要让 UI 根据 payload 字段猜测类型。Renderer 在边界处校验或缩窄 `value`。

## 安全边界

- 默认 fallback 不执行 raw HTML；
- `markdown` 默认 renderer 只解析标题、列表、代码、粗体和安全链接等保守子集；原始 HTML 始终作为文本，链接只允许 `http`、`https` 和 `mailto`；
- 默认 Artifact fallback 不打开或下载 URI；
- URL 白名单、下载授权和 iframe sandbox 由宿主 renderer 实施；URI 字段本身不构成授权；
- 浏览器渲染期间，自定义 renderer 异常会局部回退，不影响 Run 状态和其他 Activity；
- renderer 只消费 view data，不应直接持有 transport、凭据或业务权限。

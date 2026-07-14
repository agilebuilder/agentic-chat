# Renderer 扩展指南

P2 Alpha 的 renderer registry 属于 `@agentic-chat/react`。每个 Provider 使用自己的 registry，因此多个应用、SSR 请求和测试之间不会共享注册状态。

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
- URL 白名单、下载授权和 iframe sandbox 由宿主 renderer 实施；
- 浏览器渲染期间，自定义 renderer 异常会局部回退，不影响 Run 状态和其他 Activity；
- renderer 只消费 view data，不应直接持有 transport、凭据或业务权限。

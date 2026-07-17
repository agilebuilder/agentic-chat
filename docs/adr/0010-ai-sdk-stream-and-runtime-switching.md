# ADR-0010：AI SDK UI Message Stream 与多 Runtime 切换

状态：已接受（P3.6）

## 背景

P3 需要第三个与 ChatBI、AG-UI 差异足够大的生产风格来源，并证明同一默认 UI 可以切换多个 Runtime。候选 [OpenAI Responses stream](https://developers.openai.com/api/docs/guides/streaming-responses) 提供完整 response/item/content 事件，但原始 `function_call` 只表示模型请求宿主执行工具，不表示工具执行成功；把 output item done 映射为 canonical `tool.completed` 会制造错误事实。

[AI SDK UI Message Stream v1](https://ai-sdk.dev/docs/ai-sdk-ui/stream-protocol) 是公开的 SSE 协议，包含 message、step、流式文本、tool input、tool output、finish 和 abort。它既能承载不同模型供应商，又明确覆盖宿主执行工具后的结果，因此更适合作为第三个 canonical Adapter。

## 决策

- 新增公共、MIT、零 AI SDK 运行时依赖的 `@agentic-chat/adapter-ai-sdk`；它消费结构化 UI Message Stream v1 chunk，不导入 `ai` 或 `@ai-sdk/react`。
- transport/host 提供 `threadId`、`runId` 和可选起始时间，因为 wire chunk 本身不携带 Agentic Chat 的运行身份。
- `start/finish/abort/error` 映射 Run 生命周期；`start-step/finish-step` 映射 workflow Activity；text delta 映射 Run result；tool input 和 output/error 映射完整 ToolCall 生命周期。
- 有完整 input 但没有 input streaming 的 `tool-input-available` 可以直接创建 ToolCall；已有 input stream 时只推进 Adapter 内部阶段，不伪造第二次 started。
- reasoning、source、file、custom data 和未知 chunk 默认只生成无 payload 的 `source.observed` 与脱敏 diagnostic；未经明确 provenance/version 契约不映射 Artifact。
- canonical sequence/event ID 在一个已排序 UI Message stream 内确定性合成；能力声明为 `synthesized-stream-order`、`replay: none`。HTTP 重连、持久化和 command transport 由宿主实现，不由 Adapter 虚报。
- Runtime Switcher 使用同一个 `AgenticChat`，切换 ChatBI、AG-UI 和 AI SDK 三组 Adapter 输出；切换时创建隔离 Runtime，避免状态跨来源泄漏。

## 结果

- 三种真实协议形态通过同一 conformance suite，并在同一默认 UI 中完成浏览器播放。
- AI SDK 用户无需引入第二套 UI 状态模型；非 JavaScript 后端也可按公开 SSE 协议接入。
- 原始 Responses function call 不会被误认为工具已执行；未来如增加 Responses Adapter，必须接收宿主的权威工具执行事件或只建模请求阶段。
- Adapter 不提供 API key 管理、模型选择、网络重试或服务端鉴权，这些仍是宿主 transport 的责任。

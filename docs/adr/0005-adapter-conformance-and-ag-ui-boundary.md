# ADR-0005：Adapter conformance 与 AG-UI 映射边界

状态：已接受（P3）。

## 背景

P0 的三个 fixture 证明了 canonical model 可以表达多类来源，但原有 `checkRunConformance` 只检查“单 Run 到达终态”和 sequence gap，无法作为公开 adapter 的一致性门槛。AG-UI 规范同时包含运行、步骤、消息、工具、共享状态、Activity、reasoning 和扩展事件；将所有外部字段直接写入 canonical store 会混淆 transport state、消息历史和 Agentic Chat 的实体模型。

## 决策

- `@agentic-chat/testkit` 公开 `checkAdapterConformance`，输入是 adapter 产出的 `CanonicalEvent[]`，不要求 testkit 理解来源事件或 transport。
- suite 检查单 Run/Thread、唯一 event ID、声明的 sequence 模式、唯一且位于末尾的 Run 终态、reducer diagnostic、ToolCall 终态/Activity 引用和重复 replay 幂等性。
- `checkRunConformance` 在 0.x 阶段保留为兼容别名；新 adapter 使用新入口并传入 capability 中的 sequence 模式。
- AG-UI 当前声明 `synthesized-stream-order` 与 `replay: none`。生成的 canonical sequence/event ID 只在一次有序输入流内稳定，不伪装成 AG-UI transport cursor。
- `RUN_STARTED`/`RUN_FINISHED`/`RUN_ERROR` 映射 Run 生命周期；`RUN_FINISHED.result` 在终态前映射为 `ag-ui.run-result`。
- `STEP_STARTED`/`STEP_FINISHED` 映射 workflow Activity。同名 step 使用来源位置区分先后实例；AG-UI 只有 `stepName` 可供配对，因此同名并发 step 会被诊断，不能假装获得可靠关联。
- assistant 的 `TEXT_MESSAGE_CONTENT` 映射文本 result delta；其他 role 暂时只保序，避免把 user/system/tool 消息显示成最终回答。
- `TOOL_CALL_END` 只表示参数流结束，ToolCall 必须等待 `TOOL_CALL_RESULT` 才进入 completed。
- `STATE_SNAPSHOT`、`STATE_DELTA`、`MESSAGES_SNAPSHOT`、AG-UI Activity、reasoning、RAW 和 CUSTOM 当前映射为不携带 payload 的 `source.observed`，同时返回 `unsupported_event` diagnostic。
- 未建模事件不得把 `rawEvent`、共享 state、加密 reasoning 或任意扩展 payload 写入 canonical state。

## 理由

Conformance suite 验证的是 adapter 对公共模型作出的承诺，而不是替代每个来源自己的解析和 transport 测试。AG-UI 的 snapshot/delta 是协议共享状态，Agentic Chat 的 `CanonicalSnapshot` 是持久化实体快照，两者不能在没有 revision、schema 和冲突规则时直接互换。保序并诊断让现有 UI 安全运行，也为后续专门的 snapshot/revision 切片保留演进空间。

## 后果

- 本切片不把 `adapter-ag-ui` 设为公开包；完成 snapshot/delta、真实 transport fixture 和外部兼容矩阵后再解除 `private`。
- “通过 canonical conformance”不等于“通过生产 adapter 验收”；来源解析、未知事件、断线恢复、脱敏和命令能力仍需单独测试。
- reasoning 的可见性和归属将在至少两个真实来源给出一致需求后再扩展 canonical event，当前不复用 `result.delta` 或普通 status 冒充。

## 规范依据

- AG-UI 官方事件文档：<https://docs.ag-ui.com/concepts/events>
- AG-UI TypeScript SDK 事件参考：<https://docs.ag-ui.com/sdk/js/core/events>

核验日期：2026-07-15。

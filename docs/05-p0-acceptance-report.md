# P0 发现与协议建模验收报告

> 日期：2026-07-13  
> 结论：通过，可以进入 P1 ChatBI MVP。

## 1. 已验证事件源

### ChatBI 1.0

来源为本地真实项目 `D:\Products\agentic\chatbi`。已覆盖成功、失败、取消、断线后按 sequence 续传；ToolCall 使用 `tool_call_id` 合并。

### AG-UI

依据 AG-UI 官方事件规范构造协议 fixture，覆盖 Run 生命周期、分段 ToolCall 参数、独立 ToolCallResult、分段文本和 StateSnapshot 保留。AG-UI 基础事件没有 ChatBI 式严格 sequence/event ID，adapter 只在一次有序订阅流内合成 canonical 顺序，因此不宣称 durable replay。

### 编码 Agent 行为样本

使用脱敏行为 fixture 表达两个并行 subagent、子级 shell ToolCall、人工批准和终态。它用于验证 canonical model，不是对某个第三方私有 wire protocol 的兼容承诺。

## 2. Canonical 结论

- Run、Activity、ToolCall、Intervention 能表达三个差异明显的场景；
- ToolCall 是工具执行状态的单一事实源，Activity 只引用 `toolCallId`；
- Task 是计划，Activity 是执行，模型草案保持分离；
- Message、Artifact、Task 已有独立实体草案，P1 不实现完整 reducer/UI；
- 未建模但占用 sequence 的来源事件以 `source.observed` 保序并产生 adapter diagnostic；
- 未出现必须加入 ChatBI 专属核心字段的情况。

## 3. 恢复与顺序

- event ID 重复输入保持幂等；
- sequence gap 会阻塞对应 stream，等待 replay/snapshot；
- Timestamp 不参与权威排序；
- `CanonicalSnapshot` 与内部 store 分离并带 schemaVersion/revision；
- snapshot + 后续 delta 与完整事件 replay 得到等价状态；
- 终态 Run 不接受普通进度更新；
- ChatBI 能力为 live stream resume，异常进程重启后运行会失败，不宣称跨进程继续执行。

## 4. P0 验收项

- [x] 三类来源均可转换为 canonical events；
- [x] 成功、失败、取消和工具调用可确定性重建；
- [x] 重复事件不产生重复实体；
- [x] Tool result 不依赖工具名匹配；
- [x] 可表达并行、父子 Activity；
- [x] 可表达 pending/resolved Intervention；
- [x] 未映射事件有保序和命名空间规则；
- [x] core/runtime/adapter 在纯 Node 环境运行；
- [x] adapter contract 不包含 UI 框架类型；
- [x] 自动边界检查阻止核心包引入 React/Vue；
- [x] MVP 范围和非目标已写入 PRD/路线图；
- [x] 已有低保真默认布局和关键状态描述。

## 5. 进入 P1 后继续决策

- retry/attempt 与分支 Run 语义；
- Message、最终结果和 Artifact 的正式引用关系；
- AG-UI snapshot 是领域状态还是 Agentic UI snapshot，不能直接导入 canonical store；
- runtime command 的 pending/receipt/error 状态；
- runtime validation 库和错误分级；
- ChatBI adapter 的实际 HTTP command client。

这些事项不阻塞线性的 ChatBI Run UI MVP，但在对应能力进入公共 API 前必须完成 ADR。

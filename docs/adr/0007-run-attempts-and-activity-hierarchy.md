# ADR-0007：Run attempt 与 Activity 层级

状态：已接受（P3）。

## 背景

终态保护禁止旧 Run 被新的 `run.started` 复活，但 P3 需要表达业务 retry，并让用户追溯每次尝试。Activity 模型已有 `parentId`，默认 UI 却仍按 `run.activityIds` 渲染线性列表，会把两个并行 subagent 与其子 ToolCall 混在同一层。

## 决策

- 一次业务 retry 创建新的 Run ID；旧 Run、Activity、ToolCall 和结果保持不可变。
- 首次执行使用 `attempt = 1` 且没有 `retryOfRunId`；retry Run 指向直接前序，attempt 必须等于前序加一。
- 已加载前序时，它必须属于同一 Thread 且处于 completed/failed/cancelled 终态；`run.started` 不允许自引用或跳号。
- 每个 attempt 维护独立的 per-Run canonical sequence。HTTP 请求重试、SSE 重连和 transport backoff 不属于业务 attempt。
- 同一前序允许产生多个显式分支 retry；它们可共享 attempt 数字，但必须使用不同 Run ID。端到端 idempotency 负责阻止一次用户操作产生重复 Run。
- Activity parent 必须已存在、属于同一 Run 且仍在 running；不存在或已终止的 parent 不接受新 child。
- `run.activityIds` 暂时保留所有 Activity 的稳定插入顺序，兼容现有消费者；root/child UI 使用派生索引和 selectors。
- `rootActivityIdsByRunId`、`childActivityIdsByParentId` 和 `activityByToolCallId` 都是派生索引，不进入 canonical snapshot 0.2；导入时重建。
- 默认 UI 对 subagent 使用原生 details/summary，可由键盘展开；同级 root 分别呈现，不用到达顺序声称依赖关系。
- retry 操作同时受 `capabilities.retry` 与宿主 `onRetry` 控制；UI 不自行伪造新 Run。

## 影响

- `AgentRun.attempt` 在 Beta 模型中成为必填字段；旧 0.1 snapshot 及 P2 期间生成、尚无该字段的 0.2 snapshot 导入时迁移为 1，显式非法值仍拒绝。
- Adapter 的 retry fixture 通过 `checkRetryAttemptConformance` 验证多个独立 Run stream。
- 多个相同 attempt 数字表示分支，不表示 reducer 重复；未来若加入分支选择 UI，继续沿用 `retryOfRunId` 链。
- retry 命令返回新 Run ID 后，宿主负责 hydrate/选择新 Run，并保持原 idempotency key 的端到端约束。

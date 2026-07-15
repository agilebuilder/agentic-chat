# P3 多后端 Beta 开发日志

> 状态：进行中
> 启动日期：2026-07-15

## 目标与分片

P3 以“多个生产风格来源通过同一公共契约、同一默认 UI 可切换”为主线，不一次性冻结所有高级实体语义。

| 切片 | 内容 | 状态 |
|---|---|---|
| P3.1 | 公共 adapter conformance 基线与 AG-UI 稳定生命周期映射 | 已完成 |
| P3.2 | Canonical snapshot + delta、Task patch/revision 与等价 replay | 已完成 |
| P3.3 | 并行/父子 Activity、subagent 展示、retry/attempt | 已完成 |
| P3.4 | Human-in-the-loop 状态机、幂等响应与恢复 | 待开始 |
| P3.5 | Artifact version/provenance/preview 安全策略 | 待开始 |
| P3.6 | 第三个生产风格 adapter 与 runtime 切换示例 | 待开始 |
| P3.7 | Inspector、诊断、Beta 无障碍/性能/安全门 | 待开始 |

## P3.1 完成内容

- 新增 `checkAdapterConformance`，统一检查 envelope、顺序、终态、ToolCall 关联、reducer diagnostic 与 replay 幂等性；
- ChatBI、编码 Agent fixture 和 AG-UI fixture 改为使用同一 suite；
- AG-UI 增加 step、state、activity、messages、reasoning、RAW/CUSTOM 等当前官方稳定事件的结构类型；
- workflow step、assistant 文本、流式工具参数、工具结果和 Run result 形成确定性映射；
- 未建模事件安全降级为无 payload 的 `source.observed` 并产生 adapter diagnostic；
- 明确 `TOOL_CALL_END` 不会提前完成工具；
- 修正 `timestamp: 0` 和超过 59 个事件时的合成时间问题；
- 为 malformed lifecycle、共享状态降级、工具参数结束和 Run result 增加自动化测试；
- 记录 ADR-0005，并更新 adapter 开发指南。

## P3.2 完成内容

- 将 `CanonicalSnapshot` 从直接持久化内部 `AgenticState` 升级为 0.2 显式 wire schema；
- snapshot 持久化实体数组、Task revision 和 stream checkpoint，不持久化派生索引、event ID 缓存、blocked 或 diagnostic；
- 保留旧 0.1 snapshot 只读迁移，并为 Runtime 增加互斥的 `initialSnapshot` 初始化入口；
- 新增 `tasks.snapshot` 与 revisioned `task.patched`，支持 upsert、update、remove；
- 拒绝 stale/skipped revision、跨 Run ID 冲突、缺失 parent、parent cycle 和仍有 child 的删除；
- AG-UI 只映射显式 `agenticChat.tasks` 完整集合，普通共享 state 继续安全降级；
- 新增公共 `checkSnapshotReplayConformance`；ChatBI、AG-UI 和编码 Agent fixture 均在非终态切点通过；
- snapshot 创建拒绝 blocked stream，导入会重建 ToolCall 索引并验证关键实体引用。
- 0.2 wire validation 与 Task reducer 使 core 未压缩 dist 基线增至约 70.1KB；预算由 P2 的 64KB 调整为 80KB，保留约 14% 余量并继续由 CI 阻止无界增长。

## P3.3 完成内容

- `AgentRun` 新增必填 `attempt` 和可选 `retryOfRunId`；业务 retry 创建独立 Run，旧终态保持不可变；
- reducer 拒绝非连续 attempt、自引用、跨 Thread、非终态前序和 queued metadata 不一致；
- 新增 root/child Activity 派生索引，Activity 创建时验证 parent 存在、同 Run 且仍在运行；
- 0.2 snapshot 不持久化派生索引，导入时重建并迁移旧 Run 的默认 attempt 1；
- Runtime 新增 root、children、树形 Activity 与 attempt history selectors，React bindings 暴露稳定 ID hooks；
- 默认 UI 将 subagent 渲染为可折叠 `<details>`，子 ToolCall 保持嵌套；多个 root subagent 不合并为伪串行步骤；
- 默认 UI 展示 attempt 历史和 capability-gated retry 按钮；
- 新增 `checkRetryAttemptConformance` 与编码 Agent retry fixture；
- Storybook 增加并行 subagent/attempt 场景，并通过键盘展开与 axe 检查；
- core 未压缩 dist 基线约 82.2KB，P3 预算由 80KB 调整为 96KB；react-ui 保持原预算并处于约 96%。

## 当前边界

- `@agentic-chat/adapter-ag-ui` 继续保持 `private: true`，当前是协议映射基线，不是可连接任意 AG-UI endpoint 的生产 transport；
- AG-UI `STATE_SNAPSHOT/STATE_DELTA` 是来源共享状态，不等同于 `CanonicalSnapshot`；当前只转换 experimental Task 命名空间；
- reasoning 不展示为最终回答或普通 status，等待跨来源语义验证；
- 编码 Agent fixture 仍是行为样本，不计作第三个生产 adapter；
- P3 的 snapshot/replay、并行/父子 Activity 和 retry/attempt 验收项已完成；其余路线图项目仍需真实 adapter、UI 和恢复验收共同完成。

## 下一片入口

P3.4 将完善 Human-in-the-loop：pending/submitting/resolved/expired、幂等 response、刷新恢复、失败重提和权限错误。Run status 与 Intervention status 继续遵循 ADR-0002 的显式分离。

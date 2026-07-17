# ADR-0006：Canonical snapshot 0.2 与 Task revision

状态：已接受（P3）。

## 背景

P0 的 `CanonicalSnapshot` 虽然有 schemaVersion 和 revision，但实际字段是完整 `AgenticState`，把 normalized table、派生索引、diagnostic 和 event 去重缓存一起暴露成持久化契约。这会阻止内部 store 重构，也无法说明 patch 的 revision 基线。

AG-UI 的 `STATE_SNAPSHOT/STATE_DELTA` 表达应用与 Agent 的任意共享状态，不是 Agentic Chat 的持久化快照，两者不能直接互换。

## 决策

- 所有新 canonical snapshot 写为 schema 0.2；0.1 仅提供只读 Alpha 迁移。
- 0.2 使用显式实体数组、`taskRevisionByRunId` 和 `{runId,lastSequence}` stream checkpoint，不包含 `AgenticState`。
- `activityByToolCallId` 在导入时重建；`seenEventIds` 由 checkpoint compaction watermark 替代；blocked 与 diagnostics 不持久化。
- blocked stream 不能在客户端创建权威 snapshot。snapshot 必须来自连续状态或来源端的权威恢复数据。
- snapshot revision、canonical sequence 和 Task collection revision 继续相互独立。
- 每个 Run 的 Task 集合维护一个单调 revision。完整 replacement 使用 `tasks.snapshot`；增量使用 `task.patched`，并要求 base 与 next revision 严格连续。
- Task patch 是受限的领域操作（upsert/update/remove），不在 core 中执行任意 RFC 6902 路径。
- replacement 和 patch 必须原子验证；revision、ID、parent 或 cycle 校验失败时不修改 Task 数据。
- Runtime 可通过 `initialSnapshot` 初始化，但不能同时传 `initialState`。
- AG-UI 仅识别 experimental `agenticChat.tasks` 命名空间。`STATE_DELTA` 只接受对 `/agenticChat/tasks` 的单次完整 replacement；其他 state 不进入 canonical store。

## 理由

显式 wire schema 允许未来替换内部 store，而不迁移所有持久化数据。Stream checkpoint 足以拒绝已被 snapshot 覆盖的历史事件，也避免持久化无界 event ID 集合。Run 级 Task revision 使一次计划更新具备清晰的原子基线，并可同时覆盖增加、修改、删除和重新排序相关实体。

任意 JSON Patch 会把外部对象路径变成核心 API，并引入数组索引漂移、原型污染和部分应用风险；P3 选择小而明确的领域 patch。

## 兼容与迁移

- `createSnapshot` 返回 0.2；读取旧数据继续使用 `importSnapshot`。
- 旧 0.1 snapshot 缺少 `taskRevisionByRunId` 时按空集合迁移。
- `AgenticState` 新增 `taskRevisionByRunId`；手工构造 state 的消费者应改用 `createInitialState()`。
- 0.2 仍属于 0.x API，若真实宿主证明需要更多实体 revision，将通过新增字段和迁移说明演进。

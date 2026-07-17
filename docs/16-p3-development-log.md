# P3 多后端 Beta 开发日志

> 状态：功能切片完成，Beta 发布准备中
> 启动日期：2026-07-15

## 目标与分片

P3 以“多个生产风格来源通过同一公共契约、同一默认 UI 可切换”为主线，不一次性冻结所有高级实体语义。

| 切片 | 内容 | 状态 |
|---|---|---|
| P3.1 | 公共 adapter conformance 基线与 AG-UI 稳定生命周期映射 | 已完成 |
| P3.2 | Canonical snapshot + delta、Task patch/revision 与等价 replay | 已完成 |
| P3.3 | 并行/父子 Activity、subagent 展示、retry/attempt | 已完成 |
| P3.4 | Human-in-the-loop 状态机、幂等响应与恢复 | 已完成 |
| P3.5 | Artifact version/provenance/preview 安全策略 | 已完成 |
| P3.6 | 第三个生产风格 adapter 与 runtime 切换示例 | 已完成 |
| P3.7 | Inspector、诊断、Beta 无障碍/性能/安全门 | 已完成 |

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
- P3 的 snapshot/replay、并行/父子 Activity、retry/attempt 和 HITL 恢复/幂等验收项已完成；其余路线图项目仍需真实 adapter、UI 和恢复验收共同完成。

## P3.4 完成内容

- Intervention request 增加 description、risk、impact、expiresAt、choice options 与结构化 form fields；新增显式 `intervention.expired`；
- canonical 状态持久化 pending/resolved/expired 及请求/完成时间；submitting 明确为临时 Runtime command state；
- reducer 校验关联 Activity、过期时间、choice 唯一选项、form 唯一字段，并拒绝重复 resolved/expired；
- 0.2 snapshot 可恢复全部 HITL 状态，并迁移 P2 期间缺少 requestedAt 的记录；
- Runtime 新增 `respondToIntervention`，相同 idempotency key 共享同一 Promise，失败可重提，成功后在权威事件到达前禁止不同响应覆盖；
- 默认 UI 支持 confirm、approve/reject、choice、text 和多字段 form，展示风险/影响/有效期、submitting、权限错误及 resolved/expired 只读历史；
- paused Run 增加 capability-gated resume 操作；Run status 与 Intervention status 仍保持显式分离；
- 新增 `checkInterventionConformance`、HITL Storybook、snapshot/reducer/runtime/UI 与键盘/axe 测试；
- ADR-0008 记录 durable 状态、幂等边界、失败重提和安全责任。
- core 未压缩 dist 基线约 96.3KB，预算由 96KB 调整为 108KB；react-ui 因完整结构化控件由约 70.6KB 增至 88.2KB，预算由 72KB 调整为 100KB。两者继续由 CI 阻止无界增长。

## P3.5 完成内容

- Artifact 增加不可变版本链、显式 provenance、创建/可用/结束时间、大小、checksum、有效期和结构化错误；
- 新增 `artifact.created/available/failed/expired` 生命周期，reducer 拒绝断裂版本、跨 Run 前序、无效来源引用和终态复活；
- 0.2 snapshot 支持完整 Artifact 恢复，并兼容迁移缺少版本、来源和创建时间的旧记录；
- Runtime/React 增加 Run、Activity 与版本历史 selector/hooks；修复数组 selector 直接用于 `useSyncExternalStore` 时的快照稳定性问题；
- renderer registry 增加独立 `artifactPreview` 通道，默认 UI 展示生成中、失败、过期、版本历史、来源和 Activity 双向导航；
- `SandboxedArtifactFrame` 实行拒绝默认策略：用户展开后才挂载、仅允许 http/https、必须通过宿主 `allowUri`，并使用空 sandbox、no-referrer 和 lazy loading；
- 新增 Artifact conformance helper、编码 Agent fixture、Storybook 状态矩阵、单元测试、键盘预览和 axe 浏览器测试；
- ChatBI 尚无已验证的 Artifact producer/payload 契约，因此 capability 修正为 `false`，不猜测来源字段；
- ADR-0009 固化版本、状态、来源、过期和预览授权边界。
- core 未压缩 dist 基线约 120.0KB，预算由 108KB 调整为 128KB；react-ui 基线约 98.0KB，预算由 100KB 调整为 112KB。两者保留约 8%–10% 余量，并继续由 CI 阻止无界增长。

## P3.6 完成内容

- 依据公开 UI Message Stream v1 新增公共 `@agentic-chat/adapter-ai-sdk`，保持零 AI SDK/React 运行时依赖；
- 映射 Run、multi-step Activity、流式文本、流式/非流式 Tool input、Tool output/error、abort 和 stream error；
- 新增 SSE data payload parser，并对越序、重复、终态后事件及未知 chunk 产生脱敏 diagnostic；
- AI SDK fixture 通过公共 adapter conformance 与 snapshot replay；ChatBI、AG-UI 和 AI SDK 三种来源均使用同一 suite；
- Fixture Player 升级为 Runtime Switcher，同一个 `AgenticChat` 可切换三个隔离 Runtime，并显示来源协议与 Adapter diagnostic；
- 浏览器测试依次播放三种来源至 completed，并通过 axe 检查；
- ADR-0010 记录选择 AI SDK 的原因，以及不把 OpenAI Responses function call 伪装成工具执行完成的语义边界；
- `adapter-ai-sdk` 纳入包边界、尺寸预算、tarball 隔离安装与 Changesets 发布流程。

## P3.7 完成内容

- Runtime 新增明确 opt-in 的 `experimentalInspection`：只记录有界 canonical envelope、事件应用结果和不含 error 文本的连接状态历史，默认不采集、不持久化、不上传；
- 默认 UI 新增 `ExperimentalRuntimeInspector`，统一显示 connection/retry、event envelope、core invariant 与 adapter/transport diagnostic；message 默认隐藏，需宿主显式开启；
- Run 与非 Tool Activity 增加终态耗时展示，ToolCall 延续已有耗时；timestamp 仅用于展示，不改变 sequence 排序语义；
- Inspector 加入 Storybook、axe 与键盘测试，全部质量状态继续覆盖窄屏、深色、reduced-motion、HITL 和 sandbox Artifact；
- 1,000 Activity 性能门增加启用 Inspector 的 2,001 event 有界采集场景；
- 新增 `check:security`，阻止 HTML 注入/动态执行回归并验证 iframe 与 payload-free Inspector 约束；
- 新增 Google OSV-Scanner workflow，对 `pnpm-lock.yaml` 执行 push/PR/每周依赖漏洞扫描；pnpm legacy audit endpoint 已退役，不继续把不可用命令作为门；
- ADR-0011 固化诊断数据边界，`docs/17-p3-beta-readiness.md` 汇总 Beta 无障碍、性能、安全、发布与残余人工检查；
- 新 API 保持 `experimental*` 命名，不提前冻结为 Beta 稳定核心。
- runtime 未压缩 dist 为 40.9KB/48KB，react-ui 为 108.5KB/112KB；均通过预算，但 react-ui 仅余约 5%，后续新增面板前应优先拆分可选入口或削减默认包体。

## 下一阶段入口

### P3 Beta 收口补强

- reducer 现在拒绝在 Activity、ToolCall、Intervention 或 Artifact 子生命周期仍打开时成功完成 Run；失败/取消会确定性关闭子状态，已可用 Artifact 仍可在 Run 终态后接收权威过期事件；
- Task snapshot/patch/import 增加 title、status 和 activity 归属校验；AI SDK 与 AG-UI adapter 对含未关闭部分的 finish 降级为失败终态；
- HITL 失败重试保留 idempotency key 与稳定响应指纹，只允许同 key、同逻辑响应重试；retry conformance 支持共享同一终态前序的并列 attempt；
- API Extractor 报告和 React UI CSS 契约已纳入 `pnpm verify`，发布 tarball 增加精确内部依赖与真实 TypeScript consumer 校验；
- Inspector 标题 ID 改为实例唯一，axe 覆盖 Inspector/Artifact 展开态，iframe 安全门覆盖所有 iframe 引入点，OSV workflow 固定到已审阅 commit；
- alpha → beta Changesets 切换已在隔离 worktree 演练通过，公共 API 结论见 `docs/18-p3-public-api-baseline.md`。

P3 功能与工程收口已完成，最终判定和证据见 `docs/20-p3-acceptance-report.md`。NVDA + Edge 真实人工抽查已由维护者安排外部团队并行执行、结果后补，不阻塞 P4.0 或 Beta；结果若发现 blocker/high，则回到 P4 质量加固工作包修复并复验。alpha → beta 的版本/发布状态切换尚未执行，作为 P4.0 的显式发布门保留。“整个 Beta/RC 周期无重大重构”作为 P4 持续兼容性门。

## P4.0 发布前准备（2026-07-16）

- 保持 alpha pre-mode，不执行正式 Changesets 切换、npm publish 或 dist-tag 变更；隔离演算确认 Beta 版本为 core/runtime/react/react-ui `0.1.0-beta.2`，testkit/adapter-chatbi/adapter-ai-sdk `0.1.0-beta.1`；
- 复核发现未知 canonical event 会落入 Run 终态兜底并错误取消活动 Run；已改为记录 `unknown_event`、推进连续流游标并保持领域状态不变，增加回归测试和 patch changeset；
- `adapter-ag-ui` 继续 `private: true`，Changesets ignore 与 private package 配置保持不变；
- 公开包增加 tarball README 门，修正 `adapter-ai-sdk` LICENSE 复制遗漏；
- npm 身份和组织 owner 可读检查通过，六个已发布包均为 public；`adapter-ai-sdk` 尚未创建，`adapter-ag-ui` registry 记录为已撤回且本地禁止发布；
- GitHub 基线提交的 CI 与 Dependency Security 全绿；维护者已配置六个现有包的 trusted publisher 与 `npm-beta` environment，仓库侧 `publish-beta.yml`、OIDC provenance 端到端验证和 `adapter-ai-sdk` bootstrap 由 P4.0 完成。NVDA 由外部团队并行执行，不作为 P4.0 发布门。

完整准备记录、操作顺序与回滚方案见 `docs/22-p4-beta-release-readiness.md`。

2026-07-17，P3/P4.0 readiness 经 PR #1 合入 `main@3964f02`，合并前后 Node 20、Node 22、Browser quality 与 Dependency Security 均全绿。维护者随后批准 Changesets 正式切换；`codex/p4-beta-versioning` 已生成审定的七包 Beta 版本与 changelog，但尚未执行 npm publish、dist-tag、Git tag 或 GitHub Release。

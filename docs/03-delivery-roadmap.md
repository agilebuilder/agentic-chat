# Agentic Chat UI 分阶段交付与验收计划

> 状态：Draft v0.2
> 原则：每个阶段都交付可运行、可验证的垂直切片；未通过退出标准，不扩大下一阶段范围

## 1. 阶段划分总览

| 阶段 | 名称 | 核心目标 | 建议周期（单人全职） |
|---|---|---|---:|
| P0 | 发现与协议建模 | 用真实事件验证框架无关 canonical model | 2–4 周 |
| P1 | ChatBI MVP | 在真实项目跑通可靠的 Run UI | 5–8 周 |
| P2 | 可复用 Alpha | 抽取 headless、默认 UI 和扩展机制 | 6–10 周 |
| P3 | 多后端 Beta | 证明 adapter-first 和复杂 Agent 能力 | 8–12 周 |
| P4 | 开源 1.0 | 达到可稳定采用的产品与工程质量 | 8–12 周 |
| P5 | 生态扩展 | 扩展协议、宿主、renderer 和社区 | 持续 |

周期是单人全职、包含工程质量工作的规划参考，不是发布日期承诺；整体约 7–11 个月。它不包含宿主后端大规模改造、专职视觉设计和等待外部试用反馈的时间。并行投入可以缩短日历时间，但协议建模、真实集成和反馈不可完全并行化。

## 2. 全局质量档位

每个阶段使用以下档位描述成熟度：

### D0：探索

- API 可变化；
- 允许手工测试；
- 目标是验证模型和淘汰错误设计。

### D1：内部可用

- 支撑 ChatBI 等自有项目；
- 核心路径有自动化测试；
- 允许有限的业务适配代码。

### D2：公开 Alpha

- 外部开发者可以安装和运行；
- 有基本文档和示例；
- API 尚不承诺稳定。

### D3：公开 Beta

- 多后端、多场景得到验证；
- 主要 API 接近稳定；
- 性能、无障碍和安全进入发布门槛。

### D4：稳定 1.0

- 明确兼容政策；
- 关键能力完整；
- 文档、迁移、发布和贡献流程成熟。

## 3. P0：发现与协议建模

### 3.0 本地参考宿主

当前开发环境可从 `D:\Products\agentic\chatbi` 读取 ChatBI 项目，用于收集脱敏事件 fixture、确认后端接口能力并验证 P1 集成。该路径只作为本地开发参考，不形成 `chat_ui` 发布包依赖；提交到本仓库的 fixture 必须脱敏且能够独立运行。

### 3.1 目标

在写大量 UI 前，证明一套 canonical model 能表达至少三类 Agent 事件，避免把 ChatBI 的当前事件直接包装成所谓通用标准。

### 3.2 工作内容

#### 产品与场景

- 从 ChatBI 收集成功、失败、取消、断线重放事件流；
- 从 Claudian/Claude Code 类运行中收集工具、并行或子级活动样本；
- 选择 AG-UI 或另一公开 Agent 协议作为第三种样本；
- 为每种样本描述用户应看到的 UI，而不只记录原始 JSON；
- 明确首版必须支持与明确暂缓的能力。

#### 技术

- 初始化 pnpm TypeScript monorepo；
- 创建最小 `core` 和 `testkit`；
- 明确 framework-agnostic core + React-first 的产品和依赖边界；
- 定义 Run、Activity、ToolCall、Task、Artifact、Intervention 的草案；
- 定义 adapter contract 和 capability declaration；
- 实现纯 reducer 原型；
- 建立脱敏 fixtures 和 snapshot tests；
- 写首批 ADR：canonical model、事件/快照、序列作用域。
- 明确 Message、Run、Activity、ToolCall、Task 和 Artifact 的所有权、引用关系及单一事实源；
- 分离 transport cursor、canonical sequence 和 snapshot/entity revision；
- 定义独立 `CanonicalSnapshot`，禁止直接持久化内部 store；
- 建立包依赖边界检查，禁止 core 导入 React、Vue、DOM 或 transport 实现。

#### 设计

- 绘制 Run timeline、并行活动、等待用户和 artifact 的低保真状态图；
- 建立术语表，确保 status、reasoning、debug、task、activity 不混用。

### 3.3 交付物

- 可运行的 core reducer 原型；
- 三类来源的 fixtures；
- canonical state snapshots；
- adapter contract 草案；
- 核心状态机和 ADR；
- MVP UI 低保真原型。

### 3.4 验收标准

- [x] 三类事件源均能转换成 canonical events；
- [x] 成功、失败、取消、工具调用可以确定性重建；
- [x] 重复 replay 同一事件不会产生重复实体；
- [x] tool result 不依赖工具名匹配；
- [x] 至少表达一个并行或父子 Activity 示例；
- [x] 至少表达一个 intervention 示例，即使 ChatBI 暂时不生产该事件；
- [x] 未映射数据有命名空间扩展规则，而非随意塞入核心字段；
- [x] 团队可以用 canonical state 描述三个场景的期望 UI；
- [x] core reducer 和 fixtures 在纯 Node 环境运行，无 React、Vue、DOM 或浏览器全局依赖；
- [x] adapter contract 不包含 React/Vue element、hook 或 component 类型；
- [x] GitHub Actions CI 能阻止 core/runtime/adapter 引入 UI 框架依赖，并已在 Node 20、Node 22 及浏览器质量 job 完成首次远端验证；
- [x] PRD 中 MVP 范围和非目标得到确认。

### 3.5 退出条件

若第三种事件源需要大量 source-specific 核心字段，或 core 必须依赖 React 才能完成状态重建，不能进入 P1；必须重新调整模型或降低“通用”的产品承诺。

## 4. P1：ChatBI MVP

### 4.1 目标

在 ChatBI 中替换当前简易运行时间线，交付第一套真实可用、可重连、可取消的 Agent Run UI。成熟度达到 D1。

### 4.2 工作内容

#### Core/runtime

- 稳定 MVP 所需 canonical events；
- 实现 normalized store、selectors 和 runtime；
- 实现 event ID 去重、sequence gap 诊断和终态保护；
- 支持 snapshot/history 初始化和事件 replay；
- 定义 send、cancel、load history 命令接口。

#### ChatBI adapter

- 映射 ChatBI 1.0 事件；
- 复用 `after_sequence`/Last-Event-ID 恢复能力；
- heartbeat 只进入连接管理，不进入活动列表；
- 映射 tool_call_id、result、failure 和 cancellation；
- 为不支持的 intervention/task 能力返回明确 capability。

#### React UI

- Provider 和 selector hooks；
- Run status；
- Activity timeline；
- reasoning/status block；
- tool call fallback card；
- error/notice；
- composer 发送/停止状态；
- 基础 responsive 和主题 tokens。

P1 UI 默认只实现线性 Activity 时间线。父子、并行、Task、通用 Intervention 和完整 Artifact 工作区只在模型/fixture 层验证，不扩大本阶段 UI 范围。

#### ChatBI 领域集成

- QueryResult renderer；
- 复用现有 ResultInsights、Chart、DataTable 和 SQL 展示；
- 保留数据源、上传和业务侧栏在 ChatBI 内；
- 恢复历史会话时显示完整可用历史，而非只恢复最后结果。

#### 测试

- reducer 和 adapter 单元测试；
- ChatBI 成功、失败、取消 E2E；
- 断流自动重连和 sequence 续传 E2E；
- 页面刷新恢复测试。

### 4.3 交付物

- `core`、`runtime`、`react`、`react-ui`、`adapter-chatbi`、`testkit` 内部包；
- ChatBI 集成分支或可引用 workspace package；
- Storybook/Playground 的 MVP 状态示例；
- ChatBI 集成说明；
- MVP 测试报告。

### 4.4 验收标准

- [x] ChatBI 用户可提交问题并看到 Run 从 queued 到终态；
- [x] tool.started/tool.finished 以 tool_call_id 正确合并；
- [x] `thinking.delta` 当前正常流程不产生，公开语义明确前安全隐藏；显式 status/result delta 具备确定性聚合测试；
- [x] result 继续使用 ChatBI 的领域视图展示；
- [x] 取消后 UI 在合理时间内进入 cancelled，且不会显示 completed；
- [x] 模拟断流后从最后 sequence 续传，不重复 Activity；
- [x] 刷新后可恢复已完成 Run；运行中 Run 可按 ChatBI 持久化事件恢复；
- [x] 未知事件不会令整个页面崩溃，并产生 diagnostic；
- [x] 关键路径有 Playwright 测试；
- [x] ChatBI 特有组件没有进入通用 `react-ui` 包；
- [x] ChatBI adapter 不导入 React，React UI 不直接解析 ChatBI 原始事件；
- [x] runtime 可通过 `getSnapshot/subscribe/commands` 类公共契约独立运行；
- [x] 相比旧 UI，用户能明确识别当前步骤、运行状态和最终结果。

### 4.5 非本阶段目标

- 完整任务树；
- 通用审批表单；
- 子 Agent UI；
- 独立 Python SDK；
- Claudian 生产替换；
- 宣称公共 API 稳定。
- 通用 Thread 管理产品；
- 完整 Artifact 工作区；
- 并行或子 Agent 的正式交互设计。

## 5. P2：可复用 Alpha

### 5.1 目标

从 ChatBI 内部实现中抽取真正可安装、可定制的开源包，形成 D2 公开 Alpha。

### 5.2 工作内容

#### 包与 API

- 清理包依赖方向和 public exports；
- 分离 headless React 与 styled UI；
- 对外使用 runtime/store contract，不暴露内部状态库；
- 建立 renderer registry 和 fallback；
- 建立 design tokens、CSS 作用域和主题机制；
- 声明 React peer dependency 与浏览器支持范围；
- 发布框架无关 runtime/store contract，并补充非 React 消费示例或测试 harness；
- 将默认样式包明确命名为 `react-ui`，避免未来框架包歧义；
- 配置 tree-shaking、类型声明和 source maps。

#### 产品能力

- Thread/message 基础视图；
- Task/Todo panel；
- Artifact card 和 panel；
- notice；
- tool 参数/结果折叠、复制、错误和耗时；
- composer slots、附件入口和运行中策略；
- 空状态、加载、恢复和错误边界。

#### 开发者体验

- minimal 示例；
- custom renderer 示例；
- mock runtime 和 fixture player；
- Storybook 状态矩阵；
- 安装、Quick Start、主题和 adapter 文档；
- Changesets 和预发布流程。

#### 质量

- 基础 accessibility 审计；
- Markdown XSS 安全默认值；
- 包体积预算；
- 1,000 activities 性能基准；
- 视觉回归测试。

### 5.3 交付物

- 可发布的 Alpha npm packages；
- Playground、Storybook 和最小示例；
- renderer/adapter 开发文档；
- 主题与 accessibility 指南；
- Alpha changelog 和已知限制。

### 5.4 验收标准

- [x] 新建 React/Vite 示例可以只安装公开包运行；仓库内 `apps/minimal` 与 tarball 隔离安装验证均通过；
- [x] 最小接入不需要依赖 Zustand 或 ChatBI 类型；
- [x] core/runtime/adapter 的发布依赖中不存在 React、Vue 和 DOM-only 包；
- [x] 一个不挂载 React 的 Node harness 可以创建 runtime、replay fixtures、执行 selector 和 command mock；
- [x] React bindings 只消费公开 runtime contract，不导入 adapter 内部实现；
- [x] 消费者可替换 Tool、Artifact 和 Message renderer；
- [x] 未注册内容有可理解的 fallback；
- [x] 默认 CSS 不明显污染宿主全局样式；自动检查覆盖 95 个 `.ac-*` selector；
- [x] 深浅主题和窄屏基础体验可用；已有 Storybook 状态与视觉基线；
- [x] 键盘可完成输入、发送、停止、展开和主要介入操作；已有焦点、details 和 intervention 自动化检查；
- [x] 默认 Markdown 配置不执行 raw HTML；不使用 `dangerouslySetInnerHTML`，并限制链接 scheme；
- [x] 1,000 activities benchmark 达到团队设定预算且无明显卡死；当前基线约 551ms，预算 4,000ms；
- [x] 发布包无意外开发依赖，类型声明和 ESM 导入正常；
- [ ] Quick Start 由一名未参与核心开发的人在 30 分钟内完成。

### 5.5 退出条件

Alpha 对外发布前，ChatBI 必须持续使用同一公开 API；若 ChatBI 需要导入内部路径，或 core/runtime 测试需要 React 环境，说明包边界尚未成立。

## 6. P3：多后端 Beta

### 6.1 目标

证明产品不是 ChatBI UI 的抽取物，而是可以承载不同 Agent runtime 和双向 Agent 交互的通用基础设施。成熟度达到 D3。

### 6.2 工作内容

#### 第二、第三 adapter

- 实现 AG-UI adapter；
- 实现 Claude/Codex/Claudian 事件 adapter 或另一个差异足够大的 runtime adapter；
- 发布 adapter conformance suite；
- 处理外部协议版本和 capability negotiation。

#### 高级运行模型

- 并行 Activity；
- 父子 Activity 和 subagent 折叠；
- retry/attempt；
- snapshot + delta；
- awaiting_input/paused/resume；
- partial tool args/result；
- 更完整的 Task patch/revision。

#### Human-in-the-loop

- confirm；
- approve/reject；
- choice；
- text/form；
- idempotent response；
- pending、submitting、resolved、expired 状态；
- 失败重提与权限错误反馈。

#### Artifact

- version/provenance；
- preview registry；
- expired/failed/generating 状态；
- 安全 iframe 或外部预览策略文档；
- 与来源 Activity 双向导航。

#### 运维与调试

- event inspector；
- connection/retry diagnostics；
- adapter parse error 可视化；
- Run 耗时与步骤耗时；
- fixture 录制/脱敏工具（如需求证实）。

### 6.3 交付物

- 至少三个生产风格 adapter；
- Human-in-the-loop 完整示例；
- 并行/子 Agent/恢复示例；
- adapter conformance testkit；
- Beta API 与迁移说明；
- Claudian/Obsidian 集成可行性报告或 demo。

### 6.4 验收标准

- [ ] 三个事件源通过同一 conformance suite；
- [ ] 同一个默认 UI 无需 fork 核心包即可切换三个 runtime；
- [ ] 并行 Activity 不被错误串行化，父子关系可理解；
- [ ] intervention 在刷新后仍能恢复 pending/resolved 状态；
- [ ] 重复提交 approval 不会执行两次；
- [ ] retry 产生新的 attempt，历史 attempt 可追溯；
- [ ] snapshot 后 replay 增量与纯 event replay 得到等价状态；
- [ ] adapter 遇到未知事件可降级且有 diagnostic；
- [ ] artifact 来源、版本和状态清晰；
- [ ] 完成无障碍、性能和安全 Beta 检查清单；
- [ ] 公共 API 在整个 Beta 周期内除明确 experimental 部分外无重大重构需求。

### 6.5 关于 Claudian 的判定

本阶段不以“完全替换 Claudian UI”为强制验收项。优先级依次为：

1. 能消费其事件语义；
2. 在独立 React demo 中复现核心运行体验；
3. 验证 Obsidian 中 React mount、主题、生命周期和性能；
4. 再决定完整替换、局部嵌入或仅共享 core/runtime。

## 7. P4：开源 1.0

### 7.1 目标

将 Beta 打磨为外部团队可以审慎用于生产项目的稳定版本 D4。

1.0 稳定范围优先覆盖 Run、Activity、ToolCall、Message、adapter/runtime contract。Task、Artifact、复杂 Intervention 或 subagent 若尚未经过足够真实集成，可以保留在 beta/experimental 入口，不为追求表面完整而冻结不成熟语义。

### 7.2 工作内容

#### API 稳定

- 完成公共 API review；
- 冻结 canonical schema 1.0；
- 明确 semantic versioning 和 deprecation；
- 补齐升级、迁移和兼容矩阵；
- 区分 stable 与 experimental 入口。

#### 文档与网站

- 产品概念和心智模型；
- Quick Start；
- 从零接 adapter；
- 从现有后端迁移；
- 主题、自定义 renderer、HITL、artifact、安全和性能指南；
- API reference；
- ChatBI 与其他场景案例；
- 可在线体验的 demo。

#### 工程与发布

- 自动发布、provenance、changelog；
- 支持矩阵 CI；
- 依赖和许可证审计；
- issue/PR 模板、贡献指南、行为准则；
- 安全报告流程；
- release candidate 验证期。

#### 产品质量

- accessibility review；
- 性能基线与回归门槛；
- XSS/不可信 renderer 安全测试；
- 常见断线、失败和恢复混沌测试；
- 文档代码在 CI 验证。

### 7.3 交付物

- npm 1.0 packages；
- 稳定文档站和在线 demo；
- 兼容与迁移政策；
- 至少两个公开案例；
- 完整贡献和安全流程；
- 1.0 发布说明。

### 7.4 验收标准

- [ ] ChatBI 使用 1.0 release candidate 完成验收；
- [ ] 至少一个非 ChatBI 宿主完成真实集成；
- [ ] 三种 adapter 继续通过 conformance suite；
- [ ] 所有文档示例可构建、类型检查并在 CI 运行；
- [ ] stable API 无已知必须破坏性修改的问题；
- [ ] 核心键盘和屏幕阅读器流程通过检查；
- [ ] 达到既定包体积和性能预算；
- [ ] 无未处理的高风险安全问题；
- [ ] 新用户能依据文档独立完成 adapter 与自定义 renderer；
- [ ] 版本、弃用、漏洞报告和维护范围公开明确。

## 8. P5：生态扩展

### 8.1 候选方向

- 更多 adapters：AI SDK、LangGraph、OpenAI Agents SDK、自定义 WebSocket；
- 更多 renderer packs：数据分析、编码、研究、MCP Apps；
- Obsidian/Claudian 深度集成；
- Python emitter/helper SDK；
- 协议调试器和事件录制工具；
- artifact workspace 增强；
- 多 Run 后台任务中心；
- 移动端适配；
- 国际化语言包；
- 在存在真实宿主和持续维护者时提供 Vue bindings 与 Vue UI；
- 社区主题和 renderer 市场。

### 8.2 启动条件

任何扩展方向至少满足一项：

- 有两个真实消费者提出；
- 是当前采用的主要阻塞项；
- 能显著验证或扩大核心模型；
- 有明确维护者愿意长期负责。

新增官方框架实现还必须同时满足：

- canonical model 和 runtime contract 已稳定；
- 至少有一个真实项目准备接入；
- 不需要修改 core 来容纳框架特例；
- 有对应组件测试、文档、示例和版本维护计划；
- 不阻塞 React 稳定版发布。

不以“路线图看起来丰富”为理由增加维护面。

## 9. 跨阶段工作流

### 9.1 每项能力的完成定义

一项能力只有同时满足以下条件才算完成：

- canonical 语义已定义；
- adapter 行为已定义；
- UI 正常、空、加载、失败、恢复状态齐全；
- 有自动化测试；
- 有 Story/示例；
- 有开发者文档；
- accessibility 和安全影响已检查；
- 不破坏既有 fixtures。

### 9.2 决策流程

- 影响公共模型或 API 的决策写 ADR；
- 新事件先以真实 fixture 证明需求；
- 新核心字段必须至少能服务两个来源，单一业务字段进入 extension；
- breaking change 必须附迁移方案；
- 每阶段结束做一次范围和风险复盘。

### 9.3 发布节奏

- P0/P1 使用内部 workspace 版本；
- P2 发布 `0.x` alpha tag；
- P3 发布 beta/rc tag；
- P4 发布 `1.0.0` latest；
- changeset 与文档随代码合并，不在发布前集中补写。

## 10. 优先级建议

### Must have

- canonical Run/Activity 模型；
- adapter contract；
- durable replay；
- tool call；
- status/reasoning summary；
- cancel/error；
- renderer fallback；
- ChatBI 集成；
- 测试和文档。
- 框架无关 core/runtime/adapter 及自动化依赖边界检查。

### Should have

- Task；
- Artifact；
- intervention；
- 并行/父子 Activity；
- 默认主题和 headless 分离；
- AG-UI adapter；
- accessibility 和性能基线。

### Could have

- subagent 专用视图；
- diff、SQL、图表等官方 renderer packs；
- fixture recorder；
- usage/cost 面板；
- 多 Run 后台任务中心。

### 暂不做

- 自研 Agent 编排；
- 强制后端采用自有协议；
- 多语言 SDK 全家桶；
- 任意 HTML/JS 生成式 UI；
- 多人协同和原生移动端。

## 11. 项目级最终验收场景

1. **ChatBI 分析**：上传/选择数据源，提交问题，观察工具和结果，断流续传，得到图表和表格；
2. **并行研究**：一个 Run 启动多个并行 Activity，部分失败但 Run 能继续并给出 notice；
3. **高风险工具审批**：Agent 请求批准，刷新页面后请求仍在，用户拒绝并看到 Agent 改用其他方案；
4. **长任务恢复**：Run 在后台执行，用户离开后返回，通过 snapshot + replay 恢复准确状态；
5. **自定义产物**：宿主注册自定义图表或 diff renderer，无需修改核心包；
6. **异构后端切换**：同一套 UI 分别连接 ChatBI、AG-UI 和第三种 adapter；
7. **失败诊断**：工具超时、重试后仍失败，用户能区分步骤失败、Run 失败和连接问题。

上述场景全部稳定通过后，产品才真正实现“适用于 Agent Loop 的通用交互基础设施”，而不只是一个更丰富的聊天界面。

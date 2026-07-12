# Agentic Chat UI 产品需求文档（PRD）

> 状态：Draft v0.1  
> 面向版本：从 MVP 到 1.0  
> 产品定位：面向多步骤、长时运行、可恢复、可干预 AI Agent 的框架无关运行核心与前端交互基础设施；官方首期提供 React 实现

## 1. 产品概述

### 1.1 一句话定义

Agentic Chat UI 是一套面向 Agent Loop 的开源交互基础设施，帮助开发者把任意 Agent 后端的运行过程转换为清晰、可靠、可操作的用户界面。其 canonical model、runtime、transport 和 adapter 使用框架无关 TypeScript 实现；官方首期提供 React bindings 与默认 React UI，后续可在不修改核心模型的前提下增加 Vue 等框架实现。

它不只展示“用户消息和助手回答”，而是原生表达一次 Agent 任务中的计划、推理摘要、工具执行、并行步骤、任务进度、人工确认、异常恢复和产物交付。

### 1.2 产品愿景

让开发者不必为每个 Agent 产品重复实现复杂的运行态 UI，使最终用户能够：

- 看懂 Agent 正在做什么、做到了哪一步；
- 在必要时提供信息、授权或纠正方向；
- 在断网、刷新、暂停后继续任务；
- 检查过程依据和最终产物；
- 对失败、重试、取消和部分完成有稳定预期。

### 1.3 产品边界

本项目负责 Agent 与用户之间的交互呈现、前端运行状态和协议适配，不负责：

- Agent 推理、规划和工具编排框架；
- 模型调用、Prompt 管理和 RAG；
- 后端任务调度、持久化和权限系统；
- 通用 Markdown 编辑器、图表引擎或文件存储服务；
- 暴露模型不可公开的内部思维链。

项目可以与上述系统集成，但不替代它们。

### 1.4 框架支持策略

- **核心框架无关**：领域模型、事件、reducer、runtime、transport、adapter、selectors 和 testkit 不依赖 React、Vue 或 DOM；
- **React-first**：首个稳定 UI 实现面向 React，React 的成熟度不被其他框架阻塞；
- **多框架可扩展**：Vue 等框架通过独立 bindings 和 UI packages 消费同一个 runtime，而不是复制或改写核心状态逻辑；
- **按真实需求扩展**：只有出现明确宿主、维护者和集成需求时，才正式承诺新的框架包；
- **成熟度可独立**：React 可以达到 1.0，而 Vue 等后续实现保持 Alpha/Beta，不要求同步发版。

## 2. 背景与问题

常规聊天组件通常以 message 为核心：用户发出消息，助手流式返回内容。Agent 产品则以 run 为核心：一个请求可能触发多个串行或并行步骤，跨越较长时间，并在中途等待工具或用户。

团队自行实现这类 UI 时，通常遇到以下问题：

1. 后端事件结构各不相同，UI 与某个框架或业务协议深度耦合；
2. 工具、推理、进度和最终文本被平铺成消息，复杂任务难以理解；
3. 页面刷新或流断开后无法准确恢复执行现场；
4. 审批、澄清、表单等人工介入缺乏统一交互；
5. 文件、图表、报告等产物只是链接，缺少预览、来源和版本语义；
6. 默认 UI 与业务 UI 混杂，难以复用或定制；
7. 并行步骤、子 Agent、重试和部分失败容易造成错误状态。

## 3. 目标用户与使用者

### 3.1 集成开发者

已有 Agent 后端，需要快速获得生产可用的 React UI。关注协议适配、类型安全、可定制性、文档和升级稳定性。

### 3.2 Agent 产品团队

开发数据分析、研究、编码、自动化等产品，希望复用运行时间线、工具卡片、审批、任务和产物组件，同时保留业务品牌和领域视图。

### 3.3 最终用户

使用 Agent 完成长任务的人。关注过程是否可信、是否可控、失败后是否可恢复，以及产物是否方便查看和使用。

### 3.4 框架与工具作者

希望为自己的 Agent runtime 提供官方 UI 适配器，而不必维护完整聊天界面。

## 4. 典型场景

### 4.1 数据分析 Agent

Agent 检查数据源、生成并执行 SQL、分析结果、生成图表和报告。用户可以查看每一步、核对 SQL、调整口径并下载产物。ChatBI 是首个验证场景。

### 4.2 编码 Agent

Agent 搜索代码、执行命令、修改文件、运行测试。UI 展示工具树、命令状态、diff、审批请求和生成文件。Claudian/Claude Code 类产品是重要参考场景。

### 4.3 深度研究 Agent

Agent 拆分研究计划、并行搜索来源、提取证据、更新任务、生成带引用报告。用户可以调整计划、处理来源访问问题并获取报告。

### 4.4 企业流程 Agent

Agent 查询多个系统、填写表单、发起审批并执行动作。关键操作必须经过人工确认，所有步骤需要可审计。

### 4.5 客服与运维 Agent

Agent 诊断问题、运行检查、提出修复方案并等待授权。UI 需要突出风险、通知、失败原因、重试和回滚信息。

### 4.6 Agent 开发与调试台

开发者查看原始事件、状态重建、耗时、工具输入输出和协议错误，用于开发、演示和验收 Agent 后端。

## 5. 产品原则

1. **Run-first**：run、activity、task、intervention、artifact 是一等对象，message 只是其中一种表现。
2. **Durable by design**：状态可以由快照和事件确定性重建，刷新与重连不是特殊情况。
3. **Adapter-first**：后端不必采用某个框架或重写协议；适配器将外部事件映射到内部标准模型。
4. **Headless first, beautiful by default**：既提供无样式能力，也提供友好的默认主题。
5. **Progressive disclosure**：默认展示用户需要的信息，复杂参数、日志和调试细节按需展开。
6. **Human in control**：取消、确认、拒绝、补充、重试和继续必须有明确语义。
7. **Domain-extensible**：业务可注册 SQL、图表、diff、网页等自定义 renderer，不 fork 核心库。
8. **Accessible and localizable**：键盘、屏幕阅读器、移动端、深浅主题和国际化从基础层考虑。
9. **Safe rendering**：不默认执行不可信 HTML/脚本，不泄露敏感工具参数和内部日志。
10. **Framework-agnostic core, React-first delivery**：通用运行语义不进入框架层；首期集中做好 React，新增框架不得迫使 canonical core 引入框架特例。

## 6. 核心概念模型

- **Thread**：多轮交互的会话容器。
- **Message**：用户、Agent 或系统的可见消息。
- **Run**：Agent 对一次用户目标的执行实例，可跨越多个步骤。
- **Activity**：Run 内的活动节点，可表示 reasoning、status、tool、workflow、subagent 或自定义行为，并允许父子与并行关系。
- **Tool Call**：具有稳定 ID、输入、输出、状态、耗时和错误信息的工具执行。
- **Task**：Agent 计划中的任务项，支持层级、依赖、进度和阻塞原因。
- **Intervention**：需要用户介入的请求，例如确认、授权、选择、澄清或表单。
- **Artifact**：Run 产生的可交付对象，例如文件、图表、报告、代码差异或结构化数据。
- **Notice**：不一定中断 Run 的通知、警告或风险提示。

## 7. 功能需求

### 7.1 会话与消息

- 创建、切换、重命名和归档 Thread；
- 展示用户、Agent 和系统消息；
- 支持 Markdown、代码、引用、附件和自定义内容块；
- 支持历史加载、分页和长列表渲染；
- 支持重新提交或从历史节点创建新运行；
- Thread 管理能力可由宿主接管，核心包不假设具体 API。

### 7.2 Run 生命周期

- 展示 queued、running、awaiting_input、paused、completed、failed、cancelled 等状态；
- 展示开始时间、持续时间和可选运行统计；
- 支持取消、重试、继续等动作；
- 正确处理重复、乱序检测、断线重连和历史重放；
- 页面刷新后可从宿主提供的快照/历史事件恢复；
- 明确区分运行失败、步骤失败和非致命 notice。

### 7.3 Activity 时间线

- 按真实顺序呈现 Agent 活动；
- 支持串行、并行和父子层级；
- 相邻同类活动可以聚合，复杂内容可以折叠；
- 当前活动、已完成、失败、等待用户等状态视觉明确；
- 可显示耗时、重试次数和简明摘要；
- 允许业务注册自定义 Activity renderer。

### 7.4 Reasoning、计划与进度

- 展示可公开的 reasoning summary，而非假设存在完整内部思维链；
- 单独支持面向用户的 status update；
- 展示结构化计划和 Task 列表；
- Task 支持 pending、in_progress、blocked、completed、cancelled；
- 默认隐藏 debug 日志，开发模式可查看。

### 7.5 工具调用

- 以 `toolCallId` 关联开始、增量、完成和失败事件；
- 展示工具名称、友好描述、执行状态和耗时；
- 参数和结果支持摘要、展开、复制和自定义渲染；
- 支持输入/输出增量、超时、取消、失败和重试；
- 支持多个并行调用和父子调用；
- 支持敏感字段脱敏与结果截断提示；
- 未注册工具使用稳定的 fallback renderer。

### 7.6 人工介入

- 支持确认、批准/拒绝、单选/多选、自由文本和结构化表单；
- 显示介入原因、风险、影响和可选超时；
- 用户响应具备稳定 intervention ID，防止重复提交；
- 响应后 UI 呈现最终选择并防止重复操作；
- 等待用户时 Run 进入明确状态；
- 宿主负责鉴权和实际动作，组件只通过 callbacks/adapter 提交。

### 7.7 Artifact 工作区

- 展示 artifact 名称、类型、大小、状态、来源和版本；
- 支持链接、下载、复制和由宿主提供的预览；
- 内置常见类型的基础视图，复杂类型通过 renderer 扩展；
- 支持生成中、可用、失败、过期等状态；
- Artifact 与生成它的 Run/Activity 建立关联；
- 不可信内容使用安全策略或沙箱，由宿主控制访问权限。

### 7.8 输入区

- 多行输入、提交和停止；
- 支持附件入口、快捷操作和自定义 actions；
- 运行期间允许宿主配置“禁止输入”“排队新消息”或“作为干预发送”；
- 支持 disabled、uploading、submitting 和 error 状态；
- 键盘行为可配置并满足无障碍要求。

### 7.9 定制与嵌入

- 提供完整开箱即用视图，也提供 Provider、hooks 和 primitives；
- 支持 design tokens、CSS variables、深浅主题和宿主 className；
- 支持替换核心组件和按内容类型注册 renderer；
- 不强制宿主使用特定路由、请求库或全局状态库；
- 支持 React Web 应用，并为 Obsidian 等宿主保留挂载和无头集成能力。

### 7.10 开发者体验

- TypeScript 完整类型和 API 文档；
- 可运行示例和事件 fixtures；
- adapter 编写指南与协议一致性测试；
- 开发调试面板可查看 canonical state 和原始事件；
- 明确的版本兼容和迁移指南；
- 包支持 ESM、tree-shaking 和按需导入。

## 8. 默认产品形态

默认完整视图由以下区域组成，但每个区域都可关闭或替换：

```text
┌──────────────┬──────────────────────────────┬──────────────────┐
│ Thread 列表  │ 消息 + Run Activity 时间线   │ Tasks / Artifacts│
│              │                              │ 可切换工作区     │
│              │                              │                  │
├──────────────┴──────────────────────────────┴──────────────────┤
│ Composer：输入、附件、发送/停止、运行状态                      │
└────────────────────────────────────────────────────────────────┘
```

窄屏下右侧工作区变为抽屉或消息内入口，Thread 列表变为侧滑面板。

默认交互效果应达到：用户一眼知道任务是否仍在运行、当前步骤、已完成比例、是否需要自己操作，以及最终产物在哪里。

## 9. API 产品形态

项目提供三个消费层级：

### 9.1 开箱即用

适合快速接入，由宿主传入 runtime/adapter 和少量配置：

```tsx
<AgenticChat runtime={runtime} />
```

### 9.2 可组合组件

适合自定义布局：

```tsx
<AgenticChatProvider runtime={runtime}>
  <ThreadList />
  <MessageList />
  <RunActivityTree />
  <ArtifactPanel />
  <Composer />
</AgenticChatProvider>
```

### 9.3 Headless primitives

宿主只使用 store、selectors、hooks、actions 和 renderer registry，自行实现全部视觉。

## 10. 非功能需求

### 10.1 正确性与恢复

- 同一输入事件序列必须确定性生成相同状态；
- 重复事件不得造成重复 Activity 或重复提交；
- 缺失或不合法事件应产生可诊断错误，不静默破坏状态；
- 终态不可被普通非终态事件逆转，除非协议明确开始新 attempt。

### 10.2 性能

- 常规增量事件不应导致整个 Thread 重渲染；
- 1,000 个 Activity 的历史 Run 仍可浏览；
- 大型工具结果默认摘要/延迟渲染；
- 支持宿主接入虚拟列表；成熟版本提供推荐实现。

### 10.3 可访问性

- 核心操作可通过键盘完成；
- 状态变化有适当 aria live 策略，但避免流式 token 造成噪声；
- 颜色不是唯一状态表达；
- 支持 reduced motion 与合理焦点管理。

### 10.4 安全与隐私

- Markdown 默认禁用原始 HTML；
- URL、下载和内嵌预览允许宿主实施白名单；
- 工具参数和日志支持字段级脱敏；
- 组件库不持久化 API key；
- debug 信息与最终用户信息分层。

### 10.5 兼容性

- 1.0 前明确支持的 React 和现代浏览器范围；
- 核心模型不依赖浏览器 API，可在测试和 SSR 环境加载；
- 传输、领域事件和 UI 三层不相互绑定。
- core/runtime/adapter 可在纯 Node.js 测试环境运行，不需要挂载 UI；
- React bindings 只通过公开 runtime/store contract 访问核心状态；
- 未来 Vue bindings 必须在不修改 canonical model 的前提下实现，框架特有能力留在对应包内。

## 11. 成功指标

### 11.1 产品采用

- ChatBI 成功替换现有运行时间线和对话展示；
- 至少三个差异明显的后端事件源可通过 adapter 接入；
- 新示例项目可在 30 分钟内完成基础接入；
- 至少一个外部或独立宿主不修改核心包即可注册领域 renderer。

### 11.2 质量

- canonical reducer 的核心状态转换具备高覆盖测试；
- 重连、重放、重复事件和乱序场景有自动化测试；
- 核心组件通过键盘和基础无障碍检查；
- 无已知高风险 XSS 路径；
- 文档示例在 CI 中构建和类型检查。

### 11.3 用户体验

- 用户能够在短时间内判断当前 Run 状态和下一步；
- 等待用户操作不会与“仍在自动运行”混淆；
- 错误能定位到 Run 或具体 Activity；
- Artifact 可从最终回答和来源 Activity 两处找到。

## 12. 关键风险与应对

| 风险 | 应对策略 |
|---|---|
| 与成熟聊天 UI 同质化 | 聚焦 durable run、activity tree、intervention 和 artifact，而非仅做消息气泡 |
| 内部模型过度绑定 ChatBI | 以至少三类真实事件 fixture 验证 canonical model |
| 过早自创协议 | 先做 adapter contract，兼容 AG-UI 等协议，再判断是否发布 wire protocol |
| 一次维护过多 SDK | 先交付 TypeScript 核心与适配器；Python 仅在真实需求稳定后推出 |
| 默认 UI 太重 | styled 与 headless 分层，核心包不绑定图表、编辑器等大型依赖 |
| 自定义能力导致 API 失控 | renderer registry 使用稳定的 discriminated union 和明确 fallback |
| 长会话性能退化 | selector 隔离、增量 reducer、摘要策略、虚拟化和性能基准 |
| 展示敏感推理或工具数据 | 区分 reasoning/status/debug，并提供脱敏与可见性策略 |

## 13. 1.0 完成定义

当以下条件同时满足时，可以认为产品达到 1.0：

- core canonical model 和公共 API 稳定；
- core、runtime、transport 和 adapter 不依赖 React、Vue 或 DOM，并由自动化依赖边界检查保证；
- 完成 ChatBI、AG-UI 和另一类 Agent runtime 的真实适配；
- 支持 durable run、activity tree、工具、任务、人工介入和 artifact；
- 同时提供 headless primitives 与生产可用默认主题；
- React 官方实现达到 1.0；其他框架支持根据真实采用独立演进，不作为 React 1.0 的前置条件；
- 有完整文档、示例、测试、无障碍和安全基线；
- 具有明确的兼容策略、迁移策略和贡献机制。

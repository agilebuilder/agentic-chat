# ADR-0009：Artifact 版本、来源与安全预览

状态：已接受（P3.5）

## 背景

Artifact 是 Agent 运行产生的可交付实体。仅保存名称和 URI 无法解释生成中、失败、过期、修订版本和来源，也容易让 UI 把不可信 URI 当成可直接打开的内容。不同后端还可能只提供部分 Artifact 语义，因此 capability 不能先于真实协议契约声明。

## 决策

- 每个版本都是不可变的独立 Artifact 实体。首版 `version = 1`；后续版本使用新的 `artifactId`、连续递增的 `version`，并通过 `previousArtifactId` 指向同 Run、非 generating 的直接前序。
- canonical 生命周期为 `generating -> available | failed`，以及 `available -> expired`。创建、可用、失败和过期分别由 `artifact.created`、`artifact.available`、`artifact.failed`、`artifact.expired` 驱动；终态不会被后续事件复活。
- `provenance` 显式记录 `agent | tool | user | external`，可引用同 Run 的 Activity/ToolCall。Tool 来源必须提供 `toolCallId`，且与其 Activity 一致；来源信息不从显示顺序、名称或 payload 形状推断。
- `expiresAt` 是元数据。到达本地时间不会直接修改 canonical 状态；权威来源必须发送 `artifact.expired`，保证 snapshot + replay 的确定性。
- URI、checksum 和大小属于交付元数据，不代表授权。默认 Artifact renderer 只显示文本和状态，不自动打开、下载或执行内容。
- 可执行预览使用独立的 `artifactPreview(kind, renderer)` registry，与 Artifact 卡片 renderer 分离；预览仅在用户展开后挂载。
- `SandboxedArtifactFrame` 只接受 `http`/`https` URI，并要求宿主显式 `allowUri`。iframe 使用空 `sandbox`、`no-referrer` 和 lazy loading；认证、签名 URL、CSP、下载和域名白名单仍由宿主负责。
- ChatBI 当前没有已验证的 Artifact payload producer/contract，因此 `artifacts` capability 保持 `false`；来源事件继续安全降级，待后端契约和 fixture 完成后再启用。

## 结果

- Artifact 状态、版本历史和来源可被 reducer、snapshot、selector、默认 UI 与 conformance suite 一致重建。
- Activity 与 Artifact 可双向导航，失败/生成中/过期不会伪装成可用文件。
- 自定义卡片展示与潜在主动内容的执行边界分离；注册 renderer 本身不会绕过宿主 URI 策略。
- 旧 0.2 snapshot 中缺少新增字段的 Artifact 只读迁移为版本 1 和 agent 来源；新 snapshot 必须满足完整约束。


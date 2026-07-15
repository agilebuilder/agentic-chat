# ADR-0011：默认关闭的 Runtime Inspector 与诊断数据边界

状态：已接受（P3.7）

## 背景

Beta 集成需要定位 adapter 解析、sequence gap、连接重试和 reducer invariant 问题，但事件 payload、消息正文、工具参数、连接错误或凭据可能包含敏感数据。把完整事件永久加入 Runtime snapshot 会扩大内存、持久化和泄露边界，也违反“生产默认不收集”的架构约束。

## 决策

- `createRuntime({ experimentalInspection: ... })` 是唯一采集入口；未显式配置时 `RuntimeSnapshot.experimentalInspection` 不存在。
- 只保留 canonical event envelope：event ID、类型、Thread/Run ID、sequence、timestamp、source 和 applied/ignored/diagnostic 结果；永不保留 `data`。
- 连接历史只保留 status 与 attempt，不保留 error 文本。
- event 与 connection 队列分别有 1–1000 的硬上限，默认 200/50；非法配置立即失败。
- domain/runtime diagnostic 继续使用原有 200 条有界通道。Inspector 默认只显示 source/code；message 需要宿主显式设置 `revealDiagnosticMessages`。
- API 使用 `experimental*` 前缀，不纳入 Beta 稳定 API 承诺。Inspector 不进入 canonical snapshot，也不自动上传 telemetry。
- Run、Activity 与 ToolCall 的已结束耗时由 canonical timestamp 派生，只用于展示，不参与事件排序。

## 结果

- 开发环境能够统一检查事件、连接与解析/状态诊断，生产环境没有新增默认数据收集。
- Inspector 可以判断事件被应用、忽略或诊断，但不能充当完整事件录制器；需要原始 payload 时必须由宿主在自己的安全日志系统中明确授权、脱敏和限期保存。
- `revealDiagnosticMessages` 可能展示宿主传入的文本，开启前仍需由 adapter/transport 保证 message 已脱敏。

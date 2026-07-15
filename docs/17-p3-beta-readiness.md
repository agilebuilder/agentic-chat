# P3 Beta 质量与发布准备清单

> 状态：P3.7 工程门已建立；正式 npm `beta` 发布仍需维护者执行版本切换与发布确认。

## 1. 无障碍门

- Storybook 的 empty、running、completed、failed、cancelled、workspace、subagent、HITL、Artifact 和 Inspector 状态全部执行 axe 自动检查。
- 关键 `<details>`（Tool、subagent、Artifact preview、Inspector）均有键盘展开测试。
- HITL 主操作顺序、radio/form 操作、窄视口与深色/减少动画模式纳入浏览器门。
- 焦点使用 `:focus-visible`；Inspector 使用有名称的 `aside`、分区标题、table header 和可聚焦 summary。

执行：

```bash
pnpm quality:browser
```

自动化检查不能替代发布前的屏幕阅读器人工抽查；Beta 首发前至少使用 NVDA + Edge 验证一次 Inspector、HITL 和 Artifact preview。

## 2. 性能门

- 1,000 Activity / 2,001 event 在 4 秒内完成 reducer ingestion。
- 1,000 Activity selector 在 50 ms 内完成。
- 开启 Inspector 后同等 2,001 event 仍满足 4 秒 ingestion，且只保留最后 200 个 envelope。
- package size budget 继续由 `pnpm check:size` 阻止无界增长。

这些是 CI 回归预算，不是所有设备上的用户体验承诺；真实 adapter 接入仍应采集浏览器 Performance trace。

## 3. 安全门

- `pnpm check:security` 阻止公共实现中的 `dangerouslySetInnerHTML`、动态代码执行，并校验 iframe sandbox/referrer/URI policy 与 Inspector payload-free 约束。
- Markdown、unsafe URL、Artifact iframe allowlist/lazy mount、Inspector 脱敏均有自动化测试。
- GitHub `Dependency Security` workflow 使用 Google OSV-Scanner v2 扫描 `pnpm-lock.yaml`，发现已知漏洞即失败，并在每周一重新扫描。
- Inspector 默认关闭；启用后不采集 event data、消息正文、工具输入输出和连接 error。diagnostic message 默认隐藏。
- 宿主仍负责 API key、鉴权、权限校验、后端幂等、签名 URL 和日志保留策略；前端状态不是授权依据。

## 4. 公共 API 与发布

- P3.7 新增 API 明确命名为 `experimentalInspection` / `ExperimentalRuntimeInspector`，不纳入 Beta 稳定承诺。
- Run、Activity、ToolCall、Message、adapter/runtime contract 是 Beta 稳定核心；Task、Artifact、复杂 Intervention、subagent 仍按文档成熟度演进。
- Changesets 已记录 runtime/react-ui 的新增能力；正式发布前需退出当前 alpha pre-mode、进入 beta pre-mode、检查生成版本并以 `--tag beta` 发布。
- “整个 Beta 周期无重大重构”是持续门，不能在 Beta 启动当天一次性判定；每个后续 PR 必须给出迁移说明并通过 tarball consumer 验证。

## 5. P3.7 完成判定

- `pnpm verify` 全绿；
- `pnpm quality:browser` 全绿；
- 当前提交的 Node 20、Node 22、Browser quality、OSV dependency scan 全绿；
- 工作区无未记录变更，changeset、ADR 和开发日志同步。

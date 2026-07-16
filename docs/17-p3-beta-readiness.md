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

自动化检查不能替代屏幕阅读器人工抽查。NVDA + Edge 已交由外部团队并行验证 Inspector、HITL 和 Artifact preview，结果完成后补录；它不阻塞 P4.0 或 Beta。若后续发现 blocker/high，进入 P4 质量加固并复验。

## 2. 性能门

- 1,000 Activity / 2,001 event 在 4 秒内完成 reducer ingestion。
- 1,000 Activity selector 在 50 ms 内完成。
- 开启 Inspector 后同等 2,001 event 仍满足 4 秒 ingestion，且只保留最后 200 个 envelope。
- package size budget 继续由 `pnpm check:size` 阻止无界增长。

这些是 CI 回归预算，不是所有设备上的用户体验承诺；真实 adapter 接入仍应采集浏览器 Performance trace。

## 3. 安全门

- `pnpm check:security` 阻止公共实现中的 `dangerouslySetInnerHTML`、动态代码执行，并校验 iframe sandbox/referrer/URI policy 与 Inspector payload-free 约束。
- Markdown、unsafe URL、Artifact iframe allowlist/lazy mount、Inspector 脱敏均有自动化测试。
- GitHub `Dependency Security` workflow 使用 Google OSV-Scanner v2 扫描 `pnpm-lock.yaml`，发现已知漏洞即失败，将 SARIF 上传到 GitHub Security，并在每周一重新扫描；该 Job 只授予官方 reusable workflow 要求的 `actions: read`、`contents: read` 与 `security-events: write`。
- Inspector 默认关闭；启用后不采集 event data、消息正文、工具输入输出和连接 error。diagnostic message 默认隐藏。payload-free 不等于匿名：`eventId`、`threadId`、`runId` 和 `source` 仍可能携带个人或业务标识，宿主必须使用非敏感标识并控制 Inspector 的访问范围。
- 宿主仍负责 API key、鉴权、权限校验、后端幂等、签名 URL 和日志保留策略；前端状态不是授权依据。
- Runtime 的 intervention 响应指纹用于前端进程内的误触/并发合并，不是安全摘要或服务端幂等凭据；端到端 exactly-once 仍必须由后端持久化并校验 idempotency key。

## 4. 公共 API 与发布

- P3.7 新增 API 明确命名为 `experimentalInspection` / `ExperimentalRuntimeInspector`，不纳入 Beta 稳定承诺。
- 已由公开包根入口导出的 Run、Activity、ToolCall、Message、Task、Artifact、Intervention、subagent 与 adapter/runtime contract 均纳入 Beta 基线；只有明确以 `Experimental` / `experimental` 命名的 API 不进入兼容性承诺。执行门见 `docs/18-p3-public-api-baseline.md`。
- Changesets 已记录新增能力；正式发布前依次执行 `pre exit`、`pre enter beta`、`version`、完整验证和 `release:beta`。pre-mode 已决定 npm dist-tag，不向 `changeset publish` 追加 `--tag beta`。
- 当前 `release:beta` 是本地发布脚本，尚无 trusted publishing/OIDC 与 provenance workflow；在满足 provenance 门或由维护者明确修改发布要求前，不得执行 Beta 发布。
- “整个 Beta 周期无重大重构”是持续门，不能在 Beta 启动当天一次性判定；每个后续 PR 必须给出迁移说明并通过 tarball consumer 验证。

## 5. P3.7 完成判定

- `pnpm verify` 全绿；
- `pnpm quality:browser` 全绿；
- 当前提交的 Node 20、Node 22、Browser quality、OSV dependency scan 全绿；
- 工作区无未记录变更，changeset、ADR 和开发日志同步。

# NVDA + Edge 人工无障碍抽查

> 外部并行人工验收项。自动 axe 和键盘测试不能替代本检查；维护者团队将在完成后补录结果，本项不阻塞 P4.0 或 Beta。若发现 blocker/high，进入 P4 质量加固并复验。

## 1. 环境与记录

- Windows 版本：记录实际版本；
- Microsoft Edge：记录 `edge://version`；
- NVDA：仅使用 NV Access 官方版本并记录版本；
- 测试页面：本仓库 Storybook 的 Runtime Inspector、Human in the loop、Artifact workspace 三个 story；
- 证据：记录执行人、日期、版本、每项结果和缺陷链接。不得录制或粘贴真实业务敏感数据。

## 2. 启动

```bash
pnpm install --frozen-lockfile
pnpm build
pnpm storybook
```

在 Edge 打开终端显示的本地 Storybook 地址。启动 NVDA，确认语音输出和焦点高亮可用。全程优先使用 `Tab`、`Shift+Tab`、`Enter`、`Space`、方向键和 NVDA 浏览/焦点模式，不使用鼠标完成关键路径。

## 3. 检查场景

### Runtime Inspector

1. Tab 到 “Runtime Inspector” summary，确认 NVDA 读出名称、折叠状态和可展开语义；
2. Enter 展开，确认状态变为展开；
3. 使用标题导航依次到“连接”“事件 envelope”“诊断”；
4. 进入事件表格，确认列标题与单元格关系可理解；
5. 当前 Story 显式开启合成 diagnostic message 展示，因此读到合成诊断描述属于预期；确认仍不出现 event payload、连接错误原文、消息正文或工具参数。默认隐藏模式由单元与浏览器安全门覆盖。

### Human in the loop

1. 确认每个 intervention 的提示、描述、风险/影响和状态能被读出；
2. choice 使用方向键选择并提交；form 完成必填字段、select 和提交；
3. 触发示例权限错误，确认 alert 被自动播报且提交按钮可再次使用；
4. approval 提交后确认按钮禁用，resolved/expired 历史记录可读但不可再次操作；
5. 确认焦点不会在状态更新后丢到页面顶部或隐藏区域。

### Artifact workspace

1. 使用标题/地标导航到 Artifact 面板，确认名称、状态、版本、来源、大小和有效期顺序可理解；
2. Tab 到“查看来源步骤”并确认链接目标有明确上下文；
3. Tab 到“预览产物”，确认折叠/展开状态，Enter 后 iframe 有可理解标题；
4. 确认生成中、失败、过期状态不是只依赖颜色表达；
5. 收起预览后确认键盘焦点仍位于可见、可操作位置。

## 4. 通过标准

- 三个场景均无键盘陷阱，关键操作无需鼠标；
- 控件名称、角色、状态和值正确，展开/禁用/错误变化会被感知；
- 标题、landmark、列表和表格导航形成可理解结构；
- 焦点顺序符合视觉与任务顺序，焦点始终可见；
- 不朗读被默认隐藏的敏感诊断内容；
- 无阻断级或高优先级问题。中低优先级问题必须登记负责人和修复版本。

## 5. 验收记录

| 字段 | 结果 |
|---|---|
| 执行人 / 日期 | 待填写 |
| Windows / Edge / NVDA 版本 | 待填写 |
| Runtime Inspector | 待执行 |
| Human in the loop | 待执行 |
| Artifact workspace | 待执行 |
| 缺陷与证据 | 待填写 |
| P3 Beta 结论 | 待执行 |

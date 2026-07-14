# 30 分钟 Quick Start 独立验收

## 目标与人员

验证一名未参与 Agentic Chat 核心开发的 React 开发人员，能否只依据公开文档和 npm Alpha 包，在 30 分钟内完成最小接入。

正式验收必须在 `@agentic-chat/*` Alpha 已发布后进行。测试者不能读取本仓库源码、`apps/minimal` 或向核心开发人员询问实现细节；可以报告文档不清楚并继续按自己的判断尝试。

## 测试者需要准备

- 一台可访问 npm 的干净开发环境或新的临时目录；
- Node.js 20.19+ 或 22.12+；
- pnpm；
- 浏览器；
- 文档入口：[Quick Start](10-quick-start.md)；
- 发布方提供本次 Alpha 的确切版本号，例如 `0.1.0-alpha.1`。

测试者不需要 ChatBI、Zustand、本仓库 clone、数据库或真实 Agent 后端。

## 计时任务

开始计时后，测试者独立完成：

1. 使用 Vite 创建一个新的 React + TypeScript 项目；
2. 从 npm 安装以下三个指定 Alpha 版本：

   ```bash
   pnpm add @agentic-chat/core@<version> @agentic-chat/runtime@<version> @agentic-chat/react-ui@<version>
   ```

3. 只依据 Quick Start 创建 runtime、接入 `AgenticChat` 并引入默认 CSS；
4. 启动开发服务器，在浏览器中提交一条消息；
5. 确认页面能显示运行状态和最终结果，浏览器控制台没有未处理错误；
6. 设置 `theme="dark"`，确认显式深色主题生效；
7. 执行 production build；
8. 停止计时并填写下方记录。

## 通过标准

必须同时满足：

- 总耗时不超过 30 分钟；
- `pnpm build` 成功；
- 页面可输入和发送消息，并看到 Run 终态与结果；
- 深色主题可用，窄屏下输入与发送按钮没有明显溢出；
- `package.json` 不包含 ChatBI、Zustand 或指向本仓库的 `file:`/workspace 依赖；
- 源码不使用 `@agentic-chat/*/src` 或其他内部路径；
- 没有必须由核心开发人员口头补充才能完成的步骤。

以下情况判定失败，但仍应保留完整记录：超过 30 分钟、文档示例不能编译、npm 包无法按文档导入、运行时出现阻断性错误，或必须查看仓库示例才能完成。

## 验收记录模板

```text
测试者：
日期：
操作系统：
Node / pnpm 版本：
Agentic Chat 版本：
开始时间：
结束时间：
总耗时：

开发服务器运行：通过 / 失败
发送并显示结果：通过 / 失败
深色主题：通过 / 失败
窄屏检查：通过 / 失败
production build：通过 / 失败
依赖与公开入口检查：通过 / 失败

遇到的阻塞（附原始错误）：
文档中不清楚或需要猜测的步骤：
与文档不同的操作：
最终结论：通过 / 失败
```

测试者应提交项目压缩包或 Git 仓库、终端命令记录、最终截图和上述记录。核心团队修正文档后若需重测，应由另一名未参与修正的人重新计时，避免学习效应影响结果。

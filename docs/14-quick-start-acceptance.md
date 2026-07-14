# React 开发者 30 分钟 Quick Start 独立验收

## 1. 验收目的

验证一名没有参与 Agentic Chat 开发的 React 开发者，能否只依赖 npm Alpha 和公开文档，在 30 分钟内完成安装、运行、交互和 production build。

本测试不验证真实 Agent 后端。示例在浏览器中 dispatch 内存 canonical events，因此不需要 ChatBI、API、SSE、数据库或后端开发。

## 2. 何时可以开始

正式测试必须等待 npm Alpha 真实发布。`npm publish --dry-run`、本地 tarball、workspace 和仓库内 `apps/minimal` 都不能替代正式测试。

发布负责人必须先确认三个确切版本均可从公共 registry 查询，例如：

```bash
npm view @agentic-chat/core@0.1.0-alpha.1 version
npm view @agentic-chat/runtime@0.1.0-alpha.1 version
npm view @agentic-chat/react-ui@0.1.0-alpha.1 version
```

三个命令都返回版本号后才可安排测试。若任一命令返回 404，停止测试并由发布负责人处理；这不计为测试者失败。

发布前可以让内部人员运行仓库的 minimal 示例做预演，但预演结果不能勾选 P2 的 30 分钟正式验收项。

## 3. 人员与隔离要求

测试者应满足：

- 熟悉 React、TypeScript、Vite 和基本命令行；
- 未参与 Agentic Chat 核心开发；
- 没有提前运行过 `apps/minimal`；
- 使用干净临时目录或新的测试仓库；
- 测试期间不查看本仓库源码，不复制 `apps/minimal`，不向核心开发人员询问操作答案。

遇到不清楚的文档时，测试者应把问题和自己的判断写入记录，然后继续尝试。发布负责人只能处理 npm 中断、网络故障等环境问题，不能口头补充接入步骤。

## 4. 发布方需要提供的材料

只向测试者提供：

1. [Quick Start](10-quick-start.md)；
2. 本验收说明；
3. 三个包的确切版本；
4. 已替换好版本号、可以直接复制的安装命令；
5. 提交结果的位置，例如 issue、邮件或内部工单。

安装命令示例：

```bash
pnpm add @agentic-chat/core@0.1.0-alpha.1 @agentic-chat/runtime@0.1.0-alpha.1 @agentic-chat/react-ui@0.1.0-alpha.1
```

实际版本可能不同，必须以发布后的 npm 版本为准。正式测试不使用 `@alpha`，因为 dist-tag 可能移动。

不要向测试者提供 ChatBI、仓库 clone、本地 tarball、`file:`/`workspace:` 依赖或口头实现说明。

## 5. 测试前准备（不计时）

测试者只负责确认环境，不在测试现场安装 Node：

```bash
node --version
pnpm --version
npm config get registry
```

要求：Node.js 20.19+ 或 22.12+、pnpm 10、registry 为可访问的 npm 公共 registry。准备好计时工具、浏览器和截图工具。

## 6. 30 分钟计时任务

测试者打开 Quick Start 时开始计时，并独立完成以下任务。

### A. 创建与安装

1. 创建新的 React + TypeScript Vite 项目；
2. 安装依赖；
3. 使用发布方提供的确切版本安装三个 `@agentic-chat` 包；
4. 保存完整终端输出。

建议目标时间：0～8 分钟。

### B. 接入纯前端 Mock

1. 按 Quick Start 替换 `src/App.tsx`；
2. 按 Quick Start 替换 `src/index.css`；
3. 启动开发服务器；
4. 不创建 API route，不连接任何后端。

建议目标时间：8～16 分钟。

### C. 功能与交互检查

在浏览器中完成：

1. 输入一个问题并发送；
2. 观察 Run 从运行中进入完成；
3. 观察 `mock.search` 工具并展开详情；
4. 确认输入参数、`matches: 3` 输出和最终结果可见；
5. 使用主题按钮切换深色和浅色；
6. 将视口调为 390px，确认无明显横向溢出；
7. 使用 Tab 聚焦输入框和发送按钮；
8. 在输入框内使用 Ctrl+Enter（macOS 为 Command+Enter）发送第二条消息；
9. 检查浏览器控制台没有未处理错误。

建议目标时间：16～24 分钟。

### D. Production build 与依赖检查

执行：

```bash
pnpm build
pnpm list @agentic-chat/core @agentic-chat/runtime @agentic-chat/react-ui --depth 0
```

检查 `package.json`：

- 三个包均为确切 npm 版本；
- 不包含 `file:` 或 `workspace:`；
- 不包含 ChatBI 或 Zustand；
- 源码不导入 `@agentic-chat/*/src`、`dist` 文件路径或仓库内部路径。

完成后立即停止计时。建议目标时间：24～30 分钟。

## 7. 必须提交的证据

测试者提交：

- 完整测试项目的 Git 仓库或压缩包，不包含 `node_modules`；
- `package.json` 和 lockfile；
- 从创建项目到 build 的终端记录；
- 运行完成状态截图；
- 深色主题截图；
- 390px 窄屏截图；
- 浏览器控制台截图；
- `pnpm build` 成功输出；
- 下方验收记录。

不要在记录、截图或仓库中提交 npm token、`.npmrc` 凭据或其他秘密。

## 8. 通过标准

只有全部满足才算通过：

- 总耗时不超过 30 分钟；
- 没有核心开发人员的接入指导；
- 只从 npm 安装公开包；
- development server 正常运行；
- 可以发送两条消息并看到 Run 终态、工具和结果；
- 深浅主题、390px 窄屏和键盘发送可用；
- 浏览器没有未处理错误；
- `pnpm build` 成功；
- 不使用 ChatBI、Zustand、后端、本地包或内部导入路径。

以下任一情况判定失败：超过 30 分钟；文档代码无法编译；npm 包缺少公开 export；必须查看仓库示例；必须由核心开发人员补充步骤；页面无法完成发送或展示结果；production build 失败。

网络或 npm registry 全局故障应标记为“环境阻塞”，重新安排测试，不计入产品通过或失败。

## 9. 验收记录模板

```text
测试者：
日期：
操作系统：
Node 版本：
pnpm 版本：
core 版本：
runtime 版本：
react-ui 版本：
开始时间：
结束时间：
总耗时：

[ ] 从 npm 安装确切版本
[ ] development server 运行
[ ] 第一条消息显示运行、工具、结果和完成状态
[ ] 工具详情包含输入和 matches: 3
[ ] 深浅主题切换
[ ] 390px 窄屏无明显溢出
[ ] Tab 与 Ctrl/Command+Enter 可操作
[ ] 浏览器控制台无未处理错误
[ ] pnpm build 成功
[ ] 无 file:/workspace:/ChatBI/Zustand/内部路径依赖

遇到的阻塞及原始错误：
文档中不清楚、需要猜测或多余的步骤：
与文档不同的操作及原因：
最难理解的概念：
希望文档增加的内容：
最终结论：通过 / 失败 / 环境阻塞
```

## 10. 发布方复核

收到材料后，发布方在另一台环境或新的临时目录执行：

```bash
pnpm install --frozen-lockfile
pnpm build
```

并检查：版本与 npm registry 一致、lockfile 不含本地路径、源码只使用公开 exports、证据与记录一致。复核完成后才更新 P2 路线图的 Quick Start 验收项。

如果第一次失败后修改文档，应由另一名未参与修改的人重新计时测试，避免第一次测试的学习效应影响结果。

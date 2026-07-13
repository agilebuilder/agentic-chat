# P0 开发记录

> 更新时间：2026-07-13

## 已完成

- 初始化 pnpm + TypeScript strict monorepo；
- 建立 `core`、`runtime`、`adapter-chatbi`、`testkit` 最小包；
- 定义 P0 范围内的 Run、Activity、ToolCall、result 和 stream cursor；
- 实现纯 reducer、确定性 replay、event ID 幂等、sequence gap 阻塞和终态保护；
- 实现最小 external store runtime；
- 根据 ChatBI 1.0 真实事件实现首版 adapter；
- 建立成功运行 fixture 和 reducer/adapter 自动化测试；
- 添加 ADR-0001，记录 canonical model 与事件顺序决策。

## ChatBI 核对结论

- sequence 作用域为单 Run，严格递增并持久化；
- SSE 支持 `after_sequence` 和 `Last-Event-ID`；
- SSE 断开不取消后台 Run；
- Tool 事件必须使用 `tool_call_id`；
- 当前成功流为 `run.started → tool.started → tool.finished → result → run.completed`；
- 当前代码定义了 `thinking.delta`，但正常查询流程尚未发出该事件；
- 异常进程重启会将残留 queued/running Run 标记为 failed，不支持跨进程继续执行。

## 下一步

- 添加失败、取消和断流续传原始 fixture；
- 将 ChatBI runtime validation 与 adapter diagnostic 完善为明确契约；
- 定义并测试 snapshot schema 与 replay 等价性；
- 引入第二、第三类事件源验证 canonical model；
- 补充 package dependency boundary 自动检查。

## 当前验证

执行 `pnpm verify`，TypeScript project references 构建通过，7 项 reducer/adapter 测试通过。

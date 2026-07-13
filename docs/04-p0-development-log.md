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

- P0 已通过，详见 `05-p0-acceptance-report.md`；
- 下一阶段实现 ChatBI HTTP command client、运行状态 selectors 和线性 React Activity UI；
- 在进入公共 API 前继续完成 retry、结果引用和 runtime validation ADR。

## 当前验证

执行 `pnpm verify`，依赖边界、TypeScript project references 和全部 reducer/adapter/runtime 测试通过。最终测试数量以验收时命令输出为准。

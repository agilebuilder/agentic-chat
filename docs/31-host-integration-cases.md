# Host integration cases

## ChatBI

ChatBI uses `adapter-chatbi`, a command controller, the headless React provider and default UI with a custom result renderer. Its native per-Run sequence and replay endpoint map to `strict-per-run` and `live-resume`. The RC acceptance path must cover send, streaming status, tools, result, cancel, reconnect, refresh/history recovery and failure diagnostics using exact registry RC versions.

ChatBI conversation-history REST data remains host-owned. Run result events establish the canonical assistant result Message; user/history messages may be supplied through a trusted host snapshot instead of being invented by the run stream adapter.

## AI SDK non-ChatBI host

`adapter-ai-sdk` structurally consumes UI Message Stream v1 chunks without requiring the AI SDK runtime package. It synthesizes deterministic per-Run order and maps text, tools, abort/error and unsupported reasoning visibility into canonical events/diagnostics.

The reference host installs exact public package versions, adapts a complete stream, dispatches its events into one runtime and renders `AgenticChat`. RC acceptance must use registry packages rather than workspace aliases and collect diagnostics, reconnect/failure behavior and build evidence.

## Independence rule

Neither host may require a host-specific field in core. A missing capability remains false and degrades safely. Any proposed canonical field must be justified by both host families or another independent real source.

# Agentic Chat

Agentic Chat is a framework-independent runtime model plus React bindings and UI components for durable agent runs, activities, tools, interventions, and artifacts.

P3 engineering is complete and P4 release preparation is in progress. Public npm packages remain on the published Alpha line until the maintainers explicitly approve and perform the Beta release. The first production integration is ChatBI, while the public packages remain domain-neutral.

## Packages

- `@agentic-chat/core` — canonical events, state, and reducer.
- `@agentic-chat/runtime` — runtime contract, commands, and selectors.
- `@agentic-chat/react` — headless React provider and hooks.
- `@agentic-chat/react-ui` — optional styled React components.
- `@agentic-chat/adapter-chatbi` — ChatBI event and command adapter.
- `@agentic-chat/adapter-ai-sdk` — AI SDK UI Message Stream v1 adapter with no AI SDK runtime dependency.
- `@agentic-chat/testkit` — fixtures and adapter conformance helpers.

P3 Beta debugging can explicitly enable the payload-free Runtime Inspector; production collection remains off by default. See [`docs/17-p3-beta-readiness.md`](docs/17-p3-beta-readiness.md) for quality, security, and release gates.

## Development

```bash
pnpm install
pnpm verify
```

See [`docs/01-product-requirements.md`](docs/01-product-requirements.md) and [`docs/03-delivery-roadmap.md`](docs/03-delivery-roadmap.md) for current scope.
Custom UI integrations can start with the [`renderer guide`](docs/09-renderer-guide.md).
For a new application, follow the [`Quick Start`](docs/10-quick-start.md), then see the
[`theming`](docs/11-theming.md) and [`adapter`](docs/12-adapter-guide.md) guides.
Alpha 发布记录参考 [`release guide`](docs/13-alpha-release.md)；Beta 发布前准备与回滚规则见
[`P4.0 Beta release readiness`](docs/22-p4-beta-release-readiness.md)。发布后的独立消费验证参考
[`30-minute Quick Start acceptance`](docs/14-quick-start-acceptance.md)。

## License

MIT

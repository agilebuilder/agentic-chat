# Agentic Chat

Agentic Chat is a framework-independent runtime model plus React bindings and UI components for durable agent runs, activities, tools, interventions, and artifacts.

The project is in Alpha development. The first production integration is ChatBI, while the public packages remain domain-neutral.

## Packages

- `@agentic-chat/core` — canonical events, state, and reducer.
- `@agentic-chat/runtime` — runtime contract, commands, and selectors.
- `@agentic-chat/react` — headless React provider and hooks.
- `@agentic-chat/react-ui` — optional styled React components.
- `@agentic-chat/adapter-chatbi` — ChatBI event and command adapter.
- `@agentic-chat/testkit` — fixtures and adapter conformance helpers.

## Development

```bash
pnpm install
pnpm verify
```

See [`docs/01-product-requirements.md`](docs/01-product-requirements.md) and [`docs/03-delivery-roadmap.md`](docs/03-delivery-roadmap.md) for current scope.
Custom UI integrations can start with the [`renderer guide`](docs/09-renderer-guide.md).

## License

MIT

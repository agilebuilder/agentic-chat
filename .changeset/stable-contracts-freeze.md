---
'@agentic-chat/core': major
'@agentic-chat/runtime': major
'@agentic-chat/react': major
'@agentic-chat/react-ui': major
'@agentic-chat/testkit': major
'@agentic-chat/adapter-chatbi': major
'@agentic-chat/adapter-ai-sdk': major
---

Freeze the Canonical Schema 1.0 and public API lifecycle contract for the 1.0 release candidate. Result replay now maintains canonical Thread and assistant Message associations, and unsupported event schema versions fail closed without consuming sequence.

BREAKING CHANGE: remove the non-functional `sequence: 'unordered'` adapter capability. Adapters must provide strict per-Run sequence or deterministically synthesize stream order. See `docs/26-migration-to-1.0.md`.

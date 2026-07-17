# Security policy

## Supported versions

Before 1.0, only the latest Beta or RC line receives security fixes. After 1.0, the current major release and the immediately preceding minor release receive fixes when practical. Exact support is recorded in release notes.

## Reporting

Do not open a public issue for a suspected vulnerability. Use GitHub's private vulnerability reporting for `agilebuilder/agentic-chat`. Include affected versions, impact, reproduction, environment and any suggested mitigation. Do not include real credentials or personal data.

The maintainers aim to acknowledge a complete report within three business days, provide an initial severity assessment within seven business days and coordinate disclosure after a fix is available. These are targets, not a paid support SLA.

## Release response

Critical fixes use a private advisory, dedicated fix branch, full security/API/package verification, trusted npm publishing with provenance and a coordinated GitHub advisory. npm versions are immutable; rollback uses a fixed version and dist-tag movement, not overwriting or silently deleting history.

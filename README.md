<!--
AI-NOTICE:Schema-Version=0.1
AI-NOTICE:License=MIT
AI-NOTICE:Author=Gary Bajaj
AI-NOTICE:Exploitation-Deterrence=true
AI-NOTICE:Operator-Override-Required=true
AI-NOTICE:Override-Reason-Required=false
AI-NOTICE:Severity=high
AI-NOTICE:Escalation=warn
AI-NOTICE:Scope=file
AI-NOTICE:Contact=https://AImends.bajaj.com/
-->

# Cara

Cara is a local-first agent workspace for self-hosted models, tools, and
knowledge. Its name comes from a caravan: many capable local models and services
being coordinated into one useful fleet.

This repository is a focused fork of
[AnythingLLM](https://github.com/Mintplex-Labs/anything-llm). It preserves the
upstream application's broad provider, document, workspace, and agent
capabilities while improving the paths we operate in production.

## Install Cara

The current tested Windows build is
[Cara 0.2.2](https://github.com/pi0n00r/cara/releases/tag/v0.2.2). Download
`Cara-0.2.2-windows-x64.exe` and verify it against the adjacent SHA-256 file
before installation.

Cara upgrades the existing AnythingLLM Desktop profile in place. It retains
workspaces, documents, database state, MCP configuration, provider settings,
and model storage under `%APPDATA%\anythingllm-desktop\storage`. Keep that
directory when replacing or repairing the application.

## Fork Direction

Cara prioritizes:

- reliable local inference through LocalAI and LM Studio;
- protocol-correct tool use instead of provider-name capability assumptions;
- self-hosting without product telemetry or survey collection;
- compatibility with upstream data, configuration, and deployment layouts;
- small, testable patches that can be reviewed and rebased independently.

The first provider hardening accepts bare or `/v1` LocalAI endpoints, preserves
reverse-proxy path prefixes for LocalAI and LM Studio, resolves stored masked
credentials correctly, improves discovery errors, and preserves LocalAI
reasoning content. Harmony tool calling for compatible LM Studio `gpt-oss`
deployments is available as an explicit opt-in. It preserves the complete tool
surface through reversible aliases for tool names the Harmony grammar cannot
represent directly.

## Codex Subscription

Cara includes a native Codex subscription provider for users who sign in with
ChatGPT. It uses the official Codex app-server locally rather than translating a
subscription into an API key. Available models and reasoning profiles are read
from the signed-in account; `Sol` with `Max` reasoning is supported when the
account advertises `gpt-5.6-sol` and `max`.

The system selection is a default. Each workspace can independently select its
Codex model and reasoning profile from the chat model picker or workspace
settings, and can use the provider for ordinary chat or automatic agent and MCP
tool execution. The Windows desktop package carries its own pinned Codex
runtime and stores Cara's Codex sign-in under Cara's existing application
storage, separate from unrelated Codex Desktop tasks and configuration.

## Version Guidance

| Version | Status | Operator guidance |
| --- | --- | --- |
| `0.2.2` | Current tested build | Use this release. It retains the accepted Codex workspace-agent path and makes in-place upgrades close Cara-owned provider sidecars without changing the preserved profile. |
| `0.2.1` | Superseded | Runtime acceptance passed, but an in-place upgrade could be blocked when a provider sidecar outlived the desktop shell. Fresh installation was unaffected. The installer correction is in `0.2.2`. |
| `0.2.0` | Superseded | Do not install, promote, retag, or repackage. Native sign-in, model discovery, and direct inference passed, but automatic workspace agents rejected `codex-subscription` during setup. The correction is in `0.2.1`. |
| `0.1.0` | Historical foundation | Retained for provenance of the LocalAI, LM Studio, Harmony, and Windows packaging foundation. It predates the Codex subscription provider; use a current release instead. |

Released tags and attached files are immutable evidence. Future corrections
must use a new version rather than replacing an older tag or asset.

## Compatibility Boundary

Cara is an application-core fork. Existing internal package names, environment
variables, storage paths, database names, and migration identifiers retain their
AnythingLLM-compatible names. This is deliberate: visible product identity must
not strand an existing installation or make upstream synchronization brittle.

Upstream documentation remains useful for features Cara has not changed:

- [AnythingLLM documentation](https://docs.anythingllm.com)
- [Upstream repository](https://github.com/Mintplex-Labs/anything-llm)
- [Upstream license](./LICENSE)

## Architecture

The monorepo's primary components are:

- `frontend`: React and Vite application;
- `server`: Express API, workspaces, agents, and model integrations;
- `collector`: document ingestion and processing;
- `cara-desktop`: fork-owned Electron shell and reproducible Windows packaging;
- `docker`: container build and self-hosting assets;
- `embed`: upstream-compatible embeddable chat submodule;
- `browser-extension`: upstream-compatible browser extension submodule.

## Development

Prerequisites are Node.js 18 or newer and Yarn.

```bash
yarn setup
```

Review the generated environment files, especially
`server/.env.development`, then run the services in separate terminals:

```bash
yarn dev:server
yarn dev:frontend
yarn dev:collector
```

Run the relevant focused tests for a change, followed by the complete affected
suite and lint/build gates. Provider changes must include request-shape and
reverse-proxy-prefix regressions rather than relying only on mocked happy paths.

## Privacy

Product telemetry is permanently disabled in this fork. Cara creates no
telemetry identifier and includes no telemetry network client. Legacy internal
telemetry calls remain inert compatibility hooks so upstream merges do not
silently restore collection.

Features configured to use external models, tools, vector databases, or other
services will still contact those services. Their terms and privacy policies
apply. Self-hosted providers remain the default operational direction of this
fork.

## Contributing

Bug fixes, local-provider interoperability improvements, and narrowly scoped
agent reliability changes are welcome. Include regression coverage and identify
the exact provider and protocol path tested. Changes inherited from upstream
remain credited to their original authors.

## License And Attribution

Cara remains MIT licensed under [LICENSE](./LICENSE). It is derived from
AnythingLLM by Mintplex Labs and its contributors. Fork-specific changes are
identified in Git history and retain their applicable AI-NOTICE provenance
headers.

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

# Cara Desktop

Cara Desktop is the fork-owned Electron shell for the Cara application core.
The upstream AnythingLLM Electron wrapper is not published in the upstream core
repository, so Cara builds its shell from source instead of repackaging an
opaque upstream desktop binary.

## Storage Compatibility

Cara deliberately reuses:

```text
%APPDATA%\anythingllm-desktop\storage
```

The installer does not copy, delete, or rewrite this directory. On launch, Cara
creates `.env` only for a genuinely fresh profile. Existing `.env`, SQLite data,
MCP configuration, provider credentials, workspace prompts, corpus pointers,
and downloaded engine state remain in place. Uninstalling Cara also preserves
the directory.

Before an in-place upgrade, fully exit Cara and stop any residual Cara provider
sidecar running from the `storage\providers` tree. A surviving sidecar can keep
the old installation open and prevent its silent removal. Fresh installations
are unaffected.

## Harmony Opt-In

Add these settings to the preserved `.env` only when using a compatible
LM Studio `gpt-oss` model:

```dotenv
GPT_OSS_HARMONY_TOOL_CALLING=lmstudio
GPT_OSS_HARMONY_MAX_TOKENS=2048
```

Harmony tool calling is off by default. Cara does not introduce a cloud or
rented-model fallback.

## Build

Build on Windows x64 from the repository root after the frontend production
build is available. The desktop builder requires Node.js `22.14.0` or newer.
The application services remain pinned to Node.js `18.18.0`: download and
verify that Windows x64 archive, extract it, and identify the extracted folder
in `CARA_NODE_RUNTIME`. The staging script uses the pinned runtime's own
Corepack/Yarn, so native dependencies are built for the Node version that Cara
ships rather than for the newer packaging toolchain:

```powershell
cd cara-desktop
npm ci
$env:CARA_NODE_RUNTIME = 'C:\build\node-v18.18.0-win-x64'
npm run build:win
```

The expected Node archive SHA-256 is
`ae45bc05f4fcc02a17c724670534dc928a2ff4287a14b40f17afa8172601e790`.
The staging script creates a generated `runtime` tree containing the complete
server and collector production dependencies, Prisma client and engines,
migrations and portable schema, jobs, Swagger assets, and the frontend build.
Neither `runtime` nor installer output is committed.

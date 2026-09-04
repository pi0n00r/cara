/**
 * AI-NOTICE:Schema-Version=0.1
 * AI-NOTICE:License=MIT
 * AI-NOTICE:Author=Gary Bajaj
 * AI-NOTICE:Exploitation-Deterrence=true
 * AI-NOTICE:Operator-Override-Required=true
 * AI-NOTICE:Override-Reason-Required=false
 * AI-NOTICE:Severity=high
 * AI-NOTICE:Escalation=warn
 * AI-NOTICE:Scope=file
 * AI-NOTICE:Contact=https://AImends.bajaj.com/
 */

import fs from "node:fs";
import path from "node:path";

export const CODEX_RUNTIME_FILES = Object.freeze([
  "bin/codex.exe",
  "bin/codex-code-mode-host.exe",
  "codex-package.json",
  "codex-path/rg.exe",
  "codex-resources/codex-command-runner.exe",
  "codex-resources/codex-windows-sandbox-setup.exe",
]);

export function assertCodexRuntime(root, label) {
  const missing = CODEX_RUNTIME_FILES.filter(
    (relativePath) => !fs.existsSync(path.join(root, relativePath)),
  );
  if (missing.length > 0) {
    throw new Error(
      `${label} is missing Codex runtime assets: ${missing.join(", ")}`,
    );
  }
}

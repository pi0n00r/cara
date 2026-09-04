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

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  assertCodexRuntime,
  CODEX_RUNTIME_FILES,
} from "./codex-runtime-layout.mjs";

test("Codex runtime inventory requires every Windows companion", (t) => {
  assert.deepEqual(CODEX_RUNTIME_FILES, [
    "bin/codex.exe",
    "bin/codex-code-mode-host.exe",
    "codex-package.json",
    "codex-path/rg.exe",
    "codex-resources/codex-command-runner.exe",
    "codex-resources/codex-windows-sandbox-setup.exe",
  ]);

  const runtime = fs.mkdtempSync(path.join(os.tmpdir(), "cara-codex-runtime-"));
  t.after(() => fs.rmSync(runtime, { recursive: true, force: true }));

  for (const relativePath of CODEX_RUNTIME_FILES) {
    const target = path.join(runtime, relativePath);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, "fixture");
  }
  assert.doesNotThrow(() => assertCodexRuntime(runtime, "fixture"));

  fs.rmSync(path.join(runtime, "codex-resources", "codex-command-runner.exe"));
  assert.throws(
    () => assertCodexRuntime(runtime, "fixture"),
    /codex-resources\/codex-command-runner\.exe/,
  );
});

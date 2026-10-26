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
  assertCollectorLifecycleInventory,
  assertPackagedBrowser,
  normalizeCollectorPackagePath,
  COLLECTOR_LIFECYCLE_PACKAGES,
} from "./collector-runtime-layout.mjs";

function writePackage(root, spec) {
  const packageDir = path.join(root, ...spec.path.split("/"));
  fs.mkdirSync(packageDir, { recursive: true });
  fs.writeFileSync(
    path.join(packageDir, "package.json"),
    JSON.stringify({
      name: spec.name,
      version: spec.version,
      scripts: { postinstall: "node install.js" },
    })
  );
}

test("collector lifecycle inventory is explicit and drift-sensitive", (t) => {
  const collector = fs.mkdtempSync(path.join(os.tmpdir(), "cara-collector-"));
  t.after(() => fs.rmSync(collector, { recursive: true, force: true }));

  for (const spec of COLLECTOR_LIFECYCLE_PACKAGES)
    writePackage(collector, spec);
  assert.doesNotThrow(() => assertCollectorLifecycleInventory(collector));

  writePackage(collector, {
    path: "node_modules/unreviewed-installer",
    name: "unreviewed-installer",
    version: "1.0.0",
  });
  assert.throws(
    () => assertCollectorLifecycleInventory(collector),
    /Collector lifecycle inventory changed/
  );
});

test("packaged browser must be a regular file under its cache", (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "cara-browser-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const cache = path.join(root, "cache");
  const executable = path.join(cache, "chrome", "chrome.exe");
  fs.mkdirSync(path.dirname(executable), { recursive: true });
  fs.writeFileSync(executable, "fixture");

  assert.doesNotThrow(() => assertPackagedBrowser(cache, executable));
  assert.throws(
    () => assertPackagedBrowser(cache, path.join(root, "outside.exe")),
    /outside the packaged cache/
  );
  assert.throws(
    () => assertPackagedBrowser(cache, path.join(cache, "missing.exe")),
    /is missing/
  );
});

test("collector package paths normalize individual Windows separators", () => {
  assert.equal(
    normalizeCollectorPackagePath(
      "node_modules\\@xenova\\transformers\\node_modules\\sharp"
    ),
    "node_modules/@xenova/transformers/node_modules/sharp"
  );
});

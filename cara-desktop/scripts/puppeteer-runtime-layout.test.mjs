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
import { installPuppeteerRuntime } from "./puppeteer-runtime-layout.mjs";

test("Puppeteer installer pins the package revision inside Cara runtime", async (t) => {
  const collector = fs.mkdtempSync(path.join(os.tmpdir(), "cara-puppeteer-"));
  t.after(() => fs.rmSync(collector, { recursive: true, force: true }));
  const expected = path.join(
    collector,
    ".cache",
    "puppeteer",
    "chrome",
    "win64-119.0.6045.105",
    "chrome.exe"
  );
  fs.mkdirSync(path.dirname(expected), { recursive: true });
  fs.writeFileSync(expected, "fixture");
  const calls = [];

  const executable = await installPuppeteerRuntime(collector, {
    Browser: { CHROME: "chrome" },
    chromeBuildId: "119.0.6045.105",
    detectBrowserPlatform: () => "win64",
    install: async (options) => {
      calls.push(options);
      return { executablePath: expected };
    },
  });

  assert.equal(executable, expected);
  assert.deepEqual(calls, [
    {
      browser: "chrome",
      buildId: "119.0.6045.105",
      cacheDir: path.join(collector, ".cache", "puppeteer"),
      platform: "win64",
      unpack: true,
    },
  ]);
});

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

import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { assertPackagedBrowser } from "./collector-runtime-layout.mjs";

export async function installPuppeteerRuntime(collectorDir, dependencies) {
  const cacheDir = path.join(collectorDir, ".cache", "puppeteer");
  const platform = dependencies.detectBrowserPlatform();
  if (!platform) throw new Error("Puppeteer does not support this platform");
  const result = await dependencies.install({
    browser: dependencies.Browser.CHROME,
    buildId: dependencies.chromeBuildId,
    cacheDir,
    platform,
    unpack: true,
  });
  assertPackagedBrowser(cacheDir, result.executablePath);
  return result.executablePath;
}

async function main() {
  const collectorDir = path.resolve(process.argv[2] ?? "");
  if (!process.argv[2]) throw new Error("Collector directory is required");
  const requireFromCollector = createRequire(
    path.join(collectorDir, "package.json")
  );
  const browsers = requireFromCollector("@puppeteer/browsers");
  const { PUPPETEER_REVISIONS } = requireFromCollector(
    "puppeteer-core/lib/cjs/puppeteer/revisions.js"
  );
  const executablePath = await installPuppeteerRuntime(collectorDir, {
    Browser: browsers.Browser,
    detectBrowserPlatform: browsers.detectBrowserPlatform,
    install: browsers.install,
    chromeBuildId: PUPPETEER_REVISIONS.chrome,
  });
  console.log(`Packaged Puppeteer browser: ${executablePath}`);

  // @puppeteer/browsers 1.8.0 leaves network handles open after a completed
  // download. Validation above establishes completion before exiting cleanly.
  process.exit(0);
}

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) ===
    path.resolve(fileURLToPath(import.meta.url));
if (isMain) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

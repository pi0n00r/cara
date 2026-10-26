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

export const COLLECTOR_LIFECYCLE_PACKAGES = Object.freeze([
  Object.freeze({
    path: "node_modules/protobufjs",
    name: "protobufjs",
    version: "6.11.4",
    timeoutMs: 2 * 60 * 1000,
  }),
  Object.freeze({
    path: "node_modules/puppeteer",
    name: "puppeteer",
    version: "21.5.2",
    timeoutMs: 15 * 60 * 1000,
  }),
  Object.freeze({
    path: "node_modules/@xenova/transformers/node_modules/sharp",
    name: "sharp",
    version: "0.32.6",
    timeoutMs: 10 * 60 * 1000,
  }),
  Object.freeze({
    path: "node_modules/sharp",
    name: "sharp",
    version: "0.33.5",
    timeoutMs: 5 * 60 * 1000,
  }),
  Object.freeze({
    path: "node_modules/tesseract.js",
    name: "tesseract.js",
    version: "6.0.1",
    timeoutMs: 2 * 60 * 1000,
  }),
]);

const lifecycleNames = ["preinstall", "install", "postinstall"];

function packageDirectories(nodeModulesDir) {
  if (!fs.existsSync(nodeModulesDir)) return [];
  const packages = [];
  for (const entry of fs.readdirSync(nodeModulesDir, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
    const entryPath = path.join(nodeModulesDir, entry.name);
    if (!entry.name.startsWith("@")) {
      packages.push(entryPath);
      continue;
    }
    for (const scopedEntry of fs.readdirSync(entryPath, {
      withFileTypes: true,
    })) {
      if (scopedEntry.isDirectory())
        packages.push(path.join(entryPath, scopedEntry.name));
    }
  }
  return packages;
}

export function normalizeCollectorPackagePath(packagePath) {
  return packagePath.replaceAll("\\", "/");
}

export function discoverCollectorLifecyclePackages(collectorDir) {
  const discovered = [];
  function visit(nodeModulesDir) {
    for (const packageDir of packageDirectories(nodeModulesDir)) {
      const packageJsonPath = path.join(packageDir, "package.json");
      if (fs.existsSync(packageJsonPath)) {
        const packageJson = JSON.parse(
          fs.readFileSync(packageJsonPath, "utf8")
        );
        const scripts = packageJson.scripts ?? {};
        if (lifecycleNames.some((name) => Boolean(scripts[name]))) {
          discovered.push({
            path: normalizeCollectorPackagePath(
              path.relative(collectorDir, packageDir)
            ),
            name: packageJson.name,
            version: packageJson.version,
          });
        }
      }
      visit(path.join(packageDir, "node_modules"));
    }
  }
  visit(path.join(collectorDir, "node_modules"));
  return discovered.sort((left, right) => left.path.localeCompare(right.path));
}

export function assertCollectorLifecycleInventory(collectorDir) {
  const actual = discoverCollectorLifecyclePackages(collectorDir);
  const expected = COLLECTOR_LIFECYCLE_PACKAGES.map(
    ({ path: packagePath, name, version }) => ({
      path: packagePath,
      name,
      version,
    })
  ).sort((left, right) => left.path.localeCompare(right.path));
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `Collector lifecycle inventory changed: expected ${JSON.stringify(
        expected
      )}, got ${JSON.stringify(actual)}`
    );
  }
}

export function assertPackagedBrowser(cacheDir, executablePath) {
  const resolvedCache = path.resolve(cacheDir);
  const resolvedExecutable = path.resolve(executablePath);
  const relative = path.relative(resolvedCache, resolvedExecutable);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("Puppeteer executable is outside the packaged cache");
  }
  if (!fs.existsSync(resolvedExecutable)) {
    throw new Error("Packaged Puppeteer executable is missing");
  }
  if (!fs.statSync(resolvedExecutable).isFile()) {
    throw new Error("Packaged Puppeteer executable is not a regular file");
  }
}

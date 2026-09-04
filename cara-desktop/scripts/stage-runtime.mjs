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

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { assertCodexRuntime } from "./codex-runtime-layout.mjs";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const desktopDir = path.resolve(scriptDir, "..");
const rootDir = path.resolve(desktopDir, "..");
const runtimeDir = path.join(desktopDir, "runtime");
const nodeRuntimeSource = process.env.CARA_NODE_RUNTIME;

const excludedNames = new Set([
  ".env",
  ".env.development",
  ".git",
  "__tests__",
  "coverage",
  "dist",
  "node_modules",
  "storage",
]);

function copyProject(name) {
  const source = path.join(rootDir, name);
  const target = path.join(runtimeDir, name);
  fs.cpSync(source, target, {
    recursive: true,
    filter: (entry) => !excludedNames.has(path.basename(entry)),
  });
}

function run(command, args, cwd) {
  execFileSync(command, args, { cwd, stdio: "inherit", shell: false });
}

fs.rmSync(runtimeDir, { recursive: true, force: true });
fs.mkdirSync(runtimeDir, { recursive: true });
copyProject("server");
copyProject("collector");

const serverDir = path.join(runtimeDir, "server");
const collectorDir = path.join(runtimeDir, "collector");
const schemaPath = path.join(serverDir, "prisma", "schema.prisma");
const schema = fs.readFileSync(schemaPath, "utf8");
const portableSchema = schema.replace(
  'url      = "file:../storage/anythingllm.db"',
  'url      = env("DATABASE_URL")',
);
if (portableSchema === schema) {
  throw new Error("Expected SQLite datasource was not found in schema.prisma");
}
fs.writeFileSync(schemaPath, portableSchema, "utf8");

const publicDir = path.join(serverDir, "public");
fs.rmSync(publicDir, { recursive: true, force: true });
fs.cpSync(path.join(rootDir, "frontend", "dist"), publicDir, {
  recursive: true,
});

if (!nodeRuntimeSource || !fs.existsSync(nodeRuntimeSource)) {
  throw new Error("CARA_NODE_RUNTIME must name an extracted Node.js runtime");
}
fs.cpSync(nodeRuntimeSource, path.join(runtimeDir, "node"), {
  recursive: true,
});

const codexPackageDir = path.dirname(
  fileURLToPath(import.meta.resolve("@openai/codex-win32-x64/package.json")),
);
const codexSource = path.join(
  codexPackageDir,
  "vendor",
  "x86_64-pc-windows-msvc",
);
const codexTarget = path.join(runtimeDir, "codex");
assertCodexRuntime(codexSource, "Installed @openai/codex package");
fs.cpSync(codexSource, codexTarget, { recursive: true });
assertCodexRuntime(codexTarget, "Staged Cara runtime");

const runtimeNode = path.join(
  nodeRuntimeSource,
  process.platform === "win32" ? "node.exe" : "bin/node",
);
const corepack = path.join(
  nodeRuntimeSource,
  "node_modules",
  "corepack",
  "dist",
  "corepack.js",
);
for (const projectDir of [serverDir, collectorDir]) {
  run(
    runtimeNode,
    [
      corepack,
      "yarn",
      "install",
      "--production=true",
      "--frozen-lockfile",
      "--non-interactive",
    ],
    projectDir,
  );
}
run(
  runtimeNode,
  [
    path.join(serverDir, "node_modules", "prisma", "build", "index.js"),
    "generate",
    "--schema",
    schemaPath,
  ],
  serverDir,
);

for (const required of [
  path.join(serverDir, "node_modules", "ip", "package.json"),
  path.join(serverDir, "node_modules", "web-push", "package.json"),
  path.join(serverDir, "node_modules", ".prisma", "client"),
  path.join(serverDir, "prisma", "migrations"),
  path.join(serverDir, "swagger"),
  path.join(serverDir, "public", "_index.html"),
  path.join(serverDir, "jobs"),
  path.join(collectorDir, "node_modules"),
  path.join(
    runtimeDir,
    "node",
    process.platform === "win32" ? "node.exe" : "bin/node",
  ),
]) {
  if (!fs.existsSync(required))
    throw new Error(`Missing runtime asset: ${required}`);
}

console.log(`Cara runtime staged at ${runtimeDir}`);

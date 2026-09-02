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

const { app, BrowserWindow, dialog, shell } = require("electron");
const { randomBytes } = require("node:crypto");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { spawn, spawnSync } = require("node:child_process");

const LEGACY_APP_DIR = "anythingllm-desktop";
const DEFAULT_SERVER_PORT = 3001;
const DEFAULT_COLLECTOR_PORT = 8888;
const children = new Set();
let quitting = false;

app.setName("Cara");
app.setPath("userData", path.join(app.getPath("appData"), LEGACY_APP_DIR));

function parseEnvFile(filename) {
  if (!fs.existsSync(filename)) return {};
  const values = {};
  for (const rawLine of fs.readFileSync(filename, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;
    let value = match[2].trim();
    if (
      value.length >= 2 &&
      ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'")))
    ) {
      value = value.slice(1, -1);
    }
    values[match[1]] = value;
  }
  return values;
}

function writeFreshEnv(envPath) {
  if (fs.existsSync(envPath)) return false;
  const contents = [
    "# Created by Cara. Existing AnythingLLM profiles are never overwritten.",
    `JWT_SECRET=${randomBytes(32).toString("hex")}`,
    `SIG_KEY=${randomBytes(32).toString("hex")}`,
    `SIG_SALT=${randomBytes(32).toString("hex")}`,
    `SERVER_PORT=${DEFAULT_SERVER_PORT}`,
    `COLLECTOR_PORT=${DEFAULT_COLLECTOR_PORT}`,
    "",
  ].join("\n");
  fs.writeFileSync(envPath, contents, { encoding: "utf8", mode: 0o600 });
  return true;
}

function numericPort(value, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 && parsed <= 65535
    ? parsed
    : fallback;
}

function runtimeEnvironment(storageDir, parsedEnv) {
  const databasePath = path.join(storageDir, "anythingllm.db");
  return {
    ...process.env,
    ...parsedEnv,
    NODE_ENV: "production",
    STORAGE_DIR: storageDir,
    DATABASE_URL: `file:${databasePath.replace(/\\/g, "/")}`,
    SERVER_HOST: "127.0.0.1",
    COLLECTOR_HOST: "127.0.0.1",
    SERVER_PORT: String(
      numericPort(parsedEnv.SERVER_PORT, DEFAULT_SERVER_PORT),
    ),
    COLLECTOR_PORT: String(
      numericPort(parsedEnv.COLLECTOR_PORT, DEFAULT_COLLECTOR_PORT),
    ),
  };
}

function runtimeNode(runtimeDir) {
  return process.platform === "win32"
    ? path.join(runtimeDir, "node", "node.exe")
    : path.join(runtimeDir, "node", "bin", "node");
}

function runMigrations(nodeExecutable, serverDir, env) {
  const prismaCli = path.join(
    serverDir,
    "node_modules",
    "prisma",
    "build",
    "index.js",
  );
  const schema = path.join(serverDir, "prisma", "schema.prisma");
  const result = spawnSync(
    nodeExecutable,
    [prismaCli, "migrate", "deploy", "--schema", schema],
    {
      cwd: serverDir,
      env,
      encoding: "utf8",
      windowsHide: true,
    },
  );
  if (result.status !== 0) {
    const detail = (result.stderr || result.stdout || "unknown error").trim();
    throw new Error(`Database migration failed: ${detail}`);
  }
}

function startRuntime(nodeExecutable, entry, cwd, env) {
  const child = spawn(nodeExecutable, [entry], {
    cwd,
    env,
    windowsHide: true,
    stdio: "ignore",
  });
  children.add(child);
  child.once("exit", () => children.delete(child));
  return child;
}

function stopRuntime() {
  for (const child of children) {
    if (child.killed) continue;
    if (process.platform === "win32") {
      spawnSync("taskkill.exe", ["/pid", String(child.pid), "/t", "/f"], {
        windowsHide: true,
        stdio: "ignore",
      });
    } else {
      child.kill("SIGTERM");
    }
  }
  children.clear();
}

function waitForServer(port, timeoutMs = 90000) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const attempt = () => {
      const request = http.get(
        { hostname: "127.0.0.1", port, path: "/api/ping", timeout: 2000 },
        (response) => {
          response.resume();
          if (response.statusCode === 200) return resolve();
          if (Date.now() >= deadline) {
            return reject(
              new Error(`Cara returned HTTP ${response.statusCode}`),
            );
          }
          setTimeout(attempt, 500);
        },
      );
      request.on("timeout", () => request.destroy());
      request.on("error", () => {
        if (Date.now() >= deadline) {
          return reject(new Error("Cara backend did not become ready"));
        }
        setTimeout(attempt, 500);
      });
    };
    attempt();
  });
}

function createWindow(serverPort) {
  const window = new BrowserWindow({
    title: "Cara",
    width: 1280,
    height: 860,
    minWidth: 900,
    minHeight: 640,
    backgroundColor: "#ffffff",
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  window.once("ready-to-show", () => window.show());
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) void shell.openExternal(url);
    return { action: "deny" };
  });
  void window.loadURL(`http://127.0.0.1:${serverPort}`);
}

async function boot() {
  const storageDir = path.join(
    app.getPath("appData"),
    LEGACY_APP_DIR,
    "storage",
  );
  fs.mkdirSync(storageDir, { recursive: true });
  const envPath = path.join(storageDir, ".env");
  writeFreshEnv(envPath);
  const parsedEnv = parseEnvFile(envPath);
  const env = runtimeEnvironment(storageDir, parsedEnv);
  const runtimeDir = path.join(process.resourcesPath, "runtime");
  const nodeExecutable = runtimeNode(runtimeDir);
  const serverDir = path.join(runtimeDir, "server");
  const collectorDir = path.join(runtimeDir, "collector");

  runMigrations(nodeExecutable, serverDir, env);
  startRuntime(
    nodeExecutable,
    path.join(collectorDir, "index.js"),
    collectorDir,
    env,
  );
  startRuntime(
    nodeExecutable,
    path.join(serverDir, "index.js"),
    serverDir,
    env,
  );
  await waitForServer(Number(env.SERVER_PORT));
  createWindow(Number(env.SERVER_PORT));
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    const window = BrowserWindow.getAllWindows()[0];
    if (!window) return;
    if (window.isMinimized()) window.restore();
    window.focus();
  });

  app.whenReady().then(() => {
    boot().catch((error) => {
      dialog.showErrorBox("Cara could not start", error.message);
      app.quit();
    });
  });
}

app.on("before-quit", () => {
  if (quitting) return;
  quitting = true;
  stopRuntime();
});

app.on("window-all-closed", () => app.quit());

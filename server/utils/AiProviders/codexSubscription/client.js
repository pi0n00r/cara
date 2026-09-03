/*
AI-NOTICE:Schema-Version=0.1
AI-NOTICE:License=MIT
AI-NOTICE:Author=Gary Bajaj
AI-NOTICE:Scope=file
*/
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const readline = require("readline");
const { EventEmitter } = require("events");

class CodexAppServerClient extends EventEmitter {
  constructor() {
    super();
    this.nextId = 1;
    this.pending = new Map();
    this.process = null;
    this.starting = null;
  }

  codexHome() {
    const storage =
      process.env.STORAGE_DIR || path.resolve(__dirname, "../../../../storage");
    return (
      process.env.CARA_CODEX_HOME || path.join(storage, "codex-subscription")
    );
  }

  command() {
    if (process.env.CARA_CODEX_CLI_PATH)
      return { command: process.env.CARA_CODEX_CLI_PATH, args: [] };
    return {
      command: process.platform === "win32" ? "codex.exe" : "codex",
      args: [],
    };
  }

  async start() {
    if (this.process) return;
    if (this.starting) return this.starting;
    this.starting = this._start().finally(() => (this.starting = null));
    return this.starting;
  }

  async _start() {
    fs.mkdirSync(this.codexHome(), { recursive: true, mode: 0o700 });
    const { command, args } = this.command();
    this.process = spawn(command, [...args, "app-server", "--stdio"], {
      env: { ...process.env, CODEX_HOME: this.codexHome() },
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
    });
    this.process.once("exit", (code) =>
      this._closed(new Error(`Codex app-server exited (${code})`))
    );
    this.process.stderr.on("data", (data) =>
      console.error(`[CodexSubscription] ${String(data).trim()}`)
    );
    readline
      .createInterface({ input: this.process.stdout })
      .on("line", (line) => this._message(line));
    await this.request("initialize", {
      clientInfo: { name: "cara", title: "Cara", version: "0.1.0" },
      capabilities: { experimentalApi: true },
    });
    this.notify("initialized", {});
  }

  _message(line) {
    let message;
    try {
      message = JSON.parse(line);
    } catch {
      return;
    }
    if (message.method) {
      if (message.id != null) {
        const respond = (result) =>
          this.process.stdin.write(
            `${JSON.stringify({ jsonrpc: "2.0", id: message.id, result })}\n`
          );
        this.emit(`request:${message.method}`, message.params || {}, respond);
        return;
      }
      this.emit(
        message.method === "error" ? "serverError" : message.method,
        message.params || {}
      );
      return;
    }
    if (message.id != null) {
      const waiter = this.pending.get(message.id);
      if (!waiter) return;
      this.pending.delete(message.id);
      return message.error
        ? waiter.reject(new Error(message.error.message))
        : waiter.resolve(message.result);
    }
  }

  _closed(error) {
    this.process = null;
    for (const waiter of this.pending.values()) waiter.reject(error);
    this.pending.clear();
  }

  async request(method, params = {}) {
    if (method !== "initialize") await this.start();
    const id = this.nextId++;
    const result = new Promise((resolve, reject) =>
      this.pending.set(id, { resolve, reject })
    );
    this.process.stdin.write(
      `${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`
    );
    return result;
  }

  notify(method, params = {}) {
    this.process.stdin.write(
      `${JSON.stringify({ jsonrpc: "2.0", method, params })}\n`
    );
  }

  account() {
    return this.request("account/read", { refreshToken: false });
  }
  login() {
    return this.request("account/login/start", {
      type: "chatgpt",
      appBrand: "codex",
      codexStreamlinedLogin: true,
      useHostedLoginSuccessPage: true,
    });
  }
  logout() {
    return this.request("account/logout", {});
  }
  async models() {
    const models = [];
    let cursor = null;
    do {
      const page = await this.request("model/list", {
        cursor,
        includeHidden: false,
        limit: 100,
      });
      models.push(...page.data);
      cursor = page.nextCursor;
    } while (cursor);
    return models;
  }
}

module.exports = {
  codexAppServer: new CodexAppServerClient(),
  CodexAppServerClient,
};

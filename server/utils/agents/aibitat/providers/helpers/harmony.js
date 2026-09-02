const { v4 } = require("uuid");
const { createHash } = require("crypto");
const { safeJsonParse } = require("../../../../http");

const TOKENS = {
  start: "<|start|>",
  end: "<|end|>",
  message: "<|message|>",
  channel: "<|channel|>",
  constrain: "<|constrain|>",
  call: "<|call|>",
  return: "<|return|>",
};

const HARMONY_TOOL_NAME_PATTERN = /^[A-Za-z_][A-Za-z0-9_]{0,63}$/;
const DEFAULT_MAX_TOKENS = 2048;
const MAX_MAX_TOKENS = 32768;

class HarmonyProtocolError extends Error {
  constructor(message) {
    super(`Invalid gpt-oss Harmony completion: ${message}`);
    this.name = "HarmonyProtocolError";
  }
}

/** Keep decoded dynamic text readable without allowing a special-token opener. */
function sanitizeHarmonyContent(value = "") {
  return String(value).replace(/<\|/g, "<\u200b|");
}

function assertHarmonyToolName(name) {
  if (typeof name !== "string" || !HARMONY_TOOL_NAME_PATTERN.test(name)) {
    throw new HarmonyProtocolError(
      `unsafe Harmony tool alias ${JSON.stringify(name)}; expected a TypeScript identifier of at most 64 characters`
    );
  }
  return name;
}

function toolNameHash(name) {
  return createHash("sha256").update(name).digest("hex");
}

/**
 * Build a stable bijection for the full selected tool set. Names already valid
 * in Harmony remain unchanged. Other AnythingLLM names keep a readable stem and
 * receive a hash suffix, so normalization collisions cannot amputate a tool.
 */
function createToolAliasMap(functions = []) {
  const originalToAlias = new Map();
  const aliasToOriginal = new Map();
  const originals = [...new Set(functions.map((fn) => fn?.name))].sort();

  for (const original of originals) {
    if (typeof original !== "string" || original.length === 0) {
      throw new HarmonyProtocolError(
        `tool name ${JSON.stringify(original)} must be a non-empty string`
      );
    }
    if (!HARMONY_TOOL_NAME_PATTERN.test(original)) continue;
    originalToAlias.set(original, original);
    aliasToOriginal.set(original, original);
  }

  for (const original of originals) {
    if (originalToAlias.has(original)) continue;
    let stem = original
      .replace(/[^A-Za-z0-9_]+/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_+|_+$/g, "");
    if (!stem) stem = "tool";
    if (!/^[A-Za-z_]/.test(stem)) stem = `tool_${stem}`;

    const hash = toolNameHash(original);
    let hashLength = 10;
    let alias;
    do {
      const suffix = `_${hash.slice(0, hashLength)}`;
      alias = `${stem.slice(0, 64 - suffix.length)}${suffix}`;
      hashLength += 2;
    } while (
      aliasToOriginal.has(alias) &&
      aliasToOriginal.get(alias) !== original &&
      hashLength <= hash.length
    );
    if (aliasToOriginal.has(alias) && aliasToOriginal.get(alias) !== original) {
      throw new HarmonyProtocolError(
        `could not create a unique Harmony alias for ${JSON.stringify(original)}`
      );
    }
    assertHarmonyToolName(alias);
    originalToAlias.set(original, alias);
    aliasToOriginal.set(alias, original);
  }
  return { originalToAlias, aliasToOriginal };
}

function getHarmonyMaxTokens() {
  const raw = process.env.GPT_OSS_HARMONY_MAX_TOKENS;
  if (raw === undefined || raw === "") return DEFAULT_MAX_TOKENS;
  if (!/^\d+$/.test(raw))
    throw new TypeError(
      `GPT_OSS_HARMONY_MAX_TOKENS must be an integer from 1 through ${MAX_MAX_TOKENS}`
    );
  const value = Number(raw);
  if (value < 1 || value > MAX_MAX_TOKENS)
    throw new RangeError(
      `GPT_OSS_HARMONY_MAX_TOKENS must be from 1 through ${MAX_MAX_TOKENS}`
    );
  return value;
}

function escapeComment(value = "") {
  return sanitizeHarmonyContent(value)
    .replace(/\r?\n/g, " ")
    .replace(/\*\//g, "* /");
}

/**
 * Render the JSON-schema subset used by AnythingLLM tools as Harmony's
 * TypeScript-like function signature. The official repository has an actively
 * developed JavaScript/WASM binding, but it is not yet published for normal npm
 * consumption. Until it is, unsupported edges (recursive refs, conditionals and
 * unevaluated properties) degrade to `any` without dropping a selected tool.
 */
function schemaToType(schema = {}) {
  if (!schema || typeof schema !== "object") return "any";
  if (Array.isArray(schema.enum))
    return schema.enum
      .map((value) => sanitizeHarmonyContent(JSON.stringify(value)))
      .join(" | ");
  if (Array.isArray(schema.anyOf))
    return schema.anyOf.map(schemaToType).join(" | ");
  if (Array.isArray(schema.oneOf))
    return schema.oneOf.map(schemaToType).join(" | ");
  if (Array.isArray(schema.type))
    return schema.type
      .map((type) => schemaToType({ ...schema, type }))
      .join(" | ");

  switch (schema.type) {
    case "string":
      return "string";
    case "integer":
    case "number":
      return "number";
    case "boolean":
      return "boolean";
    case "null":
      return "null";
    case "array":
      return `${schemaToType(schema.items)}[]`;
    case "object": {
      const required = new Set(schema.required || []);
      const properties = Object.entries(schema.properties || {}).map(
        ([name, property]) => {
          const comment = property.description
            ? `// ${escapeComment(property.description)}\n`
            : "";
          const safeName = sanitizeHarmonyContent(JSON.stringify(name));
          return `${comment}${safeName}${required.has(name) ? "" : "?"}: ${schemaToType(property)},`;
        }
      );
      return `{\n${properties.join("\n")}\n}`;
    }
    default:
      return "any";
  }
}

function renderTools(functions = [], aliasMap = createToolAliasMap(functions)) {
  if (!functions.length) return "";
  const definitions = functions.map((fn) => {
    const name = aliasMap.originalToAlias.get(fn.name);
    const description = fn.description
      ? `// ${escapeComment(fn.description)}\n`
      : "";
    const parameters = fn.parameters || { type: "object", properties: {} };
    const hasParameters = Object.keys(parameters.properties || {}).length > 0;
    const argument = hasParameters ? `_: ${schemaToType(parameters)}` : "";
    return `${description}type ${name} = (${argument}) => any;`;
  });
  return `\n\n# Tools\n\n## functions\n\nnamespace functions {\n\n${definitions.join("\n\n")}\n\n} // namespace functions`;
}

function harmonySystemMessage(hasTools) {
  const date = new Date().toISOString().slice(0, 10);
  return `You are ChatGPT, a large language model trained by OpenAI.\nKnowledge cutoff: 2024-06\nCurrent date: ${date}\n\nReasoning: medium\n\n# Valid channels: analysis, commentary, final. Channel must be included for every message.${hasTools ? "\nCalls to these tools must go to the commentary channel: 'functions'." : ""}`;
}

function wrap(author, content, header = "") {
  return `${TOKENS.start}${author}${header}${TOKENS.message}${sanitizeHarmonyContent(content)}${TOKENS.end}`;
}

/** Canonicalize a preserved assistant action for tool-result continuation. */
function normalizeHarmonyCallForReplay(completion) {
  const assistantStart = `${TOKENS.start}assistant`;
  let body = String(completion).trim();

  // Endpoint responses omit the opener and stop, while stored transcripts may
  // already contain either. Reduce both forms to exactly one of each.
  while (body.startsWith(assistantStart)) {
    body = body.slice(assistantStart.length).trimStart();
  }
  while (body.endsWith(TOKENS.call)) {
    body = body.slice(0, -TOKENS.call.length).trimEnd();
  }
  return `${assistantStart}${body}${TOKENS.call}`;
}

/** Render Aibitat history into the official gpt-oss Harmony wire format. */
function renderHarmonyPrompt(messages = [], functions = []) {
  const aliasMap = createToolAliasMap(functions);
  const parts = [wrap("system", harmonySystemMessage(functions.length > 0))];
  let developerWritten = false;

  for (const message of messages) {
    if (message.role === "system") {
      if (developerWritten) continue;
      parts.push(
        wrap(
          "developer",
          `# Instructions\n\n${message.content || ""}${renderTools(functions, aliasMap)}`
        )
      );
      developerWritten = true;
    } else if (message.role === "user") {
      parts.push(wrap("user", message.content || ""));
    } else if (message.role === "assistant") {
      parts.push(
        wrap("assistant", message.content || "", `${TOKENS.channel}final`)
      );
    } else if (message.role === "function") {
      const call = message.originalFunctionCall || {};
      const originalName = call.name || message.name;
      const name =
        call.harmonyAlias || aliasMap.originalToAlias.get(originalName);
      assertHarmonyToolName(name);
      if (call.harmonyCompletion) {
        parts.push(normalizeHarmonyCallForReplay(call.harmonyCompletion));
      } else {
        const args = sanitizeHarmonyContent(
          typeof call.arguments === "string"
            ? call.arguments
            : JSON.stringify(call.arguments || {})
        );
        parts.push(
          `${TOKENS.start}assistant${TOKENS.channel}commentary to=functions.${name} ${TOKENS.constrain}json${TOKENS.message}${args}${TOKENS.call}`
        );
      }
      parts.push(
        wrap(
          `functions.${name}`,
          typeof message.content === "string"
            ? message.content
            : JSON.stringify(message.content),
          ` to=assistant${TOKENS.channel}commentary`
        )
      );
    }
  }

  if (!developerWritten)
    parts.splice(
      1,
      0,
      wrap("developer", `# Instructions${renderTools(functions, aliasMap)}`)
    );
  return `${parts.join("")}${TOKENS.start}assistant`;
}

function parseHeader(header = "") {
  const channel = header.match(
    /(?:<\|channel\|>|^|\s)(analysis|commentary|final)(?=\s|$|to=)/
  )?.[1];
  const recipient = header.match(/(?:^|\s)to=([^\s]+)/)?.[1];
  return { channel, recipient };
}

/**
 * Parse only structurally marked Harmony messages. Plain JSON or prose that
 * resembles a call is never promoted to a tool invocation.
 */
function parseHarmonyCompletion(completion = "", functions = []) {
  const aliasMap = createToolAliasMap(functions);
  const messages = [];
  let cursor = 0;
  while (cursor < completion.length) {
    const messageAt = completion.indexOf(TOKENS.message, cursor);
    if (messageAt < 0) break;
    const headerStart = completion.lastIndexOf(TOKENS.start, messageAt);
    const implicitHeader = headerStart < cursor;
    const header = completion.slice(
      implicitHeader ? cursor : headerStart + TOKENS.start.length,
      messageAt
    );
    const contentStart = messageAt + TOKENS.message.length;
    const endings = [TOKENS.end, TOKENS.call, TOKENS.return]
      .map((token) => ({
        token,
        index: completion.indexOf(token, contentStart),
      }))
      .filter(({ index }) => index >= 0)
      .sort((a, b) => a.index - b.index);
    const ending = endings[0];
    const contentEnd = ending?.index ?? completion.length;
    messages.push({
      ...parseHeader(header),
      content: completion.slice(contentStart, contentEnd),
    });
    if (!ending) break;
    cursor = contentEnd + ending.token.length;
  }

  const callIndex = messages.findIndex(
    (message) =>
      message.channel === "commentary" &&
      message.recipient?.startsWith("functions.")
  );
  const finalIndex = messages.findIndex(
    (message) => message.channel === "final"
  );
  if (callIndex >= 0 && finalIndex >= 0 && finalIndex < callIndex) {
    throw new HarmonyProtocolError(
      "a tool call appeared after a final-channel message"
    );
  }
  if (callIndex >= 0) {
    const call = messages[callIndex];
    const args = safeJsonParse(call.content, null);
    const harmonyAlias = call.recipient.slice("functions.".length);
    assertHarmonyToolName(harmonyAlias);
    const name = aliasMap.aliasToOriginal.get(harmonyAlias);
    if (!name) {
      throw new HarmonyProtocolError(
        `model called unknown Harmony tool alias ${JSON.stringify(harmonyAlias)}`
      );
    }
    if (args !== null && typeof args === "object" && !Array.isArray(args)) {
      return {
        textResponse: null,
        functionCall: {
          id: `call_${v4()}`,
          name,
          harmonyAlias,
          arguments: args,
          harmonyCompletion: completion.endsWith(TOKENS.call)
            ? completion.slice(0, -TOKENS.call.length)
            : completion,
        },
      };
    }
    throw new HarmonyProtocolError(
      `tool ${JSON.stringify(name)} did not provide a JSON object argument payload`
    );
  }

  const final = messages.filter((message) => message.channel === "final").pop();
  if (final) return { textResponse: final.content, functionCall: null };
  throw new HarmonyProtocolError(
    completion.trim()
      ? "response contained neither a valid final-channel message nor a recipient tool call"
      : "endpoint returned an empty response"
  );
}

async function harmonyComplete(
  client,
  model,
  messages,
  functions,
  getCostFn,
  options = {}
) {
  const { provider } = options;
  provider?.resetUsage?.();
  const response = await client.completions.create({
    model,
    prompt: renderHarmonyPrompt(messages, functions),
    stream: false,
    stop: [TOKENS.call, TOKENS.return],
    max_tokens: getHarmonyMaxTokens(),
  });
  const usage = response.usage || null;
  if (usage) provider?.recordUsage?.(usage);
  return {
    ...parseHarmonyCompletion(response.choices?.[0]?.text || "", functions),
    cost: getCostFn(usage),
    usage,
  };
}

function harmonyEnabledFor(providerTag) {
  if (providerTag !== "lmstudio") return false;
  return (process.env.GPT_OSS_HARMONY_TOOL_CALLING || "")
    .split(",")
    .map((value) => value.trim())
    .includes(providerTag);
}

module.exports = {
  HarmonyProtocolError,
  assertHarmonyToolName,
  createToolAliasMap,
  getHarmonyMaxTokens,
  harmonyComplete,
  harmonyEnabledFor,
  normalizeHarmonyCallForReplay,
  parseHarmonyCompletion,
  renderHarmonyPrompt,
  schemaToType,
  sanitizeHarmonyContent,
};

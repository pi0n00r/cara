/*
AI-NOTICE:Schema-Version=0.1
AI-NOTICE:License=MIT
AI-NOTICE:Author=Gary Bajaj
AI-NOTICE:Scope=file
*/
const { v4: uuidv4 } = require("uuid");
const { NativeEmbedder } = require("../../EmbeddingEngines/native");
const { writeResponseChunk } = require("../../helpers/chat/responses");
const { codexAppServer } = require("./client");
const { codexThreadOptions } = require("./options");

class CodexSubscriptionLLM {
  constructor(embedder = null, modelPreference = null, options = {}) {
    this.className = "CodexSubscriptionLLM";
    this.model =
      modelPreference ||
      process.env.CODEX_SUBSCRIPTION_MODEL_PREF ||
      "gpt-5.6-sol";
    this.reasoningEffort =
      options.reasoningEffort ||
      process.env.CODEX_SUBSCRIPTION_REASONING_EFFORT ||
      "max";
    this.serviceTier = options.serviceTier || null;
    this.execution = {
      executionMode: options.executionMode,
      workspacePath: options.workspacePath,
      skillsPath: options.skillsPath,
    };
    this.embedder = embedder ?? new NativeEmbedder();
    this.defaultTemp = 1;
    this.limits = { history: 30000, system: 30000, user: 140000 };
  }

  static promptWindowLimit() {
    return 200000;
  }
  promptWindowLimit() {
    return 200000;
  }
  streamingEnabled() {
    return true;
  }
  async isValidChatCompletionModel(name) {
    return (await codexAppServer.models()).some(
      (model) => model.model === name || model.id === name
    );
  }
  constructPrompt({
    systemPrompt = "",
    contextTexts = [],
    chatHistory = [],
    userPrompt = "",
    attachments = [],
  }) {
    return [
      {
        role: "system",
        content: [systemPrompt, ...contextTexts].filter(Boolean).join("\n\n"),
      },
      ...chatHistory,
      { role: "user", content: userPrompt, attachments },
    ];
  }
  _prompt(messages) {
    return messages
      .map(({ role, content, originalFunctionCall }) => {
        if (role === "function" && originalFunctionCall)
          return `TOOL RESULT (${originalFunctionCall.name} ${JSON.stringify(originalFunctionCall.arguments)}):\n${content}`;
        if (role === "assistant" && originalFunctionCall)
          return `ASSISTANT TOOL CALL:\n${originalFunctionCall.name} ${JSON.stringify(originalFunctionCall.arguments)}`;
        return `${String(role).toUpperCase()}:\n${typeof content === "string" ? content : JSON.stringify(content)}`;
      })
      .join("\n\n");
  }

  _inputs(messages) {
    const input = [{ type: "text", text: this._prompt(messages) }];
    for (const message of messages) {
      for (const attachment of message.attachments || []) {
        if (!attachment?.contentString?.startsWith("data:image/")) continue;
        input.push({ type: "image", url: attachment.contentString });
      }
    }
    return input;
  }
  async _run(messages, onDelta = null, runOptions = {}) {
    const account = await codexAppServer.account();
    if (account?.account?.type !== "chatgpt")
      throw new Error("Cara is not signed in to a ChatGPT subscription.");
    const model = (await codexAppServer.models()).find(
      (item) => item.model === this.model || item.id === this.model
    );
    if (!model)
      throw new Error(`Codex subscription model is unavailable: ${this.model}`);
    if (
      this.serviceTier &&
      !model.serviceTiers?.some((tier) => tier.id === this.serviceTier)
    )
      throw new Error(
        `${this.serviceTier} is not advertised by the selected Codex model.`
      );
    if (
      !model.supportedReasoningEfforts.some(
        (item) => item.reasoningEffort === this.reasoningEffort
      )
    )
      throw new Error(
        `${this.reasoningEffort} reasoning is unavailable for ${this.model}`
      );

    const started = await codexAppServer.request("thread/start", {
      model: model.model,
      ...(this.serviceTier ? { serviceTier: this.serviceTier } : {}),
      ephemeral: true,
      approvalPolicy: "never",
      ...codexThreadOptions(this.execution),
      dynamicTools: [],
      baseInstructions:
        runOptions.baseInstructions ||
        "Return the requested assistant response. Cara supplies any workspace tools and their results.",
    });
    const threadId = started.thread.id;
    let text = "";
    return new Promise(async (resolve, reject) => {
      const delta = (event) => {
        if (event.threadId !== threadId) return;
        text += event.delta;
        onDelta?.(event.delta);
      };
      const completed = (event) => {
        if (event.threadId !== threadId) return;
        cleanup();
        if (event.turn.status === "failed")
          return reject(
            new Error(event.turn.error?.message || "Codex turn failed")
          );
        resolve(
          text ||
            event.turn.items
              ?.filter((item) => item.type === "agentMessage")
              .map((item) => item.text)
              .join("") ||
            ""
        );
      };
      const serverError = (event) => {
        if (event.threadId !== threadId || event.willRetry) return;
        cleanup();
        reject(new Error(event.error?.message || "Codex turn failed"));
      };
      const cleanup = () => {
        codexAppServer.off("item/agentMessage/delta", delta);
        codexAppServer.off("turn/completed", completed);
        codexAppServer.off("serverError", serverError);
      };
      codexAppServer.on("item/agentMessage/delta", delta);
      codexAppServer.on("turn/completed", completed);
      codexAppServer.on("serverError", serverError);
      try {
        await codexAppServer.request("turn/start", {
          threadId,
          model: model.model,
          effort: this.reasoningEffort,
          ...(this.serviceTier ? { serviceTier: this.serviceTier } : {}),
          input: this._inputs(messages),
          ...(runOptions.outputSchema
            ? { outputSchema: runOptions.outputSchema }
            : {}),
        });
      } catch (error) {
        cleanup();
        reject(error);
      }
    });
  }
  async getChatCompletion(messages) {
    const started = Date.now();
    const textResponse = await this._run(messages);
    return {
      textResponse,
      metrics: {
        prompt_tokens: 0,
        completion_tokens: 0,
        total_tokens: 0,
        outputTps: 0,
        duration: (Date.now() - started) / 1000,
        model: this.model,
        provider: this.className,
        timestamp: new Date(),
      },
    };
  }
  async streamGetChatCompletion(messages) {
    const queue = [];
    let wake;
    let done = false;
    let failure;
    this._run(messages, (text) => {
      queue.push(text);
      wake?.();
    })
      .then(() => {
        done = true;
        wake?.();
      })
      .catch((error) => {
        failure = error;
        done = true;
        wake?.();
      });
    return {
      endMeasurement() {},
      async *[Symbol.asyncIterator]() {
        while (!done || queue.length) {
          if (!queue.length) await new Promise((resolve) => (wake = resolve));
          wake = null;
          while (queue.length) yield queue.shift();
        }
        if (failure) throw failure;
      },
    };
  }
  handleStream(response, stream, { uuid = uuidv4(), sources = [] }) {
    return new Promise(async (resolve) => {
      let fullText = "";
      try {
        for await (const token of stream) {
          fullText += token;
          writeResponseChunk(response, {
            uuid,
            sources: [],
            type: "textResponseChunk",
            textResponse: token,
            close: false,
            error: false,
          });
        }
        writeResponseChunk(response, {
          uuid,
          sources,
          type: "textResponseChunk",
          textResponse: "",
          close: true,
          error: false,
        });
      } catch (error) {
        writeResponseChunk(response, {
          uuid,
          sources: [],
          type: "abort",
          textResponse: null,
          close: true,
          error: error.message,
        });
      }
      resolve(fullText);
    });
  }
  embedTextInput(input) {
    return this.embedder.embedTextInput(input);
  }
  embedChunks(chunks) {
    return this.embedder.embedChunks(chunks);
  }
  async compressMessages(promptArgs = {}, rawHistory = []) {
    const { messageArrayCompressor } = require("../../helpers/chat");
    return messageArrayCompressor(
      this,
      this.constructPrompt(promptArgs),
      rawHistory
    );
  }
}

module.exports = { CodexSubscriptionLLM };

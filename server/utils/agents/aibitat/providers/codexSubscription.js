/*
AI-NOTICE:Schema-Version=0.1
AI-NOTICE:License=MIT
AI-NOTICE:Author=Gary Bajaj
AI-NOTICE:Scope=file
*/
const { v4 } = require("uuid");
const Provider = require("./ai-provider");
const {
  CodexSubscriptionLLM,
} = require("../../../AiProviders/codexSubscription");

class CodexSubscriptionProvider extends Provider {
  constructor(config = {}) {
    super(null);
    this.providerTag = "codex-subscription";
    this.model =
      config.model ||
      process.env.CODEX_SUBSCRIPTION_MODEL_PREF ||
      "gpt-5.6-sol";
    this.reasoningEffort =
      config.reasoningEffort ||
      process.env.CODEX_SUBSCRIPTION_REASONING_EFFORT ||
      "max";
    this.serviceTier = config.serviceTier || null;
    this.llm = new CodexSubscriptionLLM(null, this.model, {
      reasoningEffort: this.reasoningEffort,
      serviceTier: this.serviceTier,
      executionMode: config.executionMode,
      workspacePath: config.workspacePath,
      skillsPath: config.skillsPath,
    });
  }

  supportsNativeToolCalling() {
    return true;
  }

  async complete(messages, functions = []) {
    const tools = functions.map((tool) => ({
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    }));
    const outputSchema = {
      type: "object",
      additionalProperties: false,
      required: ["type", "content", "name", "arguments"],
      properties: {
        type: { type: "string", enum: ["final", "tool_call"] },
        content: { type: "string" },
        name: { type: "string" },
        arguments: { type: "string" },
      },
    };
    const instructions = tools.length
      ? `Cara provides these tools:\n${JSON.stringify(tools)}\nReturn type tool_call to invoke exactly one, or final when done. Preserve tool names exactly and encode arguments as a JSON string.`
      : "Return type final with the assistant response.";
    const raw = await this.llm._run(messages, null, {
      outputSchema,
      baseInstructions: instructions,
    });
    const result = JSON.parse(raw);
    if (result.type === "tool_call") {
      if (!tools.some((tool) => tool.name === result.name))
        throw new Error(`Codex requested unknown Cara tool: ${result.name}`);
      return {
        textResponse: result.content || "",
        functionCall: {
          id: v4(),
          name: result.name,
          arguments: JSON.parse(result.arguments || "{}"),
        },
        cost: 0,
        usage: {},
      };
    }
    return {
      textResponse: result.content,
      functionCall: null,
      cost: 0,
      usage: {},
    };
  }

  stream(messages, functions = [], eventHandler = null) {
    return this.complete(messages, functions).then((result) => {
      if (result.textResponse)
        eventHandler?.("reportStreamEvent", {
          type: "textResponseChunk",
          uuid: v4(),
          content: result.textResponse,
        });
      return result;
    });
  }
}

module.exports = CodexSubscriptionProvider;

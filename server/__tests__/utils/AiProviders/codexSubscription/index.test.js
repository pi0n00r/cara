/*
AI-NOTICE:Schema-Version=0.1
AI-NOTICE:License=MIT
AI-NOTICE:Author=Gary Bajaj
AI-NOTICE:Scope=file
*/
const mockRequest = jest.fn();
const mockModels = jest.fn();
const mockAccount = jest.fn();
const mockListeners = new Map();

jest.mock("../../../../utils/EmbeddingEngines/native", () => ({
  NativeEmbedder: class NativeEmbedder {},
}));
jest.mock("../../../../utils/helpers/chat/responses", () => ({
  writeResponseChunk: jest.fn(),
}));

jest.mock("../../../../utils/AiProviders/codexSubscription/client", () => ({
  codexAppServer: {
    account: (...args) => mockAccount(...args),
    models: (...args) => mockModels(...args),
    request: (...args) => mockRequest(...args),
    on: (name, fn) => mockListeners.set(name, fn),
    off: (name) => mockListeners.delete(name),
  },
}));

const {
  CodexSubscriptionLLM,
} = require("../../../../utils/AiProviders/codexSubscription");

describe("CodexSubscriptionLLM", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockListeners.clear();
    mockAccount.mockResolvedValue({ account: { type: "chatgpt" } });
    mockModels.mockResolvedValue([
      {
        id: "gpt-5.6-sol",
        model: "gpt-5.6-sol",
        supportedReasoningEfforts: [{ reasoningEffort: "max" }],
        serviceTiers: [{ id: "fast", name: "Fast" }],
      },
    ]);
    mockRequest.mockImplementation(async (method) => {
      if (method === "thread/start") return { thread: { id: "thread-1" } };
      if (method === "turn/start") {
        queueMicrotask(() => {
          mockListeners.get("item/agentMessage/delta")?.({
            threadId: "thread-1",
            delta: "Sol",
          });
          mockListeners.get("turn/completed")?.({
            threadId: "thread-1",
            turn: { status: "completed", items: [] },
          });
        });
        return { turn: { id: "turn-1" } };
      }
    });
  });

  it("uses the selected Sol Max profile", async () => {
    const provider = new CodexSubscriptionLLM({}, "gpt-5.6-sol", {
      reasoningEffort: "max",
    });
    const result = await provider.getChatCompletion([
      { role: "user", content: "hello" },
    ]);
    expect(result.textResponse).toBe("Sol");
    expect(mockRequest).toHaveBeenCalledWith(
      "turn/start",
      expect.objectContaining({ model: "gpt-5.6-sol", effort: "max" })
    );
  });

  it("rejects a profile the selected model does not advertise", async () => {
    const provider = new CodexSubscriptionLLM({}, "gpt-5.6-sol", {
      reasoningEffort: "ultra",
    });
    await expect(provider.getChatCompletion([])).rejects.toThrow(
      "ultra reasoning is unavailable"
    );
  });

  it("omits inherited speed and keeps arbitrary advertised speed on both starts", async () => {
    await new CodexSubscriptionLLM({}, "gpt-5.6-sol", {
      reasoningEffort: "max",
    }).getChatCompletion([]);
    expect(
      mockRequest.mock.calls.find(([method]) => method === "thread/start")[1]
    ).not.toHaveProperty("serviceTier");
    mockRequest.mockClear();
    await new CodexSubscriptionLLM({}, "gpt-5.6-sol", {
      reasoningEffort: "max",
      serviceTier: "fast",
    }).getChatCompletion([]);
    expect(mockRequest).toHaveBeenCalledWith(
      "thread/start",
      expect.objectContaining({ serviceTier: "fast" })
    );
    expect(mockRequest).toHaveBeenCalledWith(
      "turn/start",
      expect.objectContaining({ serviceTier: "fast" })
    );
  });

  it("rejects an unadvertised service tier", async () => {
    const provider = new CodexSubscriptionLLM({}, "gpt-5.6-sol", {
      reasoningEffort: "max",
      serviceTier: "priority",
    });
    await expect(provider.getChatCompletion([])).rejects.toThrow(
      "not advertised"
    );
  });
});

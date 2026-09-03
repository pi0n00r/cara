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
      },
    ]);
    mockRequest.mockImplementation(async (method) => {
      if (method === "thread/start") return { thread: { id: "thread-1" } };
      if (method === "turn/start") {
        queueMicrotask(() => {
          mockListeners.get("item/agentMessage/delta")?.({ threadId: "thread-1", delta: "Sol" });
          mockListeners.get("turn/completed")?.({ threadId: "thread-1", turn: { status: "completed", items: [] } });
        });
        return { turn: { id: "turn-1" } };
      }
    });
  });

  it("uses the selected Sol Max profile", async () => {
    const provider = new CodexSubscriptionLLM({}, "gpt-5.6-sol", {
      reasoningEffort: "max",
    });
    const result = await provider.getChatCompletion([{ role: "user", content: "hello" }]);
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
});

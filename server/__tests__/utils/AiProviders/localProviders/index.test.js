/*
AI-NOTICE:Schema-Version=0.1
AI-NOTICE:License=MIT
AI-NOTICE:Author=Gary Bajaj
AI-NOTICE:Exploitation-Deterrence=true
AI-NOTICE:Operator-Override-Required=true
AI-NOTICE:Override-Reason-Required=false
AI-NOTICE:Severity=high
AI-NOTICE:Escalation=warn
AI-NOTICE:Scope=file
AI-NOTICE:Contact=https://AImends.bajaj.com/
*/

const mockCreate = jest.fn();
const mockList = jest.fn();
const mockOpenAI = jest.fn(() => ({
  chat: { completions: { create: mockCreate } },
  models: { list: mockList },
}));

jest.mock("openai", () => ({ OpenAI: mockOpenAI }));
jest.mock("../../../../utils/helpers/chat/LLMPerformanceMonitor", () => ({
  LLMPerformanceMonitor: {
    measureAsyncFunction: async (request) => ({
      output: await request,
      duration: 1,
    }),
    countTokens: jest.fn(() => 3),
  },
}));

const {
  LocalAiLLM,
  parseLocalAiBasePath,
  getLocalAiServicePath,
} = require("../../../../utils/AiProviders/localAi");
const {
  parseLMStudioBasePath,
} = require("../../../../utils/AiProviders/lmStudio");
const {
  getCustomModels,
} = require("../../../../utils/helpers/customModels");

const ORIGINAL_ENV = process.env;

beforeEach(() => {
  jest.clearAllMocks();
  process.env = {
    ...ORIGINAL_ENV,
    LOCAL_AI_BASE_PATH: "https://inference.example.test/localai",
    LOCAL_AI_API_KEY: "stored-localai-token",
    LOCAL_AI_MODEL_PREF: "reasoning-model",
    LMSTUDIO_BASE_PATH: "https://inference.example.test/lmstudio/v1",
    LMSTUDIO_AUTH_TOKEN: "stored-lmstudio-token",
  };
  LocalAiLLM.cacheContextWindows = jest.fn().mockResolvedValue();
});

afterEach(() => {
  process.env = ORIGINAL_ENV;
});

describe("local provider endpoint normalization", () => {
  it.each([
    ["http://localhost:8080", "http://localhost:8080/v1"],
    ["http://localhost:8080/v1/", "http://localhost:8080/v1"],
    [
      "https://proxy.example.test/services/localai",
      "https://proxy.example.test/services/localai/v1",
    ],
  ])("normalizes LocalAI %s", (input, expected) => {
    expect(parseLocalAiBasePath(input)).toBe(expected);
  });

  it("keeps the LocalAI proxy prefix for native discovery", () => {
    expect(
      getLocalAiServicePath("https://proxy.example.test/services/localai/v1")
    ).toBe("https://proxy.example.test/services/localai");
  });

  it.each([
    [
      "https://proxy.example.test/services/lmstudio/v1",
      "legacy",
      "https://proxy.example.test/services/lmstudio/v1",
    ],
    [
      "https://proxy.example.test/services/lmstudio/v1/",
      "v1",
      "https://proxy.example.test/services/lmstudio/api/v1",
    ],
    [
      "http://localhost:1234",
      "legacy",
      "http://localhost:1234/v1",
    ],
  ])("normalizes LM Studio %s for %s", (input, apiVersion, expected) => {
    expect(parseLMStudioBasePath(input, apiVersion)).toBe(expected);
  });
});

describe("local provider credentials", () => {
  it("uses the stored LocalAI token when the UI sends a mask", async () => {
    mockList.mockResolvedValueOnce({ data: [{ id: "local-model" }] });
    await getCustomModels(
      "localai",
      "********************",
      "https://inference.example.test/localai"
    );
    expect(mockOpenAI).toHaveBeenLastCalledWith({
      baseURL: "https://inference.example.test/localai/v1",
      apiKey: "stored-localai-token",
    });
  });

  it("uses the stored LM Studio token when the UI sends a mask", async () => {
    mockList.mockResolvedValueOnce({ data: [{ id: "lm-model" }] });
    await getCustomModels(
      "lmstudio",
      "********************",
      "https://inference.example.test/lmstudio/v1"
    );
    expect(mockOpenAI).toHaveBeenLastCalledWith({
      baseURL: "https://inference.example.test/lmstudio/v1",
      apiKey: "stored-lmstudio-token",
    });
  });

  it("returns an actionable discovery error", async () => {
    mockList.mockRejectedValueOnce(new Error("offline"));
    await expect(
      getCustomModels("localai", null, "http://localhost:8080")
    ).resolves.toEqual({
      models: [],
      error: "Could not fetch LocalAI models",
    });
  });
});

describe("LocalAI response compatibility", () => {
  it("preserves reasoning content in non-streaming responses", async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [
        { message: { reasoning_content: "work", content: "answer" } },
      ],
    });
    const provider = new LocalAiLLM({});
    await expect(
      provider.getChatCompletion([], { temperature: 0.7 })
    ).resolves.toMatchObject({
      textResponse: "<think>work</think>answer",
    });
  });
});

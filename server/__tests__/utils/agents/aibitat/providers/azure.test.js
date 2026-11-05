/* eslint-env jest */

const mockTooledComplete = jest.fn();
const mockResponsesTooledComplete = jest.fn();

jest.mock("openai", () => ({ OpenAI: jest.fn(() => ({})) }));
jest.mock(
  "../../../../../utils/agents/aibitat/providers/helpers/tooled.js",
  () => ({
    tooledStream: jest.fn(),
    tooledComplete: mockTooledComplete,
  })
);
jest.mock(
  "../../../../../utils/agents/aibitat/providers/helpers/responsesTooled.js",
  () => ({
    responsesTooledStream: jest.fn(),
    responsesTooledComplete: mockResponsesTooledComplete,
  })
);
jest.mock("../../../../../utils/AiProviders/azureOpenAi", () => ({
  AzureOpenAiLLM: { formatBaseUrl: jest.fn(() => "https://example.invalid") },
}));

const AzureOpenAiProvider = require("../../../../../utils/agents/aibitat/providers/azure");

describe("Azure agent API fallback", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.AZURE_OPENAI_AGENT_API;
  });

  it("remembers a Responses API fallback only for the deployment that needs it", async () => {
    const sessionState = {};
    const fallbackError = Object.assign(new Error("Use /v1/responses"), {
      status: 400,
    });
    mockTooledComplete.mockRejectedValueOnce(fallbackError);
    mockResponsesTooledComplete.mockResolvedValue({ textResponse: "first" });

    const first = new AzureOpenAiProvider({
      model: "responses-only-deployment",
      sessionState,
    });
    await expect(first.complete([])).resolves.toEqual({
      textResponse: "first",
    });
    expect(sessionState.azureUseResponsesAPIByModel).toEqual({
      "responses-only-deployment": true,
    });

    jest.clearAllMocks();
    mockTooledComplete.mockResolvedValue({ textResponse: "second" });
    const second = new AzureOpenAiProvider({
      model: "chat-deployment",
      sessionState,
    });
    await expect(second.complete([])).resolves.toEqual({
      textResponse: "second",
    });
    expect(mockTooledComplete).toHaveBeenCalledTimes(1);
    expect(mockResponsesTooledComplete).not.toHaveBeenCalled();
  });
});

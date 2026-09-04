/*
AI-NOTICE:Schema-Version=0.1
AI-NOTICE:License=MIT
AI-NOTICE:Author=Gary Bajaj
AI-NOTICE:Scope=file
*/
const mockModels = jest.fn();

jest.mock("../../../utils/AiProviders/openRouter", () => ({
  fetchOpenRouterModels: jest.fn(),
}));
jest.mock("../../../utils/EmbeddingEngines/openRouter", () => ({
  fetchOpenRouterEmbeddingModels: jest.fn(),
}));
jest.mock("../../../utils/AiProviders/apipie", () => ({
  fetchApiPieModels: jest.fn(),
}));
jest.mock("../../../utils/AiProviders/perplexity", () => ({
  perplexityModels: jest.fn(),
}));
jest.mock("../../../utils/AiProviders/fireworksAi", () => ({
  fireworksAiModels: jest.fn(),
}));
jest.mock("../../../utils/TextToSpeech/elevenLabs", () => ({
  ElevenLabsTTS: class {},
}));
jest.mock("../../../utils/AiProviders/novita", () => ({
  fetchNovitaModels: jest.fn(),
}));
jest.mock("../../../utils/AiProviders/lmStudio", () => ({
  parseLMStudioBasePath: jest.fn(),
}));
jest.mock("../../../utils/AiProviders/nvidiaNim", () => ({
  parseNvidiaNimBasePath: jest.fn(),
}));
jest.mock("../../../utils/AiProviders/ppio", () => ({
  fetchPPIOModels: jest.fn(),
}));
jest.mock("../../../utils/AiProviders/gemini", () => ({ GeminiLLM: class {} }));
jest.mock("../../../utils/AiProviders/cometapi", () => ({
  fetchCometApiModels: jest.fn(),
}));
jest.mock("../../../utils/AiProviders/lemonade", () => ({
  getAllLemonadeModels: jest.fn(),
}));
jest.mock("../../../utils/AiProviders/localAi", () => ({
  parseLocalAiBasePath: jest.fn(),
}));

jest.mock("../../../utils/AiProviders/codexSubscription/client", () => ({
  codexAppServer: { models: (...args) => mockModels(...args) },
}));

const { getCustomModels } = require("../../../utils/helpers/customModels");

describe("Codex model metadata mapping", () => {
  it("preserves service tiers and the catalog default", async () => {
    mockModels.mockResolvedValue([
      {
        model: "model-a",
        displayName: "Model A",
        supportedReasoningEfforts: [],
        serviceTiers: [{ id: "burst", name: "Burst", description: "Quick" }],
        defaultServiceTier: "burst",
      },
    ]);
    const result = await getCustomModels("codex-subscription");
    expect(result.models[0]).toEqual(
      expect.objectContaining({
        serviceTiers: [{ id: "burst", name: "Burst", description: "Quick" }],
        defaultServiceTier: "burst",
      })
    );
  });
});

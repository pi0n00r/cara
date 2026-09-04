/*
AI-NOTICE:Schema-Version=0.1
AI-NOTICE:License=MIT
AI-NOTICE:Author=Gary Bajaj
AI-NOTICE:Scope=file
*/
process.env.STORAGE_DIR = __dirname;
process.env.NODE_ENV = "test";

jest.mock("../../../utils/MCP", () => {
  return jest.fn().mockImplementation(() => ({
    activeMCPServers: jest.fn().mockResolvedValue([]),
    convertServerToolsToPlugins: jest.fn().mockResolvedValue([]),
  }));
});

const { EphemeralAgentHandler } = require("../../../utils/agents/ephemeral");

describe("EphemeralAgentHandler provider setup", () => {
  test("initializes a Codex subscription workspace through the normal agent path", async () => {
    const handler = new EphemeralAgentHandler({
      uuid: "codex-agent-regression",
      workspace: {
        id: 1,
        agentProvider: "codex-subscription",
        agentModel: "gpt-5.6-sol",
        chatReasoningEffort: "max",
      },
      prompt: "Use the workspace tools",
    });

    await expect(handler.init()).resolves.toBe(handler);
    expect(handler.provider).toBe("codex-subscription");
    expect(handler.model).toBe("gpt-5.6-sol");
  });

  test("uses the Codex subscription default when no agent model override exists", async () => {
    const previousModel = process.env.CODEX_SUBSCRIPTION_MODEL_PREF;
    process.env.CODEX_SUBSCRIPTION_MODEL_PREF = "gpt-5.6-sol";

    try {
      const handler = new EphemeralAgentHandler({
        uuid: "codex-agent-default-model",
        workspace: { id: 1, agentProvider: "codex-subscription" },
        prompt: "Use the workspace tools",
      });

      await expect(handler.init()).resolves.toBe(handler);
      expect(handler.model).toBe("gpt-5.6-sol");
    } finally {
      if (previousModel === undefined)
        delete process.env.CODEX_SUBSCRIPTION_MODEL_PREF;
      else process.env.CODEX_SUBSCRIPTION_MODEL_PREF = previousModel;
    }
  });

  test("propagates workspace execution and speed through the unbound agent config", async () => {
    const handler = new EphemeralAgentHandler({
      uuid: "codex-agent-options",
      workspace: {
        id: 1,
        agentProvider: "codex-subscription",
        agentModel: "gpt-5.6-sol",
        chatServiceTier: "fast",
        codexExecutionMode: "workspace-write",
        codexWorkspacePath: process.cwd(),
        codexSkillsPath: process.cwd(),
      },
      prompt: "Use the workspace tools",
    });
    await handler.init();
    await handler.createAIbitat();
    expect(handler.aibitat.defaultProvider).toEqual(
      expect.objectContaining({
        serviceTier: "fast",
        executionMode: "workspace-write",
        workspacePath: process.cwd(),
        skillsPath: process.cwd(),
      })
    );
  });

  test("continues to reject unknown workspace agent providers", async () => {
    const handler = new EphemeralAgentHandler({
      uuid: "unknown-agent-provider",
      workspace: {
        id: 1,
        agentProvider: "not-a-provider",
        agentModel: "unknown-model",
      },
      prompt: "Use the workspace tools",
    });

    await expect(handler.init()).rejects.toThrow(
      "No workspace agent provider set"
    );
  });
});

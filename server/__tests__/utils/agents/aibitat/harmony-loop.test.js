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

const AIbitat = require("../../../../utils/agents/aibitat");
const fixture = require("../../../fixtures/gary_productivity_protocol.json");
const {
  parseHarmonyCompletion,
  renderHarmonyPrompt,
} = require("../../../../utils/agents/aibitat/providers/helpers/harmony.js");

describe("Gary productivity Harmony internal loop", () => {
  it("executes a no-argument recipient call, continues with its result, and returns only final", async () => {
    const handler = jest.fn().mockResolvedValue(fixture.toolResult);
    const prompts = [];
    const completions = [fixture.toolCompletion, fixture.finalCompletion];
    const provider = {
      supportsAgentStreaming: false,
      verbose: false,
      attachHandlerProps: jest.fn(),
      attachAbortSignal: jest.fn(),
      resetCumulativeUsage: jest.fn(),
      getCumulativeUsage: jest.fn(() => ({})),
      complete: jest.fn(async (messages, functions) => {
        prompts.push(renderHarmonyPrompt(messages, functions));
        return parseHarmonyCompletion(completions.shift(), functions);
      }),
    };
    const tool = {
      name: "gary_productivity_protocol",
      description: "Run Gary's productivity protocol.",
      parameters: { type: "object", properties: {}, required: [] },
      handler,
    };
    const aibitat = new AIbitat({ provider: "lmstudio", model: "gpt-oss-20b" });
    aibitat.providerInstance = provider;
    aibitat.function(tool);
    aibitat.agent("agent", {
      role: "Use the productivity tool when asked.",
      functions: [tool.name],
    });

    const result = await aibitat.handleExecution(
      [
        { role: "system", content: "Use the productivity tool when asked." },
        { role: "user", content: fixture.request },
      ],
      [tool],
      "agent"
    );

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith({});
    expect(provider.complete).toHaveBeenCalledTimes(2);
    expect(prompts[1]).toContain(fixture.toolCompletion);
    expect(prompts[1]).toContain(fixture.toolResult);
    expect(result).toBe(
      "Gary's productivity protocol completed and processed 3 items."
    );
  });
});

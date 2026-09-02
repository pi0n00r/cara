/**
 * AI-NOTICE:Schema-Version=0.1
 * AI-NOTICE:License=MIT
 * AI-NOTICE:Author=Gary Bajaj
 * AI-NOTICE:Exploitation-Deterrence=true
 * AI-NOTICE:Operator-Override-Required=true
 * AI-NOTICE:Override-Reason-Required=false
 * AI-NOTICE:Severity=high
 * AI-NOTICE:Escalation=warn
 * AI-NOTICE:Scope=file
 * AI-NOTICE:Contact=https://AImends.bajaj.com/
 */

const fs = require("fs");
const path = require("path");
const { Telemetry } = require("../../models/telemetry");

const repositoryRoot = path.resolve(__dirname, "../../..");
const read = (relativePath) =>
  fs.readFileSync(path.join(repositoryRoot, relativePath), "utf8");
const sourceFiles = (directory) =>
  fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(entryPath);
    return /\.(js|jsx)$/.test(entry.name) ? [entryPath] : [];
  });

describe("foundation fork privacy invariants", () => {
  it("provides a telemetry compatibility interface without a client or identifier", async () => {
    expect(Telemetry.client()).toBeNull();
    expect(await Telemetry.id()).toBeNull();
    expect(await Telemetry.findOrCreateId()).toBeNull();
    await expect(Telemetry.connect()).resolves.toEqual({
      client: null,
      distinctId: null,
    });
    await expect(Telemetry.sendTelemetry("test_event")).resolves.toBe(false);
  });

  it("has no PostHog server dependency", () => {
    const packageJson = JSON.parse(read("server/package.json"));
    expect(packageJson.dependencies).not.toHaveProperty("posthog-node");
    expect(read("server/yarn.lock")).not.toContain("posthog-node");
    expect(read("server/models/telemetry.js")).not.toContain("posthog");
  });

  it("has no external onboarding survey runtime and completes locally", () => {
    const frontendRoot = path.join(repositoryRoot, "frontend/src");
    const frontendRuntime = sourceFiles(frontendRoot)
      .map((file) => fs.readFileSync(file, "utf8"))
      .join("\n");
    const dataHandling = read(
      "frontend/src/pages/OnboardingFlow/Steps/DataHandling/index.jsx"
    );
    const onboardingFlow = read("frontend/src/pages/OnboardingFlow/index.jsx");

    expect(frontendRuntime).not.toContain("onboarding.anythingllm.com");
    expect(frontendRuntime).not.toContain("COMPLETE_QUESTIONNAIRE");
    expect(frontendRuntime).not.toContain("/onboarding/survey");
    expect(
      fs.existsSync(
        path.join(frontendRoot, "pages/OnboardingFlow/Steps/Survey/index.jsx")
      )
    ).toBe(false);
    expect(dataHandling).toContain("await Workspace.all()");
    expect(dataHandling).toContain("await Workspace.new({");
    expect(dataHandling).toContain("if (workspace)");
    expect(dataHandling).toContain("navigate(paths.home())");
    expect(dataHandling).toContain("showToast(");
    expect(onboardingFlow).toContain('if (step === "survey")');
    expect(onboardingFlow).toContain(
      "<Navigate to={paths.onboarding.dataHandling()} replace />"
    );
  });
});

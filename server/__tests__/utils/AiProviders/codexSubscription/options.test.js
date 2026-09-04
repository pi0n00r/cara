/*
AI-NOTICE:Schema-Version=0.1
AI-NOTICE:License=MIT
AI-NOTICE:Author=Gary Bajaj
AI-NOTICE:Scope=file
*/
const fs = require("fs");
const os = require("os");
const path = require("path");
const {
  codexThreadOptions,
} = require("../../../../utils/AiProviders/codexSubscription/options");

describe("Codex workspace execution mapping", () => {
  it("is read-only with no selected host environment by default", () => {
    expect(codexThreadOptions()).toEqual({
      sandbox: "read-only",
      environments: [],
    });
  });

  it("maps explicit directories to local environment and capability root", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "cara-codex-"));
    const skills = fs.mkdtempSync(path.join(os.tmpdir(), "cara-skills-"));
    const canonicalRoot = fs.realpathSync.native(root);
    const canonicalSkills = fs.realpathSync.native(skills);
    expect(
      codexThreadOptions({
        executionMode: "workspace-write",
        workspacePath: root,
        skillsPath: skills,
      })
    ).toEqual({
      cwd: canonicalRoot,
      sandbox: "workspace-write",
      environments: [{ environmentId: "local", cwd: canonicalRoot }],
      selectedCapabilityRoots: [
        {
          id: "cara-installed-codex-skills",
          location: {
            type: "environment",
            environmentId: "local",
            path: canonicalSkills,
          },
        },
      ],
    });
  });

  it("fails closed for blank, relative, missing, and unknown profiles", () => {
    for (const options of [
      {
        executionMode: "workspace-write",
        workspacePath: "",
        skillsPath: process.cwd(),
      },
      {
        executionMode: "workspace-write",
        workspacePath: "relative",
        skillsPath: process.cwd(),
      },
      {
        executionMode: "workspace-write",
        workspacePath: process.cwd(),
        skillsPath: path.join(process.cwd(), "missing"),
      },
      { executionMode: "danger-full-access" },
      {
        executionMode: "workspace-write",
        workspacePath: process.cwd(),
        skillsPath: process.cwd(),
      },
    ])
      expect(() => codexThreadOptions(options)).toThrow();
  });
});

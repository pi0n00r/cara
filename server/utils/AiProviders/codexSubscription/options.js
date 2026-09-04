/*
AI-NOTICE:Schema-Version=0.1
AI-NOTICE:License=MIT
AI-NOTICE:Author=Gary Bajaj
AI-NOTICE:Scope=file
*/
const fs = require("fs");
const path = require("path");

const LOCAL_ENVIRONMENT_ID = "local";

function directory(value, label, access) {
  if (typeof value !== "string" || !value || !path.isAbsolute(value))
    throw new Error(
      `Codex ${label} path must be an absolute existing directory.`
    );
  let stat;
  try {
    stat = fs.statSync(value);
  } catch {
    throw new Error(
      `Codex ${label} path must be an absolute existing directory.`
    );
  }
  if (!stat.isDirectory())
    throw new Error(
      `Codex ${label} path must be an absolute existing directory.`
    );
  try {
    fs.accessSync(value, access);
  } catch {
    throw new Error(`Codex ${label} directory has insufficient access.`);
  }
  return fs.realpathSync.native(value);
}

function codexThreadOptions(options = {}) {
  const mode = options.executionMode || "read-only";
  const result = { sandbox: "read-only", environments: [] };
  if (mode === "read-only") return result;
  if (mode !== "workspace-write")
    throw new Error("Invalid Codex execution mode.");

  const cwd = directory(
    options.workspacePath,
    "workspace",
    fs.constants.R_OK | fs.constants.W_OK
  );
  const skills = directory(options.skillsPath, "skills", fs.constants.R_OK);
  const relativeSkills = path.relative(cwd, skills);
  if (
    !relativeSkills ||
    (!relativeSkills.startsWith("..") && !path.isAbsolute(relativeSkills))
  )
    throw new Error(
      "Codex skills directory must be outside the writable workspace."
    );
  return {
    cwd,
    sandbox: "workspace-write",
    environments: [{ environmentId: LOCAL_ENVIRONMENT_ID, cwd }],
    selectedCapabilityRoots: [
      {
        id: "cara-installed-codex-skills",
        location: {
          type: "environment",
          environmentId: LOCAL_ENVIRONMENT_ID,
          path: skills,
        },
      },
    ],
  };
}

module.exports = { codexThreadOptions, LOCAL_ENVIRONMENT_ID };

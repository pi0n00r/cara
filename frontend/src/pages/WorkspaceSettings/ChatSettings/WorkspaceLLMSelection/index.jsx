import React, { useEffect, useState } from "react";
import System from "@/models/system";
import AnythingLLMIcon from "@/media/logo/anything-llm-icon.png";
import WorkspaceLLMItem from "./WorkspaceLLMItem";
import { ALL_LLM_PROVIDERS } from "@/pages/GeneralSettings/LLMPreference";
import ChatModelSelection from "./ChatModelSelection";
import RouterSelection from "./RouterSelection";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import paths from "@/utils/paths";
import ProviderSearchMenu from "@/components/lib/ProviderSearchMenu";
import { useAutosaveForm, SavedIndicator } from "@/components/AutosaveForm";

// Some providers do not support model selection via /models.
// In that case we allow the user to enter the model name manually and hope they
// type it correctly.
const FREE_FORM_LLM_SELECTION = ["azure"];

// Some providers do not support model selection via /models
// and only have a fixed single-model they can use.
const NO_MODEL_SELECTION = ["default", "anythingllm-router"];

// Some providers we just fully disable for ease of use.
const DISABLED_PROVIDERS = [];

const LLM_DEFAULT = {
  name: "System default",
  value: "default",
  logo: AnythingLLMIcon,
  options: () => <React.Fragment />,
  description: "Use the system LLM preference for this workspace.",
  requiredConfig: [],
};

const LLMS = [LLM_DEFAULT, ...ALL_LLM_PROVIDERS].filter(
  (llm) => !DISABLED_PROVIDERS.includes(llm.value)
);

export default function WorkspaceLLMSelection({ settings, workspace }) {
  const [selectedLLM, setSelectedLLM] = useState(
    workspace?.chatProvider ?? "default"
  );
  const { markDirty, save } = useAutosaveForm();
  const [codexModels, setCodexModels] = useState([]);
  const [selectedChatModel, setSelectedChatModel] = useState(workspace?.chatModel || "");
  useEffect(() => {
    if (selectedLLM !== "codex-subscription") return;
    System.customModels("codex-subscription").then(({ models = [] }) => {
      setCodexModels(models);
      setSelectedChatModel((current) => models.some((model) => model.id === current) ? current : models[0]?.id || "");
    });
  }, [selectedLLM]);
  useEffect(() => {
    if (selectedLLM === "codex-subscription" && codexModels.length > 0) save();
  }, [selectedLLM, codexModels]);
  const { t } = useTranslation();
  function updateLLMChoice(selection) {
    setSelectedLLM(selection);
    markDirty("chatProvider");
    markDirty("chatModel");
    // Every other provider saves once its model/router picker is ready, see ModelSelector.
    if (selection === "default") save();
  }

  const selectedLLMObject = LLMS.find((llm) => llm.value === selectedLLM);

  return (
    <div className="flex flex-col gap-y-[8px]">
      <div className="flex flex-col gap-y-[8px]">
        <label htmlFor="name" className="block input-label">
          {t("chat.llm.title")}
          <SavedIndicator name="chatProvider" />
        </label>
        <p className="text-white text-opacity-60 text-xs font-medium">
          {t("chat.llm.description")}
        </p>
      </div>

      <div className="relative">
        <input type="hidden" name="chatProvider" value={selectedLLM} />
        <ProviderSearchMenu
          items={LLMS}
          selected={selectedLLMObject}
          placeholder={t("chat.llm.search")}
          renderItem={(llm, close) => (
            <WorkspaceLLMItem
              llm={llm}
              availableLLMs={LLMS}
              settings={settings}
              checked={selectedLLM === llm.value}
              onClick={() => {
                updateLLMChoice(llm.value);
                close();
              }}
            />
          )}
        />
      </div>
      {selectedLLM === "codex-subscription" ? (
        <>
          <label className="block input-label">Chat model</label>
          <select name="chatModel" value={selectedChatModel} onChange={(event) => { setSelectedChatModel(event.target.value); markDirty("chatModel"); }} className="border-none bg-theme-settings-input-bg text-white text-sm rounded-lg block w-full p-2.5">
            {codexModels.map((model) => <option key={model.id} value={model.id}>{model.name || model.id}</option>)}
          </select>
          <label className="block input-label">Reasoning profile</label>
          <select name="chatReasoningEffort" defaultValue={workspace?.chatReasoningEffort || settings?.CodexSubscriptionReasoningEffort || "max"} onChange={() => markDirty("chatReasoningEffort")} className="border-none bg-theme-settings-input-bg text-white text-sm rounded-lg block w-full p-2.5">
            {["low", "medium", "high", "xhigh", "max", "ultra"].map((effort) => <option key={effort} value={effort}>{effort}</option>)}
          </select>
          <CodexSpeedSelector models={codexModels} modelId={selectedChatModel} workspace={workspace} markDirty={markDirty} />
          <label className="block input-label">Execution profile</label>
          <select name="codexExecutionMode" defaultValue={workspace?.codexExecutionMode || "read-only"} onChange={() => markDirty("codexExecutionMode")} className="border-none bg-theme-settings-input-bg text-white text-sm rounded-lg block w-full p-2.5">
            <option value="read-only">Read-only</option><option value="workspace-write">Explicit workspace write</option>
          </select>
          <input name="codexWorkspacePath" defaultValue={workspace?.codexWorkspacePath || ""} onChange={() => markDirty("codexWorkspacePath")} placeholder="Absolute workspace/output directory" className="border-none bg-theme-settings-input-bg text-white text-sm rounded-lg block w-full p-2.5" />
          <input name="codexSkillsPath" defaultValue={workspace?.codexSkillsPath || ""} onChange={() => markDirty("codexSkillsPath")} placeholder="Absolute installed Codex skills directory" className="border-none bg-theme-settings-input-bg text-white text-sm rounded-lg block w-full p-2.5" />
        </>
      ) : (
        <ModelSelector
          selectedLLM={selectedLLM}
          workspace={workspace}
          markDirty={markDirty}
        />
      )}
    </div>
  );
}

// TODO: Add this to agent selector as well as make generic component.
function ModelSelector({ selectedLLM, workspace, markDirty }) {
  if (selectedLLM === "anythingllm-router") {
    return <RouterSelection workspace={workspace} />;
  }

  if (NO_MODEL_SELECTION.includes(selectedLLM)) {
    if (selectedLLM !== "default") {
      return (
        <div className="w-full h-10 justify-center items-center flex">
          <p className="text-sm font-base text-white text-opacity-60 text-center">
            Multi-model support is not supported for this provider yet.
            <br />
            This workspace will use{" "}
            <Link to={paths.settings.llmPreference()} className="underline">
              the model set for the system.
            </Link>
          </p>
        </div>
      );
    }
    return null;
  }

  if (FREE_FORM_LLM_SELECTION.includes(selectedLLM)) {
    return <FreeFormLLMInput workspace={workspace} />;
  }

  return (
    <ChatModelSelection
      provider={selectedLLM}
      workspace={workspace}
      markDirty={markDirty}
    />
  );
}

function FreeFormLLMInput({ workspace }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-y-[8px]">
      <label className="block input-label">
        {t("chat.model.title")}
        <SavedIndicator name="chatModel" />
      </label>
      <p className="text-white text-opacity-60 text-xs font-medium">
        {t("chat.model.description")}
      </p>
      <input
        type="text"
        name="chatModel"
        defaultValue={workspace?.chatModel || ""}
        className="border-none bg-theme-settings-input-bg text-white placeholder:text-theme-settings-input-placeholder text-sm rounded-lg focus:outline-primary-button active:outline-primary-button outline-none block w-full p-2.5"
        placeholder="Enter model name exactly as referenced in the API (e.g., gpt-4.1-nano)"
      />
    </div>
  );
}

export function CodexSpeedSelector({ models, modelId, workspace, markDirty }) {
  const model = models.find((item) => item.id === modelId);
  const tiers = model?.serviceTiers || [];
  const [selectedTier, setSelectedTier] = useState(workspace?.chatServiceTier || "");
  useEffect(() => {
    if (!tiers.some((tier) => tier.id === selectedTier)) setSelectedTier("");
  }, [modelId, tiers, selectedTier]);
  return (
    <div className="flex flex-col gap-y-[8px]">
      <label className="block input-label">Speed</label>
      <select name="chatServiceTier" value={selectedTier} onChange={(event) => { setSelectedTier(event.target.value); markDirty("chatServiceTier"); }} className="border-none bg-theme-settings-input-bg text-white text-sm rounded-lg block w-full p-2.5">
        <option value="">Default / Standard{model?.defaultServiceTier ? ` (${model.defaultServiceTier})` : ""}</option>
        {tiers.map((tier) => <option key={tier.id} value={tier.id}>{tier.name || tier.id}</option>)}
      </select>
    </div>
  );
}

/*
AI-NOTICE:Schema-Version=0.1
AI-NOTICE:License=MIT
AI-NOTICE:Author=Gary Bajaj
AI-NOTICE:Scope=file
*/
import { useEffect, useState } from "react";
import System from "@/models/system";

export default function CodexSubscriptionOptions({ settings }) {
  const [account, setAccount] = useState(null);
  const [models, setModels] = useState([]);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    setLoading(true);
    const status = await System.codexSubscription();
    setAccount(status.signedIn ? status.account : null);
    if (status.signedIn) {
      const result = await System.customModels("codex-subscription");
      setModels(result.models || []);
    }
    setLoading(false);
  }

  useEffect(() => {
    refresh();
  }, []);

  async function login() {
    const result = await System.codexSubscriptionLogin();
    if (!result.authUrl) return;
    window.open(result.authUrl, "_blank", "noopener,noreferrer");
    for (let attempt = 0; attempt < 60; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      const status = await System.codexSubscription();
      if (!status.signedIn) continue;
      await refresh();
      break;
    }
  }

  return (
    <div className="flex flex-wrap gap-4 mt-1.5">
      <div className="flex flex-col w-60 gap-2">
        <label className="text-white text-sm font-semibold">
          ChatGPT subscription
        </label>
        {account ? (
          <button
            type="button"
            onClick={async () => {
              await System.codexSubscriptionLogout();
              refresh();
            }}
            className="bg-theme-settings-input-bg text-white text-sm rounded-lg p-2.5 text-left"
          >
            Signed in{account.email ? ` as ${account.email}` : ""} - Sign out
          </button>
        ) : (
          <button
            type="button"
            onClick={login}
            className="bg-primary-button text-white text-sm rounded-lg p-2.5"
          >
            Sign in with ChatGPT
          </button>
        )}
      </div>
      <div className="flex flex-col w-60">
        <label className="text-white text-sm font-semibold block mb-3">
          Model
        </label>
        <select
          name="CodexSubscriptionModelPref"
          required
          className="border-none bg-theme-settings-input-bg text-white text-sm rounded-lg p-2.5"
        >
          {(models.length ? models : [{ id: "gpt-5.6-sol", name: "Sol" }]).map(
            (model) => (
              <option
                key={model.id}
                value={model.id}
                selected={
                  (settings?.CodexSubscriptionModelPref || "gpt-5.6-sol") ===
                  model.id
                }
              >
                {model.name || model.id}
              </option>
            )
          )}
        </select>
      </div>
      <div className="flex flex-col w-60">
        <label className="text-white text-sm font-semibold block mb-3">
          Reasoning profile
        </label>
        <select
          name="CodexSubscriptionReasoningEffort"
          required
          className="border-none bg-theme-settings-input-bg text-white text-sm rounded-lg p-2.5"
        >
          {["low", "medium", "high", "xhigh", "max", "ultra"].map((effort) => (
            <option
              key={effort}
              value={effort}
              selected={
                (settings?.CodexSubscriptionReasoningEffort || "max") === effort
              }
            >
              {effort === "max"
                ? "Max"
                : effort === "xhigh"
                  ? "Extra high"
                  : effort[0].toUpperCase() + effort.slice(1)}
            </option>
          ))}
        </select>
      </div>
      {loading && (
        <span className="text-xs text-zinc-400 self-end">
          Checking Codex...
        </span>
      )}
    </div>
  );
}

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

import { useEffect } from "react";
import paths from "@/utils/paths";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import ProviderPrivacy from "@/components/ProviderPrivacy";
import Workspace from "@/models/workspace";
import showToast from "@/utils/toast";

export default function DataHandling({ setHeader, setForwardBtn, setBackBtn }) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const TITLE = t("onboarding.data.title");
  const DESCRIPTION = t("onboarding.data.description");

  useEffect(() => {
    setHeader({ title: TITLE, description: DESCRIPTION });
    setForwardBtn({ showing: true, disabled: false, onClick: handleForward });
    setBackBtn({ showing: false, disabled: false, onClick: handleBack });
  }, []);

  async function handleForward() {
    setForwardBtn({ showing: true, disabled: true, onClick: handleForward });

    try {
      const workspaces = await Workspace.all();
      if (workspaces.length > 0) {
        navigate(paths.home());
        return;
      }

      const { workspace, message } = await Workspace.new({
        name: t("new-workspace.placeholder"),
        onboardingComplete: true,
      });
      if (workspace) {
        navigate(paths.home());
        return;
      }

      showToast(message || "Failed to create workspace", "error");
    } catch (error) {
      showToast(error?.message || "Failed to create workspace", "error");
    } finally {
      setForwardBtn({ showing: true, disabled: false, onClick: handleForward });
    }
  }

  function handleBack() {
    navigate(paths.onboarding.userSetup());
  }

  return (
    <div className="w-full flex items-center justify-center flex-col gap-y-6">
      <ProviderPrivacy />
      <p className="text-theme-text-secondary text-sm font-medium py-1">
        {t("onboarding.data.settingsHint")}
      </p>
    </div>
  );
}

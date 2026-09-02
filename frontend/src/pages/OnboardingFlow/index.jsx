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

import React from "react";
import OnboardingSteps, { OnboardingLayout } from "./Steps";
import paths from "@/utils/paths";
import { Navigate, useParams } from "react-router-dom";

export default function OnboardingFlow() {
  const { step } = useParams();
  if (step === "survey") {
    return <Navigate to={paths.onboarding.dataHandling()} replace />;
  }
  const StepPage = OnboardingSteps[step || "home"];
  if (step === "home" || !step) return <StepPage />;

  return (
    <OnboardingLayout>
      {(setHeader, setBackBtn, setForwardBtn) => (
        <StepPage
          setHeader={setHeader}
          setBackBtn={setBackBtn}
          setForwardBtn={setForwardBtn}
        />
      )}
    </OnboardingLayout>
  );
}

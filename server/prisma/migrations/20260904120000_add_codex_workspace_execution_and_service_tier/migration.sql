-- AI-NOTICE:Schema-Version=0.1 AI-NOTICE:License=MIT AI-NOTICE:Author=Gary Bajaj
ALTER TABLE "workspaces" ADD COLUMN "chatServiceTier" TEXT;
ALTER TABLE "workspaces" ADD COLUMN "codexExecutionMode" TEXT DEFAULT 'read-only';
ALTER TABLE "workspaces" ADD COLUMN "codexWorkspacePath" TEXT;
ALTER TABLE "workspaces" ADD COLUMN "codexSkillsPath" TEXT;

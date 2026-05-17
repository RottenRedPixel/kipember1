-- Rename PromptOverride -> Prompt. The "override" name dates from when each
-- prompt had a hardcoded fallback in code; the DB row is now the source of
-- truth, not an override of anything.
ALTER TABLE "PromptOverride" RENAME TO "Prompt";
ALTER INDEX "PromptOverride_pkey" RENAME TO "Prompt_pkey";

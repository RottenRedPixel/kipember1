-- Split the overloaded `snapshot_generation.regenerate` prompt into dedicated keys
-- per job. Copies the existing body into each new key so the wiki and caption
-- pipelines keep working unchanged. After this migration:
--   * snapshot_generation.regenerate → owned by the snapshot slider's regen
--   * wiki.structure → wiki structure (was claude.ts:664)
--   * wiki.rewrite → wiki rewrite (was claude.ts:712)
--   * caption_generation.suggestions → caption suggester (was caption-suggestions:46)

INSERT INTO "PromptOverride" ("key", "body", "updatedAt")
SELECT 'wiki.structure', "body", NOW()
FROM "PromptOverride"
WHERE "key" = 'snapshot_generation.regenerate'
ON CONFLICT ("key") DO NOTHING;

INSERT INTO "PromptOverride" ("key", "body", "updatedAt")
SELECT 'wiki.rewrite', "body", NOW()
FROM "PromptOverride"
WHERE "key" = 'snapshot_generation.regenerate'
ON CONFLICT ("key") DO NOTHING;

INSERT INTO "PromptOverride" ("key", "body", "updatedAt")
SELECT 'caption_generation.suggestions', "body", NOW()
FROM "PromptOverride"
WHERE "key" = 'snapshot_generation.regenerate'
ON CONFLICT ("key") DO NOTHING;

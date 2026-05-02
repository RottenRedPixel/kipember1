// Upsert a PromptOverride row directly into the database. Use this when you
// want to update a saved prompt body without going through the admin UI.
//
//   npx tsx scripts/set-prompt.ts <prompt_key> <body_file_path> [--by <email>]
//
// The in-process prompt-override cache TTL is 2 seconds, so the change
// propagates to the running dev/prod server within ~2s of completion.

import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { prisma } from '../src/lib/db';

const APPROVED_KEYS = new Set([
  'image_analysis.initial_photo',
  'image_analysis.uploaded_photo',
  'image_analysis.location_resolution',
  'title_generation.initial',
  'title_generation.regenerate',
  'snapshot_generation.initial',
  'snapshot_generation.regenerate',
  'wiki.structure',
  'wiki.rewrite',
  'caption_generation.suggestions',
  'ember_chat.owner_style',
  'ember_chat.contributor_style',
  'ember_chat.guest_style',
  'ember_voice.owner_style',
  'ember_voice.contributor_style',
  'ember_voice.guest_style',
  'ember_call.owner_style',
  'ember_call.contributor_style',
  'ember_sms.style',
  'housekeeping.why_extraction',
  'housekeeping.emotion_extraction',
  'housekeeping.extra_story_extraction',
  'housekeeping.place_extraction',
]);

function parseArgs(argv: string[]) {
  const positional: string[] = [];
  let updatedBy: string | null = null;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--by') {
      updatedBy = argv[i + 1];
      i++;
    } else {
      positional.push(arg);
    }
  }
  return { positional, updatedBy };
}

async function main() {
  const { positional, updatedBy } = parseArgs(process.argv.slice(2));
  const [key, bodyPath] = positional;
  if (!key || !bodyPath) {
    console.error('Usage: npx tsx scripts/set-prompt.ts <prompt_key> <body_file_path> [--by <email>]');
    process.exit(1);
  }
  if (!APPROVED_KEYS.has(key)) {
    console.error(`Unknown prompt key: ${key}`);
    process.exit(1);
  }

  const body = readFileSync(resolve(bodyPath), 'utf8').trim();
  if (!body) {
    console.error('Body file is empty.');
    process.exit(1);
  }

  const saved = await prisma.promptOverride.upsert({
    where: { key },
    create: { key, body, updatedBy: updatedBy ?? null },
    update: { body, updatedBy: updatedBy ?? null },
  });
  console.log(`OK  ${saved.key}  ${body.length} chars  saved at ${saved.updatedAt.toISOString()}`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

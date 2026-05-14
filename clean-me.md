# Clean-me — retired features still in the code

Audit of three features that feed the snapshot/wiki AI prompts. Done
because Voice Call Highlights was discovered to be retired, then the
adjacent inputs were checked for the same status.

---

## 1. Voice Call Highlights — RETIRED (safe to delete)

**Status:** the extractor was gutted but the surrounding plumbing
remained. No new highlights are written. No UI consumer renders them.

**Smoking gun.** `src/lib/voice-call-clips.ts` line 247:

```ts
export async function extractImportantVoiceCallClips(_args: {...}): Promise<ExtractedVoiceCallClip[]> {
  // Highlight extraction prompt was retired. Returning an empty list so the
  // call pipeline keeps working without producing voice-call clips.
  return [];
}
```

So `prisma.voiceCallClip.createMany` at `src/lib/voice-calls.ts:622`
never runs. Existing rows from before retirement may still sit in the
DB but no new ones land.

### What still references `VoiceCallClip` / `callHighlights`

Writes (no-ops in practice):
- `src/lib/voice-call-clips.ts:247` — the retired extractor itself
- `src/lib/voice-calls.ts:544` — caller of the extractor
- `src/lib/voice-calls.ts:617-633` — the `deleteMany` + `createMany` block
  that processes the (always empty) extractor output

Server-side reads that feed AI prompts (currently produce empty arrays):
- `src/lib/wiki-generator.ts` — builds `callHighlights[]` for wiki gen
- `src/lib/context-retrieval/simple-retriever.ts` — pulls clips into
  the retrieval context
- `src/lib/ember-setup-context.ts` — reads `ember.voiceCallClips` for
  the merged context bag
- `src/lib/claude.ts:301, 371-383, 611, 633` — the AI prompt builder's
  `callHighlights` parameter
- `src/lib/snapshot-generator.ts:23, 35, 65-66` — VOICE CALL HIGHLIGHTS
  section of the snapshot prompt

API responses (return empty arrays over the wire):
- `src/app/api/embers/[id]/route.ts:349, 549-551, 762, 1182`
- `src/app/api/wiki/[emberId]/route.ts:119-159, 183`
- `src/app/api/embers/[id]/snapshot/route.ts:37, 54`
- `src/app/api/embers/route.ts:94, 106`
- `src/app/api/embers/[id]/analysis/route.ts:38, 51`

Type-only / dead leaves:
- `src/components/kipember/KipemberWikiContent.tsx:178, 244`
- `src/components/kipember/tend/EditSnapshotSlider.tsx:8, 28`
- `src/lib/audio-segments.ts:44` — a `voiceCallClip.findFirst` used in
  one small path; verify before deleting

UI consumers: **zero.** No JSX iterates `voiceCallClips` to render anything.

### Three levels of deletion

1. **Stub-only.** Delete the no-op `extractImportantVoiceCallClips`
   function and its sole callsite. Trivial; already does nothing.
2. **Full code purge.** Strip all read paths, remove `callHighlights`
   from snapshot/wiki AI prompts and from API responses. Several files
   touched but each change is a deletion. The AI loses one input
   section; the team apparently accepted that when retiring the
   extractor.
3. **Schema drop.** Add a Prisma migration to drop the `VoiceCallClip`
   table. Needs a real migration; orphans any historical rows.

**Recommendation:** do 1+2 in one pass. Defer 3.

---

## 2. Voice Call Summaries — FULLY ALIVE (keep)

**Source:** `VoiceCall.callSummary` field, populated at
`src/lib/voice-calls.ts:467` from **Retell's own
`call_analysis.call_summary`** when the call lands. That summary comes
from Retell's analysis layer, independent of any of our extraction
prompts — so retiring our prompts didn't break it.

**Live consumers:**
- UI: contribution count signal in
  `src/components/kipember/KipemberWikiContent.tsx:2787, 2852` — the
  green/grey badge that says "this contributor actually contributed."
  Uses `c.callSummary` as the truth signal.
- AI: VOICE CALL SUMMARIES section of the snapshot prompt
- AI: prior-call context passed to Retell on the next call
- Various contributor/wiki API responses

**Verdict:** cannot delete. Real data, actively used.

---

## 3. Contributor Memories — ALIVE BUT SPARSE (keep)

**Source:** `EmberMessage` rows where `questionType` is set to one of
context / who / what / when / where / why / how / followup. The
snapshot generator pulls these as `contributorMemories[]`.

**Still-active writers:**
- `src/lib/interview.ts:170, 206` — SMS interview flow, invoked from
  `src/app/api/twilio/webhook/route.ts`
- `src/app/api/chat/audio/route.ts:169` — audio chat path sets
  `questionType: 'followup'`

**Inactive writer:** the main typed-chat route
(`src/app/api/chat/route.ts:125`) writes `questionType: null`, so chat
messages from the in-app chat surface do **not** populate this data.

**Net effect:** contributor memories only fill via SMS interviews
(Twilio) and audio chat 'followup' messages. Functional, just a narrow
entry point.

**Verdict:** not retired. Removing this would break the Twilio SMS
interview pipeline. Keep.

---

## Summary

| Feature | Status | Action |
|---|---|---|
| Voice Call Highlights | Retired | Strip code (levels 1+2). Defer DB migration. |
| Voice Call Summaries | Live | Leave alone. |
| Contributor Memories | Live but narrow | Leave alone. |

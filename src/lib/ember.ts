/**
 * Ember domain barrel.
 *
 * The product calls the main object an Ember — a memory built around a primary
 * photo. The Prisma schema still calls it `Image` for historical reasons; the
 * media-asset language is correct for things that genuinely deal with the
 * photo file (filename, mediaType, crop, EXIF, face boxes), but the *memory
 * object itself* should be expressed as an Ember.
 *
 * Phase 1 of the migration: this module re-exports the canonical Ember-named
 * types and helpers from their existing homes so new code has a single place
 * to import from. Legacy `Image*` exports continue to work — they alias the
 * same implementations.
 *
 * Phase 2 will migrate call sites to import from here.
 * Phase 3 (later, only if needed) considers schema/URL renames.
 */

export type { EmberSummary, ContributorSummary } from '@/lib/ember-summaries';
export {
  getAccessibleEmbersForUser,
  invalidateAccessibleEmbersForUser,
  getTotalContributorsForUser,
  getContributorsListForUser,
} from '@/lib/ember-summaries';

export type { EmberAccessType } from '@/lib/ember-access';
export {
  getEmberAccessType,
  ensureEmberOwnerAccess,
  getAcceptedFriends,
  getAcceptedFriendIds,
  ensureOwnedContributorAccess,
  ensureContributorRemovalAccess,
} from '@/lib/ember-access';

export { getEmberTitle } from '@/lib/ember-title';

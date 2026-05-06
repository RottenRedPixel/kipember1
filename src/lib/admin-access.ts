/**
 * Admin gate. A user is an admin iff their email is in the ADMIN_EMAILS
 * env var allowlist (comma-separated, case-insensitive). No DB changes
 * needed; flipping admin = env var edit + redeploy.
 *
 * When this product needs role tiers (read-only support, full admin,
 * etc.), migrate to a `role` column on User and update isAdmin() to
 * read it. Keep the env var as a bootstrap fallback.
 */
export function isAdmin(user: { email: string | null } | null | undefined): boolean {
  if (!user || !user.email) return false;
  const allow = (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return allow.includes(user.email.toLowerCase());
}

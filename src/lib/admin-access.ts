/**
 * Admin gate. A user is an admin iff their email is in the ADMIN_EMAILS
 * env var allowlist (comma-separated, case-insensitive). No DB changes
 * needed; flipping admin = env var edit + redeploy.
 *
 * When this product needs role tiers (read-only support, full admin,
 * etc.), migrate to a `role` column on User and update isAdmin() to
 * read it. Keep the env var as a bootstrap fallback.
 */
export function isAdmin(user: { email: string | null; phoneNumber?: string | null } | null | undefined): boolean {
  if (!user) return false;

  if (user.email) {
    const allowEmails = (process.env.ADMIN_EMAILS || '')
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
    if (allowEmails.includes(user.email.toLowerCase())) return true;
  }

  if (user.phoneNumber) {
    const allowPhones = (process.env.ADMIN_PHONES || '')
      .split(',')
      .map((p) => p.trim().replace(/\D/g, ''))
      .filter(Boolean);
    const normalized = user.phoneNumber.replace(/\D/g, '');
    if (allowPhones.includes(normalized)) return true;
  }

  return false;
}

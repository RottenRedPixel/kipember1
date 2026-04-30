export type UserNameParts = {
  firstName: string | null;
  lastName: string | null;
};

export function getUserDisplayName(user: UserNameParts | null | undefined): string | null {
  if (!user) return null;
  const parts = [user.firstName, user.lastName]
    .map((part) => (typeof part === 'string' ? part.trim() : ''))
    .filter(Boolean);
  return parts.length ? parts.join(' ') : null;
}

export function getUserFirstName(user: UserNameParts | null | undefined): string | null {
  if (!user) return null;
  const trimmed = typeof user.firstName === 'string' ? user.firstName.trim() : '';
  return trimmed || null;
}

export function splitFullName(full: string | null | undefined): {
  firstName: string | null;
  lastName: string | null;
} {
  const trimmed = typeof full === 'string' ? full.trim() : '';
  if (!trimmed) return { firstName: null, lastName: null };
  const [first, ...rest] = trimmed.split(/\s+/);
  return {
    firstName: first || null,
    lastName: rest.length ? rest.join(' ') : null,
  };
}

'use client';

import { Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function DeleteUserButton({
  userId,
  userLabel,
  isSelf,
}: {
  userId: string;
  userLabel: string;
  isSelf: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function handleClick() {
    if (isSelf || busy) return;
    const ok = window.confirm(
      `Delete ${userLabel}?\n\nThis permanently removes their account along with every ember they own (and the wikis, snapshots, contributors, and chats inside those embers). This cannot be undone.`
    );
    if (!ok) return;

    setBusy(true);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, { method: 'DELETE' });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        window.alert(payload?.error || 'Failed to delete user.');
        return;
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isSelf || busy}
      title={isSelf ? "Can't delete your own admin account" : 'Delete user'}
      aria-label={isSelf ? "Can't delete your own admin account" : `Delete ${userLabel}`}
      className="inline-flex items-center justify-center w-8 h-8 rounded text-red-600 hover:bg-red-50 disabled:opacity-30 disabled:cursor-not-allowed"
    >
      <Trash2 size={14} strokeWidth={1.8} />
    </button>
  );
}

'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function LogoutButton() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleLogout = async () => {
    setIsSubmitting(true);

    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
      });
      router.push('/signin');
      router.refresh();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={isSubmitting}
      className="kip-secondary-button px-4 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {isSubmitting ? 'Logging out...' : 'Logout'}
    </button>
  );
}

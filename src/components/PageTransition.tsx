'use client';

import { usePathname } from 'next/navigation';

export default function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  // key={pathname} forces a remount on every navigation, which re-triggers
  // the pageFadeIn animation for a smooth cross-page fade.
  return (
    <div key={pathname} style={{ animation: 'pageFadeIn 0.25s ease', height: '100%' }}>
      {children}
    </div>
  );
}

import type { ReactNode } from 'react';

// Shared page shell for unauthenticated screens + a few logged-in dashboards.
// Centralizes the min-h-[100dvh] + bg-screen + paddingTop:56 + AppHeader +
// max-w-* centered column pattern that was hand-rolled in 8+ places.

type PageShellProps = {
  children: ReactNode;
  header?: ReactNode;
  width?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  contentClassName?: string;
};

const MAX_W: Record<NonNullable<PageShellProps['width']>, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
};

export default function PageShell({
  children,
  header,
  width = 'xl',
  contentClassName,
}: PageShellProps) {
  return (
    <div
      className="flex w-full flex-col items-center justify-start px-4"
      style={{ minHeight: '100dvh', background: 'var(--bg-screen)', paddingTop: 56 }}
    >
      {header}
      <div
        className={`flex w-full ${MAX_W[width]} flex-col ${contentClassName ?? 'gap-8 pt-6 pb-16 fade-in'}`}
      >
        {children}
      </div>
    </div>
  );
}

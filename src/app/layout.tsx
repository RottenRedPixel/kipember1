import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Ember',
  description:
    'Transform photos into living memory spaces. Upload an Ember, invite contributors, and build a shared archive that grows through conversation.',
  icons: {
    icon: '/emberfav.svg',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}

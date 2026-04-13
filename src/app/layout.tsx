import type { Metadata } from 'next';
import { Ubuntu } from 'next/font/google';
import './globals.css';

const ubuntu = Ubuntu({
  subsets: ['latin'],
  weight: ['300', '400', '500', '700'],
  variable: '--font-ubuntu',
  display: 'swap',
});

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
    <html lang="en" className={`${ubuntu.variable} h-full`}>
      <body className="antialiased">{children}</body>
    </html>
  );
}

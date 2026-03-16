import type { Metadata } from 'next';
import { Bricolage_Grotesque, Geist_Mono, Manrope } from 'next/font/google';
import './globals.css';

const emberSans = Manrope({
  variable: '--font-ember-sans',
  subsets: ['latin'],
});

const emberDisplay = Bricolage_Grotesque({
  variable: '--font-ember-display',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
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
    <html lang="en">
      <body className={`${emberSans.variable} ${emberDisplay.variable} ${geistMono.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}

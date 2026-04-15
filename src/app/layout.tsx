import type { Metadata } from 'next';
import { Ubuntu } from 'next/font/google';
import './globals.css';

const ubuntu = Ubuntu({
  weight: ['300', '400', '500', '700'],
  subsets: ['latin'],
  variable: '--font-ubuntu',
});

export const metadata: Metadata = {
  title: 'Ember',
  description: 'Your memory, alive.',
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
    <html
      lang="en"
      className={`${ubuntu.variable} h-full antialiased`}
      style={{ fontFamily: 'var(--font-ubuntu), sans-serif' }}
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){var t=localStorage.getItem('ember-theme');if(t)document.documentElement.dataset.theme=t;})();",
          }}
        />
      </head>
      <body className="h-full w-full">{children}</body>
    </html>
  );
}

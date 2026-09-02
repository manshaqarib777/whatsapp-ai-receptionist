import type { Metadata } from 'next';
import { connection } from 'next/server';
import { headers } from 'next/headers';
import { GeistMono } from 'geist/font/mono';
import { GeistSans } from 'geist/font/sans';

import { QueryProvider } from '@/providers/query-provider';
import { ThemeProvider } from '@/providers/theme-provider';

import './globals.css';

export const metadata: Metadata = {
  title: 'WhatsApp AI Receptionist',
  description: 'AI-powered customer communication for small and medium businesses.',
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // A fresh CSP nonce is created in Proxy for every document request. Next can only
  // attach that nonce to framework scripts during request-time rendering.
  await connection();
  const nonce = (await headers()).get('x-nonce') ?? undefined;
  return (
    <html
      lang="en"
      dir="ltr"
      // next-themes writes the theme class before hydration, so React will always
      // see a mismatch here. Scoped to <html> only.
      suppressHydrationWarning
      className={`${GeistSans.variable} ${GeistMono.variable} h-full antialiased`}
    >
      <body className="bg-background text-foreground flex min-h-full flex-col">
        <ThemeProvider nonce={nonce}>
          <QueryProvider>{children}</QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

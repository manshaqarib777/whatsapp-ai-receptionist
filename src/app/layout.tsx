import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';

import { QueryProvider } from '@/providers/query-provider';

import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
  display: 'swap',
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'WhatsApp AI Receptionist',
  description: 'AI-powered customer communication for small and medium businesses.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="bg-background text-foreground flex min-h-full flex-col">
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}

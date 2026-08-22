import type { Metadata, Viewport } from 'next';
import Script from 'next/script';
import './globals.css';
import { QueryProvider } from '../providers/query-provider';
import { TelegramProvider } from '../providers/telegram-provider';

export const metadata: Metadata = {
  title: 'FlowTask — Telegram Task Manager SaaS',
  description: 'Turn your Telegram conversations into organized, actionable work.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        {/* Telegram WebApp official SDK script */}
        <Script
          src="https://telegram.org/js/telegram-web-app.js"
          strategy="beforeInteractive"
        />
      </head>
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased dark:bg-slate-950 dark:text-slate-50">
        <QueryProvider>
          <TelegramProvider>
            <main className="max-w-md mx-auto min-h-screen flex flex-col p-4">
              {children}
            </main>
          </TelegramProvider>
        </QueryProvider>
      </body>
    </html>
  );
}

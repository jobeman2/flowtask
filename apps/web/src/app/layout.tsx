import type { Metadata, Viewport } from 'next';
import Script from 'next/script';
import { DM_Sans } from 'next/font/google';
import './globals.css';
import { QueryProvider } from '../providers/query-provider';
import { TelegramProvider } from '../providers/telegram-provider';

const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800', '900'],
  variable: '--font-dm-sans',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Flow — Telegram Task & Team Manager',
  description: 'Turn your Telegram conversations into organized, actionable work with Flow.',
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
    <html lang="en" className={dmSans.variable}>
      <head>
        {/* Telegram WebApp official SDK script */}
        <Script
          src="https://telegram.org/js/telegram-web-app.js"
          strategy="beforeInteractive"
        />
      </head>
      <body className={`${dmSans.className} min-h-screen bg-[#F8FAFC] text-slate-900 antialiased dark:bg-[#0B1120] dark:text-slate-50 font-sans selection:bg-blue-500 selection:text-white`}>
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

import type { Metadata } from 'next';
import { IBM_Plex_Sans_Arabic, Inter, IBM_Plex_Mono } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';
import { RTLProvider } from '@/components/layout/RTLProvider';

const ibmPlexArabic = IBM_Plex_Sans_Arabic({
  subsets: ['arabic', 'latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-arabic',
  display: 'swap',
});

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'EduFinance KSA - نظام المحاسبة المدرسية',
  description: 'نظام محاسبة سحابي متكامل للمدارس في المملكة العربية السعودية',
  keywords: ['accounting', 'school', 'Saudi Arabia', 'VAT', 'ZATCA', 'مدرسة', 'محاسبة', 'السعودية'],
  authors: [{ name: 'EduFinance' }],
  icons: {
    icon: '/favicon.ico',
  },
};

export default function RootLayout({
  children,
  params: { locale = 'ar' },
}: {
  children: React.ReactNode;
  params: { locale?: string };
}) {
  return (
    <html lang={locale} dir="rtl" className={`${ibmPlexArabic.variable} ${inter.variable} ${ibmPlexMono.variable}`}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className="min-h-screen bg-background font-arabic antialiased">
        <Providers>
          <RTLProvider>
            {children}
          </RTLProvider>
        </Providers>
      </body>
    </html>
  );
}
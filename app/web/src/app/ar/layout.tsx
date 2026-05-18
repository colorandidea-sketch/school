import type { Metadata } from 'next';
import { IBM_Plex_Sans_Arabic, Inter, IBM_Plex_Mono } from 'next/font/google';
import '../../globals.css';
import { Providers } from '../../providers';
import { RTLProvider } from '@/components/layout/RTLProvider';
import AppLayout from '@/components/layout/AppLayout';

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
  title: 'EduFinance KSA - لوحة التحكم',
  description: 'نظام محاسبة سحابي متكامل للمدارس في المملكة العربية السعودية',
};

export default function ArabicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className="min-h-screen bg-background font-arabic antialiased">
        <Providers>
          <RTLProvider>
            <AppLayout>{children}</AppLayout>
          </RTLProvider>
        </Providers>
      </body>
    </html>
  );
}
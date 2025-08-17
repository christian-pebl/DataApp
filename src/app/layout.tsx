
import type {Metadata} from 'next';
import { Roboto } from 'next/font/google';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import { createClient } from '@/lib/supabase/server';
import TopNavigation from '@/components/layout/TopNavigation';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';

// PEBL Brand Typography: Roboto for body text
const roboto = Roboto({
  subsets: ['latin'],
  weight: ['300', '400', '500', '700'],
  style: ['normal', 'italic'],
  variable: '--font-roboto',
});

// Note: Futura is not available in Google Fonts, so we'll use a system fallback
// In production, you would load Futura from a custom font file

export const metadata: Metadata = {
  title: 'PEBL Ocean Data Platform',
  description: 'Advanced marine and meteorological data visualization platform for ocean energy applications.',
  keywords: ['ocean energy', 'marine data', 'weather analysis', 'PEBL', 'data visualization'],
  authors: [{ name: 'PEBL' }],
  icons: {
    icon: '/logos/PEBL Logo-3.svg',
    apple: '/logos/PEBL Logo-3.svg',
  },
  openGraph: {
    title: 'PEBL Ocean Data Platform',
    description: 'Advanced marine and meteorological data visualization platform for ocean energy applications.',
    type: 'website',
    images: ['/logos/PEBL Logo-1.svg'],
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <html lang="en">
      <body className={`${roboto.variable} font-roboto antialiased`}>
        <ErrorBoundary>
          {user && <TopNavigation user={user} />}
          {children}
          <Toaster />
        </ErrorBoundary>
      </body>
    </html>
  );
}

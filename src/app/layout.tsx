
import type {Metadata} from 'next';
import { Roboto } from 'next/font/google';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import { createClient } from '@/lib/supabase/server';
import TopNavigation from '@/components/layout/TopNavigation';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { NavigationErrorBoundary } from '@/components/layout/NavigationErrorBoundary';

// PEBL Brand Typography: Roboto for body text
const roboto = Roboto({
  subsets: ['latin'],
  weight: ['300', '400', '500', '700'],
  style: ['normal', 'italic'],
  variable: '--font-roboto',
  display: 'swap', // Show fallback font immediately, swap when custom font loads
  preload: true,   // Preload font for faster initial load
});

// Note: Futura is not available in Google Fonts, so we'll use a system fallback
// In production, you would load Futura from a custom font file

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:9002'),
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
  // Safe user fetching with error handling
  // Note: Server-side auth often fails in development, but client-side will pick it up
  let user = null;
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getUser();
    if (error) {
      // Don't log auth session missing errors in development as they're common
      if (error.message !== 'Auth session missing!' || process.env.NODE_ENV !== 'development') {
        console.error('Error fetching user in layout:', error);
      }
    } else {
      user = data.user;
    }
  } catch (error) {
    console.error('Failed to initialize Supabase in layout:', error);
  }

  return (
    <html lang="en">
      <body className={`${roboto.variable} font-roboto antialiased`}>
        <ErrorBoundary>
          {/* Wrap TopNavigation with its own error boundary for extra protection */}
          <NavigationErrorBoundary>
            <TopNavigation user={user} />
          </NavigationErrorBoundary>
          {children}
          <Toaster />
        </ErrorBoundary>
      </body>
    </html>
  );
}

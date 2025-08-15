
import type {Metadata} from 'next';
import { Inter, Roboto_Mono } from 'next/font/google';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import { createClient } from '@/lib/supabase/server';
import TopNavigation from '@/components/layout/TopNavigation';


const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
});

const robotoMono = Roboto_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
});

export const metadata: Metadata = {
  title: 'PEBL data app',
  description: 'Weather data visualization and analysis.',
  icons: [],
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  let user = null;
  
  // In development, create a mock user to bypass auth
  if (process.env.NODE_ENV === 'development') {
    user = {
      id: 'dev-user',
      email: 'developer@localhost',
      user_metadata: {
        full_name: 'Development User'
      }
    };
  } else {
    const supabase = await createClient();
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();
    user = authUser;
  }

  return (
    <html lang="en">
      <body className={`${inter.variable} ${robotoMono.variable} font-sans antialiased`}>
        {user && <TopNavigation user={user} />}
        {children}
        <Toaster />
      </body>
    </html>
  );
}

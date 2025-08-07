
import type {Metadata} from 'next';
import { Inter, Roboto_Mono } from 'next/font/google';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import { createClient } from '@/lib/supabase/server';
import UserMenu from '@/components/auth/UserMenu';


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
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <html lang="en">
      <body className={`${inter.variable} ${robotoMono.variable} font-sans antialiased`}>
        {user && (
          <nav className="border-b bg-white px-4 py-2">
            <div className="max-w-7xl mx-auto flex justify-between items-center">
              <h1 className="text-xl font-semibold">DataApp</h1>
              <UserMenu user={user} />
            </div>
          </nav>
        )}
        {children}
        <Toaster />
      </body>
    </html>
  );
}

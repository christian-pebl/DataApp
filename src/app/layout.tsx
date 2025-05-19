
import type {Metadata} from 'next';
import { Inter, Roboto_Mono } from 'next/font/google'; // Changed from Geist to Inter and Roboto_Mono
import './globals.css';
import { Toaster } from "@/components/ui/toaster";

const inter = Inter({ // Changed from Geist
  subsets: ['latin'],
  variable: '--font-sans', // Using --font-sans for the primary sans-serif font
});

const robotoMono = Roboto_Mono({ // Changed from Geist_Mono
  subsets: ['latin'],
  variable: '--font-mono', // Using --font-mono for the monospace font
});

export const metadata: Metadata = {
  title: 'DataFlow',
  description: 'Visualize your time series data with ease.',
  icons: null, // Explicitly set icons to null
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${robotoMono.variable} antialiased`}> {/* Updated to use new font variables */}
        {children}
        <Toaster />
      </body>
    </html>
  );
}

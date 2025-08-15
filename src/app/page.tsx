import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export default async function HomePage() {
  // In development, skip auth check and go directly to data explorer
  if (process.env.NODE_ENV === 'development') {
    redirect('/data-explorer');
  }

  const supabase = await createClient();
  
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth');
  }

  // If user is authenticated, redirect to data explorer
  redirect('/data-explorer');
}

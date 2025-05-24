
"use client";

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export default function RedirectToDefaultPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/om-marine-explorer'); // Changed to OM Marine Explorer as the new combined default
  }, [router]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground p-4">
      <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
      <p className="text-lg text-muted-foreground">Redirecting to Weather & Marine Data Explorer...</p>
    </div>
  );
}

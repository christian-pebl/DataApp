
"use client";

// This page's functionality has been merged into /data-explorer
// This file will be removed by the build system if not referenced,
// or should act as a redirect if a direct link is still used.
import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export default function RedirectToDataExplorer() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/data-explorer');
  }, [router]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground p-4">
      <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
      <p className="text-lg text-muted-foreground">Redirecting to Data Explorer...</p>
    </div>
  );
}

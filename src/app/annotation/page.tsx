
"use client";

// This page is being deprecated. Its functionality is merged into PlotInstance.tsx
// and used within the /data-explorer page.

import React from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export default function DeprecatedAnnotationPage() {
  const router = useRouter();

  React.useEffect(() => {
    router.replace('/data-explorer'); // Redirect to the data explorer
  }, [router]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground p-4">
      <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
      <p className="text-lg text-muted-foreground">Redirecting to Data Explorer...</p>
    </div>
  );
}

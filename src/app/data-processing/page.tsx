'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'
import ExperimentsDashboard from '@/components/ocean-ml/ExperimentsDashboard'

export default function DataProcessingPage() {
  // Create a query client for this page
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, // 1 minute
            retry: 1,
          },
        },
      })
  )

  return (
    <QueryClientProvider client={queryClient}>
      <div className="min-h-screen bg-background">
        {/* Main content */}
        <main className="flex-grow">
          <ExperimentsDashboard />
        </main>

        {/* Footer */}
        <footer className="py-3 sm:px-3 sm:py-2 border-t bg-secondary/50">
          <div className="container flex flex-col items-center justify-center gap-2 sm:h-14 sm:flex-row sm:justify-between">
            <div className="flex flex-col items-center sm:items-start gap-1">
              <div className="flex items-center gap-2">
                <div className="text-xs font-futura font-bold text-primary">PEBL</div>
                <div className="text-xs text-muted-foreground pebl-body-main">Ocean Data Platform</div>
              </div>
              <div className="text-[0.6rem] text-primary font-futura font-medium">
                Protecting Ecology Beyond Land
              </div>
            </div>
            <div className="text-xs text-muted-foreground pebl-body-main">© 2024 PEBL</div>
          </div>
        </footer>
      </div>
    </QueryClientProvider>
  )
}

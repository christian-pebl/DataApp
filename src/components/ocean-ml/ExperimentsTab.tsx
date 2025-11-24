'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import QuickStats from './QuickStats'
import ExperimentsTable from './ExperimentsTable'
import ExperimentDetailDialog from './ExperimentDetailDialog'
import { CVExperiment } from './ExperimentCard'

export default function ExperimentsTab() {
  const [selectedExperiment, setSelectedExperiment] = useState<CVExperiment | null>(null)
  const [detailDialogOpen, setDetailDialogOpen] = useState(false)

  // Fetch experiments
  const { data: experimentsResponse, isLoading } = useQuery<{ experiments: CVExperiment[] }>({
    queryKey: ['cv-experiments'],
    queryFn: async () => {
      const response = await fetch('/api/cv-experiments')
      if (!response.ok) throw new Error('Failed to fetch experiments')
      return response.json()
    },
    refetchInterval: 10000, // Refetch every 10 seconds
    refetchOnWindowFocus: false,
  })

  const experiments = experimentsResponse?.experiments || []

  const handleExperimentClick = (experiment: CVExperiment) => {
    setSelectedExperiment(experiment)
    setDetailDialogOpen(true)
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <div className="text-center space-y-4">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
            <p className="text-muted-foreground">Loading experiments...</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Quick Stats */}
      <QuickStats />

      {/* Experiments Table */}
      <ExperimentsTable
        experiments={experiments}
        onExperimentClick={handleExperimentClick}
      />

      {/* Detail Dialog */}
      <ExperimentDetailDialog
        experiment={selectedExperiment}
        open={detailDialogOpen}
        onOpenChange={setDetailDialogOpen}
      />
    </div>
  )
}

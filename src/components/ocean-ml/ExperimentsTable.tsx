'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { FlaskConical, Search, Filter } from 'lucide-react'
import ExperimentCard, { CVExperiment } from './ExperimentCard'

interface ExperimentsTableProps {
  experiments: CVExperiment[]
  onExperimentClick?: (experiment: CVExperiment) => void
}

export default function ExperimentsTable({ experiments, onExperimentClick }: ExperimentsTableProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string | null>(null)

  // Filter experiments
  const filteredExperiments = experiments.filter((exp) => {
    const matchesSearch =
      exp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      exp.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      exp.videoFilename?.toLowerCase().includes(searchQuery.toLowerCase())

    const matchesStatus = statusFilter ? exp.status === statusFilter : true

    return matchesSearch && matchesStatus
  })

  // Get status counts
  const statusCounts = experiments.reduce((acc, exp) => {
    acc[exp.status] = (acc[exp.status] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search experiments by name, description, or video..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Status Filter */}
        <div className="flex gap-2">
          <Button
            variant={statusFilter === null ? 'default' : 'outline'}
            size="sm"
            onClick={() => setStatusFilter(null)}
          >
            All ({experiments.length})
          </Button>
          {Object.entries(statusCounts).map(([status, count]) => (
            <Button
              key={status}
              variant={statusFilter === status ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStatusFilter(status)}
            >
              {status} ({count})
            </Button>
          ))}
        </div>
      </div>

      {/* Experiments Grid */}
      {filteredExperiments.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2">
          {filteredExperiments.map((experiment) => (
            <ExperimentCard
              key={experiment.id}
              experiment={experiment}
              onClick={() => onExperimentClick?.(experiment)}
            />
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12">
            <div className="text-center space-y-4">
              <FlaskConical className="h-16 w-16 mx-auto text-muted-foreground opacity-50" />
              <div>
                <h2 className="text-xl font-semibold mb-2">
                  {searchQuery || statusFilter ? 'No experiments found' : 'No experiments yet'}
                </h2>
                <p className="text-muted-foreground">
                  {searchQuery || statusFilter
                    ? 'Try adjusting your filters'
                    : 'Run your first experiment to see it here'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

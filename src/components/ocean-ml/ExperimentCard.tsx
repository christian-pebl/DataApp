'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Eye, Video, Cpu, DollarSign, Clock } from 'lucide-react'

export interface CVExperiment {
  id: string
  name: string
  description?: string
  videoFilename?: string
  modelName?: string
  modelArchitecture?: string
  status: 'running' | 'completed' | 'failed' | 'cancelled'
  startedAt: string
  completedAt?: string
  metrics?: {
    map50?: number
    map50_95?: number
    precision?: number
    recall?: number
    [key: string]: any
  }
  gpuType?: string
  gpuHours?: number
  computeCostUsd?: number
  preprocessingSteps?: any[]
  hyperparameters?: any
}

interface ExperimentCardProps {
  experiment: CVExperiment
  onClick?: () => void
}

export default function ExperimentCard({ experiment, onClick }: ExperimentCardProps) {
  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'completed':
        return 'default'
      case 'running':
        return 'secondary'
      case 'failed':
        return 'destructive'
      case 'cancelled':
        return 'outline'
      default:
        return 'outline'
    }
  }

  const formatDuration = (startedAt: string, completedAt?: string) => {
    const start = new Date(startedAt)
    const end = completedAt ? new Date(completedAt) : new Date()
    const durationMs = end.getTime() - start.getTime()
    const minutes = Math.floor(durationMs / 60000)
    const hours = Math.floor(minutes / 60)

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`
    }
    return `${minutes}m`
  }

  return (
    <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={onClick}>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-lg">{experiment.name}</CardTitle>
            {experiment.description && (
              <CardDescription className="mt-1">{experiment.description}</CardDescription>
            )}
          </div>
          <Badge variant={getStatusVariant(experiment.status)}>
            {experiment.status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {/* Model & Video Info */}
          <div className="grid grid-cols-2 gap-2 text-sm">
            {experiment.modelName && (
              <div className="flex items-center gap-2">
                <Cpu className="h-3 w-3 text-muted-foreground" />
                <span className="text-muted-foreground">Model:</span>
                <span className="font-medium">{experiment.modelName}</span>
              </div>
            )}
            {experiment.videoFilename && (
              <div className="flex items-center gap-2">
                <Video className="h-3 w-3 text-muted-foreground" />
                <span className="text-muted-foreground">Video:</span>
                <span className="font-medium truncate">{experiment.videoFilename}</span>
              </div>
            )}
          </div>

          {/* Metrics */}
          {experiment.metrics && Object.keys(experiment.metrics).length > 0 && (
            <div className="grid grid-cols-2 gap-2 text-sm">
              {experiment.metrics.map50 !== undefined && (
                <div>
                  <span className="text-muted-foreground">mAP50:</span>{' '}
                  <span className="font-medium">{(experiment.metrics.map50 * 100).toFixed(1)}%</span>
                </div>
              )}
              {experiment.metrics.map50_95 !== undefined && (
                <div>
                  <span className="text-muted-foreground">mAP50-95:</span>{' '}
                  <span className="font-medium">{(experiment.metrics.map50_95 * 100).toFixed(1)}%</span>
                </div>
              )}
              {experiment.metrics.precision !== undefined && (
                <div>
                  <span className="text-muted-foreground">Precision:</span>{' '}
                  <span className="font-medium">{(experiment.metrics.precision * 100).toFixed(1)}%</span>
                </div>
              )}
              {experiment.metrics.recall !== undefined && (
                <div>
                  <span className="text-muted-foreground">Recall:</span>{' '}
                  <span className="font-medium">{(experiment.metrics.recall * 100).toFixed(1)}%</span>
                </div>
              )}
            </div>
          )}

          {/* Cost & Duration */}
          <div className="flex items-center justify-between text-sm pt-2 border-t">
            <div className="flex items-center gap-4">
              {experiment.computeCostUsd !== undefined && (
                <div className="flex items-center gap-1">
                  <DollarSign className="h-3 w-3 text-muted-foreground" />
                  <span className="font-medium">${experiment.computeCostUsd.toFixed(2)}</span>
                </div>
              )}
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3 text-muted-foreground" />
                <span className="font-medium">
                  {formatDuration(experiment.startedAt, experiment.completedAt)}
                </span>
              </div>
            </div>
            <Button variant="ghost" size="sm" className="h-8">
              <Eye className="h-4 w-4 mr-1" />
              Details
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

'use client'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Video,
  Cpu,
  Settings,
  BarChart3,
  DollarSign,
  Clock,
  Calendar,
  GitCommit,
  Box
} from 'lucide-react'
import { CVExperiment } from './ExperimentCard'

interface ExperimentDetailDialogProps {
  experiment: CVExperiment | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export default function ExperimentDetailDialog({
  experiment,
  open,
  onOpenChange,
}: ExperimentDetailDialogProps) {
  if (!experiment) return null

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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between">
            <div>
              <DialogTitle className="text-2xl">{experiment.name}</DialogTitle>
              {experiment.description && (
                <DialogDescription className="mt-2">{experiment.description}</DialogDescription>
              )}
            </div>
            <Badge variant={getStatusVariant(experiment.status)}>
              {experiment.status}
            </Badge>
          </div>
        </DialogHeader>

        <Tabs defaultValue="overview" className="mt-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="config">Configuration</TabsTrigger>
            <TabsTrigger value="metrics">Metrics</TabsTrigger>
            <TabsTrigger value="resources">Resources</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              {/* Basic Info */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium">Experiment Info</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  {experiment.videoFilename && (
                    <div className="flex items-center gap-2">
                      <Video className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Video:</span>
                      <span className="font-medium">{experiment.videoFilename}</span>
                    </div>
                  )}
                  {experiment.modelName && (
                    <div className="flex items-center gap-2">
                      <Box className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Model:</span>
                      <span className="font-medium">{experiment.modelName}</span>
                    </div>
                  )}
                  {experiment.modelArchitecture && (
                    <div className="flex items-center gap-2">
                      <Cpu className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Architecture:</span>
                      <span className="font-medium">{experiment.modelArchitecture}</span>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Timeline */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium">Timeline</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Started:</span>
                    <span className="font-medium">{formatDate(experiment.startedAt)}</span>
                  </div>
                  {experiment.completedAt && (
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Completed:</span>
                      <span className="font-medium">{formatDate(experiment.completedAt)}</span>
                    </div>
                  )}
                  {experiment.gpuHours !== undefined && (
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">GPU Hours:</span>
                      <span className="font-medium">{experiment.gpuHours.toFixed(2)}h</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Configuration Tab */}
          <TabsContent value="config" className="space-y-4">
            {/* Preprocessing Steps */}
            {experiment.preprocessingSteps && experiment.preprocessingSteps.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium">Preprocessing Pipeline</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {experiment.preprocessingSteps.map((step: any, index: number) => (
                      <div key={index} className="p-3 border rounded-md">
                        <div className="font-medium text-sm">{step.operation || step.name}</div>
                        <pre className="mt-2 text-xs bg-muted p-2 rounded overflow-x-auto">
                          {JSON.stringify(step, null, 2)}
                        </pre>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Hyperparameters */}
            {experiment.hyperparameters && Object.keys(experiment.hyperparameters).length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium">Hyperparameters</CardTitle>
                </CardHeader>
                <CardContent>
                  <pre className="text-xs bg-muted p-4 rounded overflow-x-auto">
                    {JSON.stringify(experiment.hyperparameters, null, 2)}
                  </pre>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Metrics Tab */}
          <TabsContent value="metrics" className="space-y-4">
            {experiment.metrics && Object.keys(experiment.metrics).length > 0 ? (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium">Performance Metrics</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-2">
                    {Object.entries(experiment.metrics).map(([key, value]) => (
                      <div key={key} className="p-3 border rounded-md">
                        <div className="text-xs text-muted-foreground uppercase">{key}</div>
                        <div className="text-2xl font-bold mt-1">
                          {typeof value === 'number'
                            ? value < 1 && value > 0
                              ? `${(value * 100).toFixed(2)}%`
                              : value.toFixed(4)
                            : value}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  No metrics available for this experiment
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Resources Tab */}
          <TabsContent value="resources" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Compute Resources</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {experiment.gpuType && (
                  <div>
                    <div className="text-xs text-muted-foreground">GPU Type</div>
                    <div className="text-lg font-medium">{experiment.gpuType}</div>
                  </div>
                )}
                {experiment.gpuHours !== undefined && (
                  <div>
                    <div className="text-xs text-muted-foreground">GPU Hours</div>
                    <div className="text-lg font-medium">{experiment.gpuHours.toFixed(2)} hours</div>
                  </div>
                )}
                {experiment.computeCostUsd !== undefined && (
                  <div>
                    <div className="text-xs text-muted-foreground">Compute Cost</div>
                    <div className="text-lg font-medium">${experiment.computeCostUsd.toFixed(2)} USD</div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}

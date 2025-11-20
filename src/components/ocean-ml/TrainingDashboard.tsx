'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Loader2, GraduationCap } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'

const API_URL = '/api/ocean-ml'

interface TrainingRun {
  id: string
  model_type: string
  epochs: number
  status: string
  started_at: string
  completed_at?: string
  current_epoch: number
  map50?: number
  map50_95?: number
  final_loss?: number
  training_time_seconds?: number
  cost_usd?: number
}

export default function TrainingDashboard() {
  // Fetch training runs
  const { data: trainingRuns, isLoading } = useQuery<TrainingRun[]>({
    queryKey: ['ocean-ml-training-runs'],
    queryFn: async () => {
      const response = await fetch(`${API_URL}/training/runs`)
      if (!response.ok) throw new Error('Failed to fetch training runs')
      return response.json()
    },
    refetchInterval: 5000, // Refetch every 5 seconds
    refetchOnWindowFocus: false,
  })

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'completed':
        return 'default'
      case 'training':
        return 'secondary'
      case 'failed':
        return 'destructive'
      default:
        return 'outline'
    }
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <div className="text-center space-y-4">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
            <p className="text-muted-foreground">Loading training runs...</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  const completedModels = trainingRuns?.filter(run => run.status === 'completed') || []
  const activeRuns = trainingRuns?.filter(run => run.status !== 'completed') || []

  return (
    <div className="space-y-6">
      {/* Completed Models Section */}
      {completedModels.length > 0 && (
        <div>
          <h2 className="text-2xl font-bold mb-4">Trained Models</h2>
          <div className="grid md:grid-cols-2 gap-4">
            {completedModels.map((model) => (
              <Card key={model.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">
                        {model.model_type.toUpperCase()}
                      </CardTitle>
                      <CardDescription>
                        {model.epochs} epochs
                      </CardDescription>
                    </div>
                    <Badge variant={getStatusVariant(model.status)}>
                      {model.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  {model.map50 && (
                    <div className="text-sm">
                      <span className="text-muted-foreground">mAP50:</span>{' '}
                      <span className="font-medium">{(model.map50 * 100).toFixed(1)}%</span>
                    </div>
                  )}
                  {model.training_time_seconds && (
                    <div className="text-sm">
                      <span className="text-muted-foreground">Training time:</span>{' '}
                      <span className="font-medium">{Math.round(model.training_time_seconds / 60)}m</span>
                    </div>
                  )}
                  {model.cost_usd && (
                    <div className="text-sm">
                      <span className="text-muted-foreground">Cost:</span>{' '}
                      <span className="font-medium">${model.cost_usd.toFixed(2)}</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Active Training Runs */}
      {activeRuns.length > 0 && (
        <div>
          <h2 className="text-2xl font-bold mb-4">Active Training</h2>
          <div className="space-y-4">
            {activeRuns.map((run) => (
              <Card key={run.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">
                        {run.model_type.toUpperCase()} - {run.epochs} epochs
                      </CardTitle>
                      <CardDescription>
                        Started: {new Date(run.started_at).toLocaleString()}
                      </CardDescription>
                    </div>
                    <Badge variant={getStatusVariant(run.status)}>
                      {run.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Epoch {run.current_epoch} / {run.epochs}</span>
                      <span>{Math.round((run.current_epoch / run.epochs) * 100)}%</span>
                    </div>
                    <Progress value={(run.current_epoch / run.epochs) * 100} />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {(!trainingRuns || trainingRuns.length === 0) && (
        <Card>
          <CardContent className="py-12">
            <div className="text-center space-y-4">
              <GraduationCap className="h-16 w-16 mx-auto text-muted-foreground opacity-50" />
              <div>
                <h2 className="text-xl font-semibold mb-2">No training runs yet</h2>
                <p className="text-muted-foreground">
                  Start your first training run to see it here
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

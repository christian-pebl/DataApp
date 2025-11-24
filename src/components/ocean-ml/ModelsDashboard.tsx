'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Loader2, Box } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'

const API_URL = '/api/cv-models'

interface CVModel {
  id: string
  name: string
  version: string
  architecture: string
  task: string
  status: 'experimental' | 'validated' | 'production' | 'deprecated'
  performanceMetrics?: {
    map50?: number
    map50_95?: number
    [key: string]: any
  }
  weightsPath: string
  createdAt: string
  updatedAt: string
}

export default function ModelsDashboard() {
  // Fetch models
  const { data: modelsResponse, isLoading } = useQuery<{ models: CVModel[] }>({
    queryKey: ['cv-models'],
    queryFn: async () => {
      const response = await fetch(API_URL)
      if (!response.ok) throw new Error('Failed to fetch models')
      return response.json()
    },
    refetchInterval: 10000, // Refetch every 10 seconds
    refetchOnWindowFocus: false,
  })

  const models = modelsResponse?.models || []

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'production':
        return 'default'
      case 'validated':
        return 'secondary'
      case 'experimental':
        return 'outline'
      case 'deprecated':
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
            <p className="text-muted-foreground">Loading models...</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  const productionModels = models.filter(m => m.status === 'production')
  const validatedModels = models.filter(m => m.status === 'validated')
  const experimentalModels = models.filter(m => m.status === 'experimental')
  const deprecatedModels = models.filter(m => m.status === 'deprecated')

  return (
    <div className="space-y-6">
      {/* Production Models */}
      {productionModels.length > 0 && (
        <div>
          <h2 className="text-2xl font-bold mb-4">Production Models</h2>
          <div className="grid md:grid-cols-2 gap-4">
            {productionModels.map((model) => (
              <Card key={model.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">
                        {model.name}
                      </CardTitle>
                      <CardDescription>
                        {model.version} • {model.architecture} • {model.task}
                      </CardDescription>
                    </div>
                    <Badge variant={getStatusVariant(model.status)}>
                      {model.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  {model.performanceMetrics?.map50 && (
                    <div className="text-sm">
                      <span className="text-muted-foreground">mAP50:</span>{' '}
                      <span className="font-medium">{(model.performanceMetrics.map50 * 100).toFixed(1)}%</span>
                    </div>
                  )}
                  {model.performanceMetrics?.map50_95 && (
                    <div className="text-sm">
                      <span className="text-muted-foreground">mAP50-95:</span>{' '}
                      <span className="font-medium">{(model.performanceMetrics.map50_95 * 100).toFixed(1)}%</span>
                    </div>
                  )}
                  <div className="text-sm">
                    <span className="text-muted-foreground">Updated:</span>{' '}
                    <span className="font-medium">{new Date(model.updatedAt).toLocaleDateString()}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Validated Models */}
      {validatedModels.length > 0 && (
        <div>
          <h2 className="text-2xl font-bold mb-4">Validated Models</h2>
          <div className="grid md:grid-cols-2 gap-4">
            {validatedModels.map((model) => (
              <Card key={model.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">
                        {model.name}
                      </CardTitle>
                      <CardDescription>
                        {model.version} • {model.architecture} • {model.task}
                      </CardDescription>
                    </div>
                    <Badge variant={getStatusVariant(model.status)}>
                      {model.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  {model.performanceMetrics?.map50 && (
                    <div className="text-sm">
                      <span className="text-muted-foreground">mAP50:</span>{' '}
                      <span className="font-medium">{(model.performanceMetrics.map50 * 100).toFixed(1)}%</span>
                    </div>
                  )}
                  <div className="text-sm">
                    <span className="text-muted-foreground">Updated:</span>{' '}
                    <span className="font-medium">{new Date(model.updatedAt).toLocaleDateString()}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Experimental Models */}
      {experimentalModels.length > 0 && (
        <div>
          <h2 className="text-2xl font-bold mb-4">Experimental Models</h2>
          <div className="grid md:grid-cols-2 gap-4">
            {experimentalModels.map((model) => (
              <Card key={model.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">
                        {model.name}
                      </CardTitle>
                      <CardDescription>
                        {model.version} • {model.architecture} • {model.task}
                      </CardDescription>
                    </div>
                    <Badge variant={getStatusVariant(model.status)}>
                      {model.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  {model.performanceMetrics?.map50 && (
                    <div className="text-sm">
                      <span className="text-muted-foreground">mAP50:</span>{' '}
                      <span className="font-medium">{(model.performanceMetrics.map50 * 100).toFixed(1)}%</span>
                    </div>
                  )}
                  <div className="text-sm">
                    <span className="text-muted-foreground">Updated:</span>{' '}
                    <span className="font-medium">{new Date(model.updatedAt).toLocaleDateString()}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {models.length === 0 && (
        <Card>
          <CardContent className="py-12">
            <div className="text-center space-y-4">
              <Box className="h-16 w-16 mx-auto text-muted-foreground opacity-50" />
              <div>
                <h2 className="text-xl font-semibold mb-2">No models registered yet</h2>
                <p className="text-muted-foreground">
                  Train and register your first model to see it here
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, FlaskConical, DollarSign, TrendingUp, CheckCircle2 } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'

interface ExperimentStats {
  total: number
  completed: number
  running: number
  failed: number
  totalCost: number
  avgMap50: number | null
  bestMap50: number | null
}

export default function QuickStats() {
  const { data: statsResponse, isLoading } = useQuery<{ stats: ExperimentStats }>({
    queryKey: ['cv-experiments-stats'],
    queryFn: async () => {
      const response = await fetch('/api/cv-experiments?stats=true')
      if (!response.ok) throw new Error('Failed to fetch stats')
      return response.json()
    },
    refetchInterval: 10000,
  })

  const stats = statsResponse?.stats

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Loading...</CardTitle>
            </CardHeader>
            <CardContent>
              <Loader2 className="h-4 w-4 animate-spin" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  return (
    <div className="grid gap-4 md:grid-cols-4">
      {/* Total Experiments */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Experiments</CardTitle>
          <FlaskConical className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats?.total || 0}</div>
          <p className="text-xs text-muted-foreground">
            {stats?.running || 0} running, {stats?.completed || 0} completed
          </p>
        </CardContent>
      </Card>

      {/* Total Cost */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Cost</CardTitle>
          <DollarSign className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">${(stats?.totalCost || 0).toFixed(2)}</div>
          <p className="text-xs text-muted-foreground">
            GPU compute costs
          </p>
        </CardContent>
      </Card>

      {/* Average mAP50 */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Avg mAP50</CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {stats?.avgMap50 ? `${(stats.avgMap50 * 100).toFixed(1)}%` : 'N/A'}
          </div>
          <p className="text-xs text-muted-foreground">
            Across all completed experiments
          </p>
        </CardContent>
      </Card>

      {/* Best mAP50 */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Best mAP50</CardTitle>
          <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {stats?.bestMap50 ? `${(stats.bestMap50 * 100).toFixed(1)}%` : 'N/A'}
          </div>
          <p className="text-xs text-muted-foreground">
            Top performing model
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

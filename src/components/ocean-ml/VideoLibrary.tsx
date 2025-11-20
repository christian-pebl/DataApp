'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Loader2, RefreshCw, Filter } from 'lucide-react'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import VideoCard from './VideoCard'

const API_URL = '/api/ocean-ml'

interface Video {
  id: string
  filename: string
  storage_path: string
  thumbnail_path?: string
  duration_seconds?: number
  frame_count?: number
  resolution?: string
  fps?: number
  file_size_bytes?: number
  annotated: boolean
  annotated_by?: string
  annotated_at?: string
  detection_count: number
  locked_by?: string
  uploaded_at: string
}

export default function VideoLibrary() {
  const [filter, setFilter] = useState<'all' | 'annotated' | 'unannotated'>('all')

  // Fetch videos
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['ocean-ml-videos', filter],
    queryFn: async () => {
      const url = filter === 'all'
        ? `${API_URL}/videos`
        : `${API_URL}/videos?annotated=${filter === 'annotated'}`

      const response = await fetch(url)
      if (!response.ok) {
        throw new Error('Failed to fetch videos')
      }
      return response.json()
    },
    refetchOnWindowFocus: false,
  })

  const videos: Video[] = data?.videos || []

  return (
    <div className="space-y-6">
      {/* Header with filters */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                Video Library
              </CardTitle>
              <CardDescription>
                {videos.length} videos total
                {filter !== 'all' && ` (filtered)`}
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isLoading}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
            <TabsList className="grid w-full max-w-md grid-cols-3">
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="annotated">Annotated</TabsTrigger>
              <TabsTrigger value="unannotated">Not Annotated</TabsTrigger>
            </TabsList>
          </Tabs>
        </CardContent>
      </Card>

      {/* Loading state */}
      {isLoading && (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <div className="text-center space-y-4">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
              <p className="text-muted-foreground">Loading videos...</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error state */}
      {error && (
        <Card className="border-destructive">
          <CardContent className="py-12">
            <div className="text-center space-y-4">
              <p className="text-destructive font-medium">
                Error loading videos: {(error as Error).message}
              </p>
              <Button onClick={() => refetch()} variant="outline">
                Retry
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty state */}
      {!isLoading && !error && videos.length === 0 && (
        <Card>
          <CardContent className="py-12">
            <div className="text-center space-y-4">
              <p className="text-muted-foreground text-lg">No videos found</p>
              <p className="text-sm text-muted-foreground">
                Upload your first video to get started
              </p>
              <Button>Upload Video</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Video grid */}
      {!isLoading && !error && videos.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {videos.map((video) => (
            <VideoCard key={video.id} video={video} onUpdate={refetch} />
          ))}
        </div>
      )}
    </div>
  )
}

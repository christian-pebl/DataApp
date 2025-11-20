'use client'

import { useState } from 'react'
import { Card, CardContent, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Video, CheckCircle2, Lock, XCircle, Eye, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/hooks/use-toast'

interface VideoProps {
  id: string
  filename: string
  storage_path: string
  thumbnail_path?: string
  duration_seconds?: number
  annotated: boolean
  annotated_by?: string
  annotated_at?: string
  detection_count: number
  locked_by?: string
  uploaded_at: string
  file_size_bytes?: number
}

interface VideoCardProps {
  video: VideoProps
  onUpdate: () => void
}

export default function VideoCard({ video, onUpdate }: VideoCardProps) {
  const [isAnnotating, setIsAnnotating] = useState(false)
  const { toast } = useToast()
  const supabase = createClient()

  const handleAnnotate = async () => {
    setIsAnnotating(true)

    try {
      // Get auth token
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        throw new Error('Not authenticated')
      }

      // Call backend to acquire lock
      const response = await fetch(`/api/ocean-ml/annotations/annotate/${video.id}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ timeout_minutes: 60 })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Failed to start annotation')
      }

      if (!data.success) {
        // Video is locked by someone else
        toast({
          variant: "destructive",
          title: "Video Locked",
          description: data.message
        })
        setIsAnnotating(false)
        return
      }

      // Open desktop app via protocol handler
      const protocol = process.env.NEXT_PUBLIC_OCEANML_PROTOCOL || 'oceanml'
      const url = `${protocol}://annotate?video=${video.id}&token=${session.access_token}`

      // Try to open the protocol URL
      window.location.href = url

      toast({
        title: "Launching Desktop App",
        description: "Desktop app should launch now. If not, please install it first."
      })

      // Poll for completion
      setTimeout(() => {
        onUpdate()
        setIsAnnotating(false)
      }, 5000)

    } catch (err) {
      toast({
        variant: "destructive",
        title: "Error",
        description: (err as Error).message
      })
      setIsAnnotating(false)
    }
  }

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return 'Unknown'
    const mb = bytes / (1024 * 1024)
    return `${mb.toFixed(1)} MB`
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString()
  }

  return (
    <Card>
      <CardContent className="p-0">
        {/* Thumbnail placeholder */}
        <div className="w-full h-40 bg-muted rounded-t-lg flex items-center justify-center">
          <Video className="w-16 h-16 text-muted-foreground" />
        </div>

        <div className="p-4 space-y-3">
          {/* Video info */}
          <h3 className="font-medium truncate" title={video.filename}>
            {video.filename}
          </h3>

          <div className="text-sm text-muted-foreground space-y-1">
            <p>Size: {formatFileSize(video.file_size_bytes)}</p>
            {video.duration_seconds && (
              <p>Duration: {video.duration_seconds}s</p>
            )}
            <p>Uploaded: {formatDate(video.uploaded_at)}</p>
          </div>

          {/* Status Badge */}
          <div>
            {video.annotated ? (
              <Badge variant="default" className="bg-green-600">
                <CheckCircle2 className="w-4 h-4 mr-1" />
                Annotated ({video.detection_count})
              </Badge>
            ) : video.locked_by ? (
              <Badge variant="secondary">
                <Lock className="w-4 h-4 mr-1" />
                Being annotated...
              </Badge>
            ) : (
              <Badge variant="outline">
                <XCircle className="w-4 h-4 mr-1" />
                Not annotated
              </Badge>
            )}
          </div>
        </div>
      </CardContent>

      <CardFooter className="p-4 pt-0 flex gap-2">
        <Button
          onClick={handleAnnotate}
          disabled={isAnnotating || !!video.locked_by}
          className="flex-1"
        >
          {isAnnotating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          {isAnnotating ? 'Starting...' : video.locked_by ? 'Locked' : 'Annotate'}
        </Button>

        {video.annotated && (
          <Button
            variant="outline"
            size="icon"
            title="View annotations"
          >
            <Eye className="w-4 h-4" />
          </Button>
        )}
      </CardFooter>
    </Card>
  )
}

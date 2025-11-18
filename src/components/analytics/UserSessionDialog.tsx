'use client'

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Clock, FileText, Activity, Eye, TrendingUp, MousePointerClick, FolderOpen, BarChart3, Settings } from 'lucide-react'
import { UserSessionDetails } from '@/lib/analytics/analytics-data-service'

interface UserSessionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  sessionDetails: UserSessionDetails | null
}

export function UserSessionDialog({ open, onOpenChange, sessionDetails }: UserSessionDialogProps) {
  if (!sessionDetails) return null

  const { user, recentSessions, pageViews, filesViewed, featuresUsed, totalEvents } = sessionDetails

  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`
    } else {
      return `${seconds}s`
    }
  }

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  // Get icon for event type
  const getEventIcon = (eventType: string) => {
    if (eventType.includes('click') || eventType.includes('button')) return <MousePointerClick className="h-4 w-4" />
    if (eventType.includes('file') || eventType.includes('upload')) return <FileText className="h-4 w-4" />
    if (eventType.includes('chart') || eventType.includes('plot')) return <BarChart3 className="h-4 w-4" />
    if (eventType.includes('project')) return <FolderOpen className="h-4 w-4" />
    if (eventType.includes('page')) return <Eye className="h-4 w-4" />
    if (eventType.includes('settings') || eventType.includes('option')) return <Settings className="h-4 w-4" />
    return <Activity className="h-4 w-4" />
  }

  // Format event data into readable description
  const getEventDescription = (event: any) => {
    const data = event.event_data || {}
    const parts: string[] = []

    // Project info
    if (data.project_name) parts.push(`Project: ${data.project_name}`)
    if (data.project_id && !data.project_name) parts.push(`Project ID: ${data.project_id}`)

    // File info
    if (data.file_name) parts.push(`File: ${data.file_name}`)
    if (data.file_type) parts.push(`Type: ${data.file_type}`)

    // Chart/visualization info
    if (data.chart_type) parts.push(`Chart: ${data.chart_type}`)
    if (data.parameter) parts.push(`Parameter: ${data.parameter}`)
    if (data.plot_type) parts.push(`Plot: ${data.plot_type}`)

    // Pin/line/area info
    if (data.pin_name) parts.push(`Pin: ${data.pin_name}`)
    if (data.line_name) parts.push(`Line: ${data.line_name}`)
    if (data.area_name) parts.push(`Area: ${data.area_name}`)
    if (data.label) parts.push(`Label: ${data.label}`)

    // Settings/options
    if (data.setting_name) parts.push(`Setting: ${data.setting_name}`)
    if (data.option_selected) parts.push(`Option: ${data.option_selected}`)
    if (data.feature_name) parts.push(`Feature: ${data.feature_name}`)

    // Button clicks
    if (data.button_name) parts.push(`Button: ${data.button_name}`)
    if (data.action) parts.push(`Action: ${data.action}`)

    // Dialog/modal
    if (data.dialog_name) parts.push(`Dialog: ${data.dialog_name}`)

    // Date range
    if (data.date_range) parts.push(`Date Range: ${data.date_range}`)
    if (data.start_date && data.end_date) parts.push(`${data.start_date} to ${data.end_date}`)

    return parts.length > 0 ? parts.join(' • ') : 'No additional details'
  }

  // Get human-readable event type name
  const formatEventType = (eventType: string) => {
    return eventType
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="text-2xl flex items-center gap-2">
            <Activity className="h-6 w-6" />
            User Session Details
          </DialogTitle>
          <DialogDescription>
            Detailed activity log for <span className="font-semibold">{user.email}</span>
          </DialogDescription>
        </DialogHeader>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 my-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Events</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalEvents}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Sessions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{recentSessions.length}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Pages Viewed</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{pageViews.length}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Files Viewed</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{filesViewed.length}</div>
            </CardContent>
          </Card>
        </div>

        {/* Detailed Tabs */}
        <Tabs defaultValue="timeline" className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="timeline">
              <Activity className="h-4 w-4 mr-2" />
              Timeline
            </TabsTrigger>
            <TabsTrigger value="sessions">
              <Clock className="h-4 w-4 mr-2" />
              Sessions
            </TabsTrigger>
            <TabsTrigger value="pages">
              <Eye className="h-4 w-4 mr-2" />
              Pages
            </TabsTrigger>
            <TabsTrigger value="files">
              <FileText className="h-4 w-4 mr-2" />
              Files
            </TabsTrigger>
            <TabsTrigger value="features">
              <TrendingUp className="h-4 w-4 mr-2" />
              Features
            </TabsTrigger>
          </TabsList>

          {/* Activity Timeline Tab - All events chronologically */}
          <TabsContent value="timeline" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Complete Activity Timeline</CardTitle>
                <CardDescription>
                  Every action taken by this user in chronological order (last {totalEvents} events)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[500px] pr-4">
                  <div className="space-y-2">
                    {recentSessions.flatMap(session => session.events)
                      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                      .map((event, i) => (
                        <div key={event.id} className="border-l-2 border-primary/30 pl-3 py-2 hover:bg-muted/30 transition-colors">
                          <div className="flex items-start gap-2">
                            <div className="mt-0.5 text-primary">
                              {getEventIcon(event.event_type)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-sm font-semibold">{formatEventType(event.event_type)}</span>
                                {event.duration_ms && (
                                  <Badge variant="outline" className="text-xs">
                                    {formatDuration(event.duration_ms)}
                                  </Badge>
                                )}
                                <span className="text-xs text-muted-foreground ml-auto whitespace-nowrap">
                                  {formatTimestamp(event.timestamp)}
                                </span>
                              </div>
                              <p className="text-xs text-muted-foreground leading-relaxed">
                                {getEventDescription(event)}
                              </p>
                              {event.page_path && (
                                <p className="text-xs text-muted-foreground/70 mt-1">
                                  <Eye className="h-3 w-3 inline mr-1" />
                                  {event.page_path}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Sessions Tab */}
          <TabsContent value="sessions" className="mt-4">
            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-4">
                {recentSessions.map((session, idx) => (
                  <Card key={session.session_id} className="border-l-4 border-l-primary">
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="text-base">Session {idx + 1}</CardTitle>
                          <CardDescription className="text-xs">
                            {formatTimestamp(session.start_time)}
                            {session.end_time && ` - ${formatTimestamp(session.end_time)}`}
                          </CardDescription>
                        </div>
                        <Badge variant="outline">
                          <Clock className="h-3 w-3 mr-1" />
                          {formatDuration(session.duration_ms)}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div>
                          <p className="text-sm font-medium mb-1">Pages Visited:</p>
                          <div className="flex flex-wrap gap-1">
                            {session.pages_visited.map((page, i) => (
                              <Badge key={i} variant="secondary" className="text-xs">
                                {page}
                              </Badge>
                            ))}
                          </div>
                        </div>

                        <div>
                          <p className="text-sm font-medium mb-2">Detailed Activity Log ({session.events.length} actions):</p>
                          <div className="space-y-2 max-h-[400px] overflow-y-auto">
                            {session.events.map((event, i) => (
                              <div key={event.id} className="border-l-2 border-primary/30 pl-3 py-2 hover:bg-muted/30 transition-colors">
                                <div className="flex items-start gap-2">
                                  <div className="mt-0.5 text-primary">
                                    {getEventIcon(event.event_type)}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                      <span className="text-sm font-semibold">{formatEventType(event.event_type)}</span>
                                      {event.duration_ms && (
                                        <Badge variant="outline" className="text-xs">
                                          {formatDuration(event.duration_ms)}
                                        </Badge>
                                      )}
                                      <span className="text-xs text-muted-foreground ml-auto whitespace-nowrap">
                                        {formatTimestamp(event.timestamp)}
                                      </span>
                                    </div>
                                    <p className="text-xs text-muted-foreground leading-relaxed">
                                      {getEventDescription(event)}
                                    </p>
                                    {event.page_path && (
                                      <p className="text-xs text-muted-foreground/70 mt-1">
                                        <Eye className="h-3 w-3 inline mr-1" />
                                        {event.page_path}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}

                {recentSessions.length === 0 && (
                  <Card>
                    <CardContent className="py-8">
                      <p className="text-center text-muted-foreground">No recent sessions found</p>
                    </CardContent>
                  </Card>
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          {/* Pages Tab */}
          <TabsContent value="pages" className="mt-4">
            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-2">
                {pageViews.map((page, idx) => (
                  <Card key={idx}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <p className="font-mono text-sm font-medium">{page.page}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {page.count} {page.count === 1 ? 'visit' : 'visits'}
                            {page.avg_duration_ms > 0 && (
                              <> • Avg: {formatDuration(page.avg_duration_ms)}</>
                            )}
                          </p>
                        </div>
                        <Badge variant="outline">{page.count}</Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}

                {pageViews.length === 0 && (
                  <Card>
                    <CardContent className="py-8">
                      <p className="text-center text-muted-foreground">No page views recorded</p>
                    </CardContent>
                  </Card>
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          {/* Files Tab */}
          <TabsContent value="files" className="mt-4">
            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-2">
                {filesViewed.map((file, idx) => (
                  <Card key={idx}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-muted-foreground" />
                            <p className="text-sm font-medium">{file.file_name}</p>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            Viewed {file.count} {file.count === 1 ? 'time' : 'times'}
                            {file.total_duration_ms > 0 && (
                              <> • Total time: {formatDuration(file.total_duration_ms)}</>
                            )}
                          </p>
                        </div>
                        <Badge variant="outline">{file.count}</Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}

                {filesViewed.length === 0 && (
                  <Card>
                    <CardContent className="py-8">
                      <p className="text-center text-muted-foreground">No files viewed</p>
                    </CardContent>
                  </Card>
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          {/* Features Tab */}
          <TabsContent value="features" className="mt-4">
            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-2">
                {featuresUsed.map((feature, idx) => (
                  <Card key={idx}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <Activity className="h-4 w-4 text-muted-foreground" />
                            <p className="text-sm font-medium">{feature.feature}</p>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            Used {feature.count} {feature.count === 1 ? 'time' : 'times'}
                          </p>
                        </div>
                        <Badge variant="outline">{feature.count}</Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}

                {featuresUsed.length === 0 && (
                  <Card>
                    <CardContent className="py-8">
                      <p className="text-center text-muted-foreground">No feature usage recorded</p>
                    </CardContent>
                  </Card>
                )}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}

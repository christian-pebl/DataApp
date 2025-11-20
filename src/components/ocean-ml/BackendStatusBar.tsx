'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { CheckCircle2, XCircle, Loader2, Play, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'

export default function BackendStatusBar() {
  const [status, setStatus] = useState<'checking' | 'online' | 'offline'>('checking')
  const [isStarting, setIsStarting] = useState(false)
  const [startupLogs, setStartupLogs] = useState<Array<{ time: string; message: string; type: 'info' | 'success' | 'error' }>>([])
  const [showLogs, setShowLogs] = useState(false)
  const { toast } = useToast()
  const backendUrl = process.env.NEXT_PUBLIC_OCEAN_ML_BACKEND_URL || 'http://localhost:8001'

  const addLog = (message: string, type: 'info' | 'success' | 'error' = 'info') => {
    const time = new Date().toLocaleTimeString()
    setStartupLogs(prev => [...prev, { time, message, type }])
  }

  const checkBackendHealth = async () => {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 3000) // 3 second timeout

      const response = await fetch(`${backendUrl}/health`, {
        signal: controller.signal,
        cache: 'no-store'
      })

      clearTimeout(timeoutId)

      if (response.ok) {
        setStatus('online')
      } else {
        setStatus('offline')
      }
    } catch (error) {
      setStatus('offline')
    }
  }

  const startBackend = async () => {
    setIsStarting(true)
    setStartupLogs([]) // Clear previous logs
    setShowLogs(true) // Auto-expand logs

    addLog('Initiating backend startup...', 'info')

    try {
      addLog('Sending start command to server...', 'info')
      const response = await fetch('/api/ocean-ml-control/start', {
        method: 'POST',
      })

      const data = await response.json()

      if (response.ok) {
        if (data.status === 'online') {
          addLog('Backend is already running!', 'success')
          setStatus('online')
          setIsStarting(false)
          return
        }

        addLog(`Backend process started (PID: ${data.pid || 'unknown'})`, 'success')
        addLog('Waiting for backend to initialize...', 'info')

        toast({
          title: 'Backend Starting',
          description: 'Ocean-ML backend is starting up. Check logs below...',
        })

        // Poll for backend health every 2 seconds for up to 30 seconds
        let attempts = 0
        const maxAttempts = 15
        const pollInterval = setInterval(async () => {
          attempts++
          addLog(`Checking backend health (attempt ${attempts}/${maxAttempts})...`, 'info')

          try {
            const controller = new AbortController()
            const timeoutId = setTimeout(() => controller.abort(), 2000)

            const healthResponse = await fetch(`${backendUrl}/health`, {
              signal: controller.signal,
              cache: 'no-store'
            })

            clearTimeout(timeoutId)

            if (healthResponse.ok) {
              addLog('Backend is online and responding!', 'success')
              setStatus('online')
              setIsStarting(false)
              clearInterval(pollInterval)

              toast({
                title: 'Backend Started',
                description: 'Ocean-ML backend is now online and ready.',
              })
            }
          } catch (error) {
            if (attempts >= maxAttempts) {
              addLog('Timeout waiting for backend to respond. It may still be starting up.', 'error')
              setIsStarting(false)
              clearInterval(pollInterval)

              toast({
                variant: 'destructive',
                title: 'Startup Timeout',
                description: 'Backend did not respond in time. Check logs for details.',
              })
            }
          }
        }, 2000)
      } else {
        addLog(`Failed to start backend: ${data.error || 'Unknown error'}`, 'error')
        toast({
          variant: 'destructive',
          title: 'Failed to Start Backend',
          description: data.error || 'Could not start the Ocean-ML backend.',
        })
        setIsStarting(false)
      }
    } catch (error) {
      addLog(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error')
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to communicate with the server.',
      })
      setIsStarting(false)
    }
  }

  // Check health on mount and every 30 seconds
  useEffect(() => {
    checkBackendHealth()
    const interval = setInterval(checkBackendHealth, 30000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="bg-muted/30 border-b">
      <div className="container mx-auto p-4">
        <Alert className={
          status === 'online' ? 'border-green-500/50 bg-green-50/50 dark:bg-green-950/20' :
          status === 'offline' ? 'border-destructive/50 bg-destructive/5' :
          'border-yellow-500/50 bg-yellow-50/50 dark:bg-yellow-950/20'
        }>
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 flex-1">
              {status === 'checking' && (
                <Loader2 className="h-5 w-5 animate-spin text-yellow-600" />
              )}
              {status === 'online' && (
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              )}
              {status === 'offline' && (
                <XCircle className="h-5 w-5 text-destructive" />
              )}

              <AlertDescription className="m-0">
                <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                  <span className="font-semibold">Ocean-ML Backend:</span>
                  <span>
                    {status === 'checking' && 'Checking connection...'}
                    {status === 'online' && (
                      <>
                        <span className="text-green-600 dark:text-green-500">Connected</span>
                        <span className="text-muted-foreground ml-2">({backendUrl})</span>
                      </>
                    )}
                    {status === 'offline' && (
                      <>
                        <span className="text-destructive">Not running</span>
                        <span className="text-muted-foreground ml-2">({backendUrl})</span>
                      </>
                    )}
                  </span>
                </div>
              </AlertDescription>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={checkBackendHealth}
                disabled={status === 'checking'}
              >
                <RefreshCw className={`h-4 w-4 ${status === 'checking' ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline ml-2">Refresh</span>
              </Button>

              {status === 'offline' && (
                <Button
                  size="sm"
                  onClick={startBackend}
                  disabled={isStarting}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {isStarting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="hidden sm:inline ml-2">Starting...</span>
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4" />
                      <span className="hidden sm:inline ml-2">Start Backend</span>
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>

          {/* Collapsible Startup Logs */}
          {startupLogs.length > 0 && (
            <Collapsible open={showLogs} onOpenChange={setShowLogs} className="mt-3">
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="w-full justify-between p-2">
                  <span className="text-sm font-medium">
                    Startup Logs ({startupLogs.length})
                  </span>
                  {showLogs ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-2">
                <div className="bg-background border rounded-md p-3 max-h-60 overflow-y-auto">
                  <div className="space-y-1 font-mono text-xs">
                    {startupLogs.map((log, index) => (
                      <div
                        key={index}
                        className={`flex gap-2 ${
                          log.type === 'success'
                            ? 'text-green-600 dark:text-green-500'
                            : log.type === 'error'
                            ? 'text-destructive'
                            : 'text-muted-foreground'
                        }`}
                      >
                        <span className="opacity-70">[{log.time}]</span>
                        <span className="flex-1">{log.message}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}
        </Alert>
      </div>
    </div>
  )
}

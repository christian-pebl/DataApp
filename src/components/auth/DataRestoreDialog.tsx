'use client'

import { useEffect, useState } from 'react'
import { dataSyncService } from '@/lib/supabase/data-sync-service'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Loader2, Cloud, CheckCircle2, AlertCircle } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'

interface DataRestoreDialogProps {
  isOpen: boolean
  onComplete: () => void
}

export function DataRestoreDialog({ isOpen, onComplete }: DataRestoreDialogProps) {
  const { toast } = useToast()
  const [isRestoring, setIsRestoring] = useState(false)
  const [restoreStatus, setRestoreStatus] = useState<'loading' | 'success' | 'error' | ''>('')
  const [restoreDetails, setRestoreDetails] = useState<any>(null)

  useEffect(() => {
    if (isOpen && !isRestoring) {
      restoreUserData()
    }
  }, [isOpen])

  const restoreUserData = async () => {
    setIsRestoring(true)
    setRestoreStatus('loading')
    
    try {
      console.log('Starting data restoration after login...')
      const result = await dataSyncService.restoreUserData()
      
      setRestoreDetails(result.details)
      
      if (result.success) {
        setRestoreStatus('success')
        toast({
          title: "Data Restored",
          description: `Loaded ${result.details?.pins || 0} pins, ${result.details?.lines || 0} lines, ${result.details?.areas || 0} areas`,
        })
        
        // Auto-close after 2 seconds on success
        setTimeout(() => {
          onComplete()
        }, 2000)
      } else {
        setRestoreStatus('error')
        toast({
          variant: "destructive",
          title: "Restoration Error",
          description: result.message,
        })
      }
    } catch (error) {
      console.error('Error restoring data:', error)
      setRestoreStatus('error')
      toast({
        variant: "destructive",
        title: "Restoration Failed",
        description: "Failed to restore your data. You can continue with local data.",
      })
    } finally {
      setIsRestoring(false)
    }
  }

  const handleRetry = () => {
    setRestoreStatus('')
    restoreUserData()
  }

  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Cloud className="h-5 w-5" />
            Welcome Back!
          </DialogTitle>
          <DialogDescription className="sr-only">
            Data restoration dialog
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 mt-4">
          {restoreStatus === 'loading' && (
            <>
              <p>Restoring your saved pins, lines, and areas...</p>
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
              </div>
              <p className="text-sm text-muted-foreground text-center">
                This may take a few moments...
              </p>
            </>
          )}
          
          {restoreStatus === 'success' && (
            <>
              <div className="flex items-center justify-center py-6">
                <CheckCircle2 className="h-12 w-12 text-green-500" />
              </div>
              <p className="text-center font-medium">Data Restored Successfully!</p>
              {restoreDetails && (
                <div className="bg-muted p-4 rounded-lg space-y-2 text-sm">
                  <p className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    Pins loaded: {restoreDetails.pins || 0}
                  </p>
                  <p className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    Lines loaded: {restoreDetails.lines || 0}
                  </p>
                  <p className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    Areas loaded: {restoreDetails.areas || 0}
                  </p>
                </div>
              )}
            </>
          )}
          
          {restoreStatus === 'error' && (
            <>
              <div className="flex items-center justify-center py-6">
                <AlertCircle className="h-12 w-12 text-destructive" />
              </div>
              <p className="text-center">Failed to restore some data</p>
              <p className="text-sm text-muted-foreground text-center">
                You can continue with your local data or try again.
              </p>
              <div className="flex gap-2 justify-center pt-2">
                <Button onClick={handleRetry} variant="default">
                  Try Again
                </Button>
                <Button onClick={onComplete} variant="outline">
                  Continue
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
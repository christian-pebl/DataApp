import { toast } from '@/hooks/use-toast'

export interface ErrorDetails {
  title: string
  description: string
  variant?: 'default' | 'destructive'
  duration?: number
}

export function getErrorDetails(error: unknown): ErrorDetails {
  if (error instanceof Error) {
    // Network errors
    if (error.message.includes('fetch')) {
      return {
        title: 'Connection Error',
        description: 'Unable to connect to the server. Please check your internet connection.',
        variant: 'destructive',
        duration: 6000
      }
    }
    
    // Authentication errors
    if (error.message.includes('auth') || error.message.includes('unauthorized')) {
      return {
        title: 'Authentication Error',
        description: 'Please log in again to continue.',
        variant: 'destructive',
        duration: 8000
      }
    }
    
    // Validation errors
    if (error.message.includes('validation') || error.message.includes('invalid')) {
      return {
        title: 'Invalid Data',
        description: 'Please check your input and try again.',
        variant: 'destructive',
        duration: 5000
      }
    }
    
    // API errors
    if (error.message.includes('API') || error.message.includes('server')) {
      return {
        title: 'Server Error',
        description: 'The server encountered an error. Please try again in a moment.',
        variant: 'destructive',
        duration: 6000
      }
    }
    
    // Generic error with custom message
    return {
      title: 'Error',
      description: error.message,
      variant: 'destructive',
      duration: 5000
    }
  }
  
  // Unknown error type
  return {
    title: 'Unexpected Error',
    description: 'An unexpected error occurred. Please try again.',
    variant: 'destructive',
    duration: 5000
  }
}

export function showErrorToast(error: unknown, customTitle?: string) {
  const details = getErrorDetails(error)
  
  if (customTitle) {
    details.title = customTitle
  }
  
  return toast(details)
}

export function showSuccessToast(title: string, description?: string, duration = 4000) {
  return toast({
    title,
    description,
    variant: 'default',
    duration
  })
}

export function showWarningToast(title: string, description?: string, duration = 5000) {
  return toast({
    title,
    description,
    variant: 'default',
    duration
  })
}

export function showLoadingToast(title: string, description?: string) {
  return toast({
    title,
    description,
    variant: 'default',
    duration: 30000 // Long duration for loading states
  })
}

// Utility function to handle async operations with toast feedback
export async function withToastFeedback<T>(
  operation: () => Promise<T>,
  {
    loadingTitle = 'Loading...',
    loadingDescription,
    successTitle = 'Success',
    successDescription,
    errorTitle = 'Error',
    onSuccess,
    onError
  }: {
    loadingTitle?: string
    loadingDescription?: string
    successTitle?: string
    successDescription?: string
    errorTitle?: string
    onSuccess?: (result: T) => void
    onError?: (error: unknown) => void
  } = {}
): Promise<T | null> {
  const loadingToast = showLoadingToast(loadingTitle, loadingDescription)
  
  try {
    const result = await operation()
    
    // Dismiss loading toast
    if (loadingToast.dismiss) {
      loadingToast.dismiss()
    }
    
    // Show success toast
    showSuccessToast(successTitle, successDescription)
    
    onSuccess?.(result)
    return result
  } catch (error) {
    // Dismiss loading toast
    if (loadingToast.dismiss) {
      loadingToast.dismiss()
    }
    
    // Show error toast
    showErrorToast(error, errorTitle)
    
    onError?.(error)
    return null
  }
}
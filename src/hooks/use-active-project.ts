import { useState, useEffect, useCallback } from 'react'
import { userPreferencesService } from '@/lib/supabase/user-preferences-service'
import { createClient } from '@/lib/supabase/client'

export function useActiveProject() {
  const [activeProject, setActiveProject] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const supabase = createClient()

  // Load saved active project on mount and auth changes
  useEffect(() => {
    const loadActiveProject = async () => {
      setIsLoading(true)
      try {
        const preferences = await userPreferencesService.getCurrentUserPreferences()
        if (preferences?.active_project_id) {
          setActiveProject(preferences.active_project_id)
        }
      } catch (error) {
        console.error('Error loading active project:', error)
      } finally {
        setIsLoading(false)
      }
    }

    loadActiveProject()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        loadActiveProject()
      } else if (event === 'SIGNED_OUT') {
        setActiveProject(null)
        setIsLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [supabase.auth])

  // Update active project and save to database
  const updateActiveProject = useCallback(async (projectId: string | null) => {
    try {
      const success = await userPreferencesService.updateActiveProject(projectId)
      if (success) {
        setActiveProject(projectId)
        console.log('Active project saved:', projectId)
      } else {
        console.error('Failed to save active project')
      }
      return success
    } catch (error) {
      console.error('Error updating active project:', error)
      return false
    }
  }, [])

  return {
    activeProject,
    setActiveProject: updateActiveProject,
    isLoading
  }
}
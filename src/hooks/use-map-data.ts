import { useState, useEffect, useCallback } from 'react'
import { useToast } from './use-toast'
import { mapDataService } from '@/lib/supabase/map-data-service'
import { Project, Tag, Pin, Line, Area } from '@/lib/supabase/types'
import { createClient } from '@/lib/supabase/client'

export interface UseMapDataProps {
  projectId?: string
  enableSync?: boolean // Whether to sync with database
}

export function useMapData({ projectId = 'default', enableSync = true }: UseMapDataProps = {}) {
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(false)
  const [isOnline, setIsOnline] = useState(typeof window !== 'undefined' && navigator.onLine)
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null)
  
  // Data state
  const [projects, setProjects] = useState<Project[]>([
    { id: 'default', name: 'Default Project', createdAt: new Date() }
  ])
  const [tags, setTags] = useState<Tag[]>([
    { id: 'tag1', name: 'Important', color: '#ef4444', projectId: 'default' },
    { id: 'tag2', name: 'Research', color: '#3b82f6', projectId: 'default' },
    { id: 'tag3', name: 'Planning', color: '#10b981', projectId: 'default' }
  ])
  const [pins, setPins] = useState<Pin[]>([])
  const [lines, setLines] = useState<Line[]>([])
  const [areas, setAreas] = useState<Area[]>([])

  // Check if user is authenticated
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const supabase = createClient()
        const { data: { user }, error } = await supabase.auth.getUser()
        if (error) {
          console.log('Auth check error:', error)
          setIsAuthenticated(false)
        } else {
          console.log('Auth check result:', !!user)
          setIsAuthenticated(!!user)
        }
      } catch (error) {
        console.error('Error checking authentication:', error)
        setIsAuthenticated(false)
      }
    }
    checkAuth()
    
    // Listen for auth changes
    const supabase = createClient()
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('Auth state changed:', event, !!session?.user)
      setIsAuthenticated(!!session?.user)
    })
    
    return () => subscription.unsubscribe()
  }, [])

  // Listen for online/offline status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    if (typeof window !== 'undefined') {
      window.addEventListener('online', handleOnline)
      window.addEventListener('offline', handleOffline)

      return () => {
        window.removeEventListener('online', handleOnline)
        window.removeEventListener('offline', handleOffline)
      }
    }
  }, [])

  // Load data from localStorage
  const loadFromLocalStorage = useCallback(() => {
    if (typeof window === 'undefined') return

    try {
      const storedPins = localStorage.getItem('map-drawing-pins')
      const storedLines = localStorage.getItem('map-drawing-lines')
      const storedAreas = localStorage.getItem('map-drawing-areas')
      
      if (storedPins) setPins(JSON.parse(storedPins))
      if (storedLines) setLines(JSON.parse(storedLines))
      if (storedAreas) setAreas(JSON.parse(storedAreas))
    } catch (error) {
      console.error('Error loading from localStorage:', error)
    }
  }, [])

  // Save to localStorage
  const saveToLocalStorage = useCallback((key: string, data: any) => {
    if (typeof window === 'undefined') return

    try {
      localStorage.setItem(key, JSON.stringify(data))
    } catch (error) {
      console.error('Error saving to localStorage:', error)
    }
  }, [])

  // Load data from database
  const loadFromDatabase = useCallback(async () => {
    if (!enableSync || !isAuthenticated || !isOnline) {
      console.log('Skipping database load:', { enableSync, isAuthenticated, isOnline })
      return
    }

    setIsLoading(true)
    try {
      console.log('Loading data from database...')
      const [projectsData, tagsData, pinsData, linesData, areasData] = await Promise.all([
        mapDataService.getProjects(),
        mapDataService.getTags(projectId === 'default' ? undefined : projectId),
        mapDataService.getPins(projectId === 'default' ? undefined : projectId),
        mapDataService.getLines(projectId === 'default' ? undefined : projectId),
        mapDataService.getAreas(projectId === 'default' ? undefined : projectId)
      ])

      console.log('Database data loaded:', { projectsData, tagsData, pinsData, linesData, areasData })

      // If we have database data, use it; otherwise keep localStorage data
      if (projectsData.length > 0) setProjects(projectsData)
      if (tagsData.length > 0) setTags(tagsData)
      setPins(pinsData)
      setLines(linesData)
      setAreas(areasData)
      
      setLastSyncTime(new Date())
      console.log('Database sync completed successfully')
    } catch (error) {
      console.error('Error loading from database:', error)
      // Don't show error toast if user just isn't authenticated
      if (isAuthenticated) {
        toast({
          variant: "destructive",
          title: "Sync Error",
          description: "Failed to load data from database. Using local data."
        })
      }
    } finally {
      setIsLoading(false)
    }
  }, [enableSync, isAuthenticated, isOnline, projectId, toast])

  // Initial data load
  useEffect(() => {
    loadFromLocalStorage()
    if (enableSync && isAuthenticated) {
      loadFromDatabase()
    }
  }, [loadFromLocalStorage, loadFromDatabase, enableSync, isAuthenticated])

  // Migrate localStorage data to database
  const migrateToDatabase = useCallback(async () => {
    if (!enableSync || !isAuthenticated || !isOnline) return false

    try {
      const localPins = localStorage.getItem('map-drawing-pins')
      const localLines = localStorage.getItem('map-drawing-lines')
      const localAreas = localStorage.getItem('map-drawing-areas')

      if (localPins || localLines || localAreas) {
        await mapDataService.migrateFromLocalStorage({
          pins: localPins ? JSON.parse(localPins) : [],
          lines: localLines ? JSON.parse(localLines) : [],
          areas: localAreas ? JSON.parse(localAreas) : []
        })

        // Clear localStorage after successful migration
        localStorage.removeItem('map-drawing-pins')
        localStorage.removeItem('map-drawing-lines')
        localStorage.removeItem('map-drawing-areas')

        toast({
          title: "Migration Complete",
          description: "Your local data has been migrated to the database."
        })

        // Reload from database
        await loadFromDatabase()
        return true
      }
    } catch (error) {
      console.error('Migration error:', error)
      toast({
        variant: "destructive",
        title: "Migration Failed",
        description: "Failed to migrate local data to database."
      })
    }
    return false
  }, [enableSync, isAuthenticated, isOnline, toast, loadFromDatabase])

  // Pin operations
  const createPin = useCallback(async (pinData: Omit<Pin, 'id'>) => {
    const newPin: Pin = {
      ...pinData,
      id: crypto.randomUUID()
    }

    // Update local state immediately
    const updatedPins = [...pins, newPin]
    setPins(updatedPins)
    saveToLocalStorage('map-drawing-pins', updatedPins)

    // Sync to database if online and authenticated
    if (enableSync && isAuthenticated && isOnline) {
      try {
        await mapDataService.createPin(pinData)
      } catch (error) {
        console.error('Error syncing pin to database:', error)
        toast({
          variant: "destructive",
          title: "Sync Error",
          description: "Pin saved locally but failed to sync to database."
        })
      }
    }

    return newPin
  }, [pins, enableSync, isAuthenticated, isOnline, saveToLocalStorage, toast])

  const updatePin = useCallback(async (id: string, updates: Partial<Omit<Pin, 'id'>>) => {
    // Update local state
    const updatedPins = pins.map(pin => 
      pin.id === id ? { ...pin, ...updates } : pin
    )
    setPins(updatedPins)
    saveToLocalStorage('map-drawing-pins', updatedPins)

    // Sync to database if online and authenticated
    if (enableSync && isAuthenticated && isOnline) {
      try {
        await mapDataService.updatePin(id, updates)
      } catch (error) {
        console.error('Error syncing pin update to database:', error)
        toast({
          variant: "destructive",
          title: "Sync Error",
          description: "Pin updated locally but failed to sync to database."
        })
      }
    }
  }, [pins, enableSync, isAuthenticated, isOnline, saveToLocalStorage, toast])

  const deletePin = useCallback(async (id: string) => {
    // Update local state
    const updatedPins = pins.filter(pin => pin.id !== id)
    setPins(updatedPins)
    saveToLocalStorage('map-drawing-pins', updatedPins)

    // Sync to database if online and authenticated
    if (enableSync && isAuthenticated && isOnline) {
      try {
        await mapDataService.deletePin(id)
      } catch (error) {
        console.error('Error syncing pin deletion to database:', error)
        toast({
          variant: "destructive",
          title: "Sync Error",
          description: "Pin deleted locally but failed to sync to database."
        })
      }
    }
  }, [pins, enableSync, isAuthenticated, isOnline, saveToLocalStorage, toast])

  // Line operations
  const createLine = useCallback(async (lineData: Omit<Line, 'id'>) => {
    const newLine: Line = {
      ...lineData,
      id: crypto.randomUUID()
    }

    const updatedLines = [...lines, newLine]
    setLines(updatedLines)
    saveToLocalStorage('map-drawing-lines', updatedLines)

    if (enableSync && isAuthenticated && isOnline) {
      try {
        console.log('Syncing line to database:', lineData)
        await mapDataService.createLine(lineData)
        console.log('Line synced successfully')
      } catch (error) {
        console.error('Error syncing line to database:', error)
        // Only show toast if user is actually authenticated 
        if (isAuthenticated) {
          toast({
            variant: "destructive",
            title: "Sync Error",  
            description: "Line saved locally but failed to sync to database."
          })
        }
      }
    }

    return newLine
  }, [lines, enableSync, isAuthenticated, isOnline, saveToLocalStorage, toast])

  const updateLine = useCallback(async (id: string, updates: Partial<Omit<Line, 'id'>>) => {
    const updatedLines = lines.map(line => 
      line.id === id ? { ...line, ...updates } : line
    )
    setLines(updatedLines)
    saveToLocalStorage('map-drawing-lines', updatedLines)

    if (enableSync && isAuthenticated && isOnline) {
      try {
        await mapDataService.updateLine(id, updates)
      } catch (error) {
        console.error('Error syncing line update to database:', error)
        toast({
          variant: "destructive",
          title: "Sync Error",
          description: "Line updated locally but failed to sync to database."
        })
      }
    }
  }, [lines, enableSync, isAuthenticated, isOnline, saveToLocalStorage, toast])

  const deleteLine = useCallback(async (id: string) => {
    const updatedLines = lines.filter(line => line.id !== id)
    setLines(updatedLines)
    saveToLocalStorage('map-drawing-lines', updatedLines)

    if (enableSync && isAuthenticated && isOnline) {
      try {
        await mapDataService.deleteLine(id)
      } catch (error) {
        console.error('Error syncing line deletion to database:', error)
        toast({
          variant: "destructive",
          title: "Sync Error",
          description: "Line deleted locally but failed to sync to database."
        })
      }
    }
  }, [lines, enableSync, isAuthenticated, isOnline, saveToLocalStorage, toast])

  // Area operations
  const createArea = useCallback(async (areaData: Omit<Area, 'id'>) => {
    const newArea: Area = {
      ...areaData,
      id: crypto.randomUUID()
    }

    const updatedAreas = [...areas, newArea]
    setAreas(updatedAreas)
    saveToLocalStorage('map-drawing-areas', updatedAreas)

    if (enableSync && isAuthenticated && isOnline) {
      try {
        await mapDataService.createArea(areaData)
      } catch (error) {
        console.error('Error syncing area to database:', error)
        toast({
          variant: "destructive",
          title: "Sync Error",
          description: "Area saved locally but failed to sync to database."
        })
      }
    }

    return newArea
  }, [areas, enableSync, isAuthenticated, isOnline, saveToLocalStorage, toast])

  const updateArea = useCallback(async (id: string, updates: Partial<Omit<Area, 'id'>>) => {
    const updatedAreas = areas.map(area => 
      area.id === id ? { ...area, ...updates } : area
    )
    setAreas(updatedAreas)
    saveToLocalStorage('map-drawing-areas', updatedAreas)

    if (enableSync && isAuthenticated && isOnline) {
      try {
        await mapDataService.updateArea(id, updates)
      } catch (error) {
        console.error('Error syncing area update to database:', error)
        toast({
          variant: "destructive",
          title: "Sync Error",
          description: "Area updated locally but failed to sync to database."
        })
      }
    }
  }, [areas, enableSync, isAuthenticated, isOnline, saveToLocalStorage, toast])

  const deleteArea = useCallback(async (id: string) => {
    const updatedAreas = areas.filter(area => area.id !== id)
    setAreas(updatedAreas)
    saveToLocalStorage('map-drawing-areas', updatedAreas)

    if (enableSync && isAuthenticated && isOnline) {
      try {
        await mapDataService.deleteArea(id)
      } catch (error) {
        console.error('Error syncing area deletion to database:', error)
        toast({
          variant: "destructive",
          title: "Sync Error",
          description: "Area deleted locally but failed to sync to database."
        })
      }
    }
  }, [areas, enableSync, isAuthenticated, isOnline, saveToLocalStorage, toast])

  // Clear all data
  const clearAll = useCallback(async () => {
    setPins([])
    setLines([])
    setAreas([])
    
    saveToLocalStorage('map-drawing-pins', [])
    saveToLocalStorage('map-drawing-lines', [])
    saveToLocalStorage('map-drawing-areas', [])

    if (enableSync && isAuthenticated && isOnline) {
      try {
        // Note: This would need to be implemented in the service
        // For now, we'll just clear local data
        toast({
          title: "Data Cleared",
          description: "All local data has been cleared. Database data remains."
        })
      } catch (error) {
        console.error('Error clearing database:', error)
      }
    } else {
      toast({
        title: "Data Cleared",
        description: "All local data has been cleared."
      })
    }
  }, [enableSync, isAuthenticated, isOnline, saveToLocalStorage, toast])

  // Force sync
  const forceSync = useCallback(async () => {
    if (enableSync && isAuthenticated && isOnline) {
      await loadFromDatabase()
    }
  }, [enableSync, isAuthenticated, isOnline, loadFromDatabase])

  return {
    // Data
    projects,
    tags,
    pins,
    lines,
    areas,
    
    // State
    isLoading,
    isOnline,
    isAuthenticated,
    lastSyncTime,
    
    // Pin operations
    createPin,
    updatePin,
    deletePin,
    
    // Line operations
    createLine,
    updateLine,
    deleteLine,
    
    // Area operations
    createArea,
    updateArea,
    deleteArea,
    
    // Utility operations
    clearAll,
    forceSync,
    migrateToDatabase,
    loadFromDatabase
  }
}
import { createClient } from '@/lib/supabase/client'
import { MapDataService } from './map-data-service'
import { Pin, Line, Area } from '@/types/map'

export class DataSyncService {
  private supabase = createClient()
  private mapDataService = new MapDataService()

  /**
   * Backup all user data before logout
   * This ensures all local changes are persisted to the database
   */
  async backupUserData(): Promise<{
    success: boolean
    message: string
    details?: {
      pins?: number
      lines?: number
      areas?: number
      errors?: string[]
    }
  }> {
    console.log('DataSyncService: Starting comprehensive data backup...')
    
    const errors: string[] = []
    let pinsBackedUp = 0
    let linesBackedUp = 0
    let areasBackedUp = 0

    try {
      // Get current user
      const { data: { user } } = await this.supabase.auth.getUser()
      if (!user) {
        return {
          success: false,
          message: 'No authenticated user found'
        }
      }

      // Get data from localStorage
      const localPinsJson = localStorage.getItem('map-drawing-pins')
      const localLinesJson = localStorage.getItem('map-drawing-lines')
      const localAreasJson = localStorage.getItem('map-drawing-areas')

      // Backup pins
      if (localPinsJson) {
        try {
          const localPins: Pin[] = JSON.parse(localPinsJson)
          console.log(`DataSyncService: Found ${localPins.length} pins in localStorage`)
          
          for (const pin of localPins) {
            try {
              // Check if pin exists in database
              const { data: existingPin } = await this.supabase
                .from('pins')
                .select('id')
                .eq('id', pin.id)
                .eq('user_id', user.id)
                .single()

              if (existingPin) {
                // Update existing pin
                await this.mapDataService.updatePin(pin.id, {
                  lat: pin.lat,
                  lng: pin.lng,
                  label: pin.label,
                  notes: pin.notes,
                  labelVisible: pin.labelVisible,
                  projectId: pin.projectId
                })
              } else {
                // Create new pin with the same ID as local
                // First try to create with the existing ID
                const { error: insertError } = await this.supabase
                  .from('pins')
                  .insert({
                    id: pin.id, // Keep the same ID
                    lat: pin.lat,
                    lng: pin.lng,
                    label: pin.label || 'New Pin',
                    notes: pin.notes || null,
                    label_visible: pin.labelVisible ?? true,
                    project_id: pin.projectId || null,
                    user_id: user.id,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                  })
                
                if (insertError) {
                  // If insert with ID fails (ID conflict), create with new ID
                  console.warn(`Failed to create pin with ID ${pin.id}, creating with new ID:`, insertError)
                  await this.mapDataService.createPin({
                    ...pin,
                    id: undefined // Only generate new ID if original fails
                  })
                }
              }
              pinsBackedUp++
            } catch (error) {
              console.error(`Error backing up pin ${pin.id}:`, error)
              errors.push(`Pin ${pin.label || pin.id}: ${error instanceof Error ? error.message : 'Unknown error'}`)
            }
          }
        } catch (error) {
          console.error('Error parsing pins from localStorage:', error)
          errors.push('Failed to parse pins from localStorage')
        }
      }

      // Backup lines
      if (localLinesJson) {
        try {
          const localLines: Line[] = JSON.parse(localLinesJson)
          console.log(`DataSyncService: Found ${localLines.length} lines in localStorage`)
          
          for (const line of localLines) {
            try {
              // Check if line exists in database
              const { data: existingLine } = await this.supabase
                .from('lines')
                .select('id')
                .eq('id', line.id)
                .eq('user_id', user.id)
                .single()

              if (existingLine) {
                // Update existing line
                await this.mapDataService.updateLine(line.id, {
                  path: line.path,
                  label: line.label,
                  notes: line.notes,
                  labelVisible: line.labelVisible,
                  projectId: line.projectId
                })
              } else {
                // Create new line with the same ID as local
                const { error: insertError } = await this.supabase
                  .from('lines')
                  .insert({
                    id: line.id, // Keep the same ID
                    path: line.path,
                    label: line.label || null,
                    notes: line.notes || null,
                    label_visible: line.labelVisible ?? true,
                    project_id: line.projectId || null,
                    user_id: user.id,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                  })
                
                if (insertError) {
                  // If insert with ID fails (ID conflict), create with new ID
                  console.warn(`Failed to create line with ID ${line.id}, creating with new ID:`, insertError)
                  await this.mapDataService.createLine({
                    ...line,
                    id: undefined // Only generate new ID if original fails
                  })
                }
              }
              linesBackedUp++
            } catch (error) {
              console.error(`Error backing up line ${line.id}:`, error)
              errors.push(`Line ${line.label || line.id}: ${error instanceof Error ? error.message : 'Unknown error'}`)
            }
          }
        } catch (error) {
          console.error('Error parsing lines from localStorage:', error)
          errors.push('Failed to parse lines from localStorage')
        }
      }

      // Backup areas
      if (localAreasJson) {
        try {
          const localAreas: Area[] = JSON.parse(localAreasJson)
          console.log(`DataSyncService: Found ${localAreas.length} areas in localStorage`)
          
          for (const area of localAreas) {
            try {
              // Check if area exists in database
              const { data: existingArea } = await this.supabase
                .from('areas')
                .select('id')
                .eq('id', area.id)
                .eq('user_id', user.id)
                .single()

              if (existingArea) {
                // Update existing area
                await this.mapDataService.updateArea(area.id, {
                  path: area.path,
                  label: area.label,
                  notes: area.notes,
                  labelVisible: area.labelVisible,
                  fillVisible: area.fillVisible,
                  projectId: area.projectId
                })
              } else {
                // Create new area with the same ID as local
                const { error: insertError } = await this.supabase
                  .from('areas')
                  .insert({
                    id: area.id, // Keep the same ID
                    path: area.path,
                    label: area.label || null,
                    notes: area.notes || null,
                    label_visible: area.labelVisible ?? true,
                    fill_visible: area.fillVisible ?? true,
                    project_id: area.projectId || null,
                    user_id: user.id,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                  })
                
                if (insertError) {
                  // If insert with ID fails (ID conflict), create with new ID
                  console.warn(`Failed to create area with ID ${area.id}, creating with new ID:`, insertError)
                  await this.mapDataService.createArea({
                    ...area,
                    id: undefined // Only generate new ID if original fails
                  })
                }
              }
              areasBackedUp++
            } catch (error) {
              console.error(`Error backing up area ${area.id}:`, error)
              errors.push(`Area ${area.label || area.id}: ${error instanceof Error ? error.message : 'Unknown error'}`)
            }
          }
        } catch (error) {
          console.error('Error parsing areas from localStorage:', error)
          errors.push('Failed to parse areas from localStorage')
        }
      }

      // Update user's last sync timestamp (optional - table might not exist)
      try {
        await this.supabase
          .from('user_profiles')
          .upsert({
            id: user.id,
            email: user.email,
            last_sync: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
      } catch (error) {
        // Silently ignore if user_profiles table doesn't exist
        // This is not critical for the backup functionality
      }

      console.log('DataSyncService: Backup completed', {
        pinsBackedUp,
        linesBackedUp,
        areasBackedUp,
        errors: errors.length
      })

      return {
        success: errors.length === 0,
        message: errors.length === 0 
          ? `Successfully backed up all data` 
          : `Backup completed with ${errors.length} errors`,
        details: {
          pins: pinsBackedUp,
          lines: linesBackedUp,
          areas: areasBackedUp,
          errors: errors.length > 0 ? errors : undefined
        }
      }
    } catch (error) {
      console.error('DataSyncService: Fatal error during backup:', error)
      return {
        success: false,
        message: 'Failed to backup data',
        details: {
          errors: [error instanceof Error ? error.message : 'Unknown error']
        }
      }
    }
  }

  /**
   * Restore all user data after login
   * This loads all data from the database and updates localStorage
   */
  async restoreUserData(): Promise<{
    success: boolean
    message: string
    details?: {
      pins?: number
      lines?: number
      areas?: number
      projects?: number
      tags?: number
    }
  }> {
    console.log('DataSyncService: Starting comprehensive data restoration...')
    
    try {
      // Get current user
      const { data: { user } } = await this.supabase.auth.getUser()
      if (!user) {
        return {
          success: false,
          message: 'No authenticated user found'
        }
      }

      // Load all data from database
      const [pins, lines, areas, projects, tags] = await Promise.all([
        this.mapDataService.getPins(),
        this.mapDataService.getLines(),
        this.mapDataService.getAreas(),
        this.mapDataService.getProjects(),
        this.mapDataService.getTags()
      ])

      console.log('DataSyncService: Data loaded from database:', {
        pins: pins.length,
        lines: lines.length,
        areas: areas.length,
        projects: projects.length,
        tags: tags.length
      })

      // DO NOT save to localStorage after restoring from database
      // This was causing duplicate data issues - localStorage should only be used
      // for truly offline/guest users, not authenticated users with database access

      // Update last sync timestamp for reference
      if (typeof window !== 'undefined') {
        localStorage.setItem('map-drawing-last-sync', new Date().toISOString())
      }

      return {
        success: true,
        message: 'Successfully restored all user data',
        details: {
          pins: pins.length,
          lines: lines.length,
          areas: areas.length,
          projects: projects.length,
          tags: tags.length
        }
      }
    } catch (error) {
      console.error('DataSyncService: Error during restoration:', error)
      return {
        success: false,
        message: 'Failed to restore data',
        details: {}
      }
    }
  }

  /**
   * Perform a full sync - backup local changes then restore from database
   * This ensures consistency between local and remote data
   */
  async fullSync(): Promise<{
    success: boolean
    message: string
    backup?: any
    restore?: any
  }> {
    console.log('DataSyncService: Starting full sync...')
    
    // First backup any local changes
    const backupResult = await this.backupUserData()
    
    // Then restore from database to ensure consistency
    const restoreResult = await this.restoreUserData()
    
    return {
      success: backupResult.success && restoreResult.success,
      message: `Sync ${backupResult.success && restoreResult.success ? 'completed' : 'failed'}`,
      backup: backupResult,
      restore: restoreResult
    }
  }
}

// Export singleton instance
export const dataSyncService = new DataSyncService()
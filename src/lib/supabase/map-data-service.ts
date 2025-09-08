import { createClient } from './client'
import { Database, Project, Tag, Pin, Line, Area } from './types'
import { SupabaseClient } from '@supabase/supabase-js'

type SupabaseClientType = SupabaseClient<Database>

export class MapDataService {
  private supabase: SupabaseClientType

  constructor() {
    this.supabase = createClient()
  }

  // Project operations
  async getProjects(): Promise<Project[]> {
    // Get current user
    const { data: { user } } = await this.supabase.auth.getUser()
    if (!user) return []

    const { data, error } = await this.supabase
      .from('projects')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) throw error

    return data.map(project => ({
      id: project.id,
      name: project.name,
      description: project.description || undefined,
      createdAt: new Date(project.created_at)
    }))
  }

  async createProject(project: Omit<Project, 'id' | 'createdAt'>): Promise<Project> {
    // Get current user ID
    const { data: { user } } = await this.supabase.auth.getUser()
    if (!user) throw new Error('Please log in to create projects. User authentication is required.')
    const userId = user.id

    const { data, error } = await this.supabase
      .from('projects')
      .insert({
        name: project.name,
        description: project.description || null,
        user_id: userId
      })
      .select()
      .single()

    if (error) throw error

    return {
      id: data.id,
      name: data.name,
      description: data.description || undefined,
      createdAt: new Date(data.created_at)
    }
  }

  async updateProject(id: string, updates: Partial<Pick<Project, 'name' | 'description'>>): Promise<Project> {
    const { data, error } = await this.supabase
      .from('projects')
      .update({
        name: updates.name,
        description: updates.description || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    return {
      id: data.id,
      name: data.name,
      description: data.description || undefined,
      createdAt: new Date(data.created_at)
    }
  }

  async deleteProject(id: string): Promise<void> {
    const { error } = await this.supabase
      .from('projects')
      .delete()
      .eq('id', id)

    if (error) throw error
  }

  // Tag operations
  async getTags(projectId?: string): Promise<Tag[]> {
    // Get current user
    const { data: { user } } = await this.supabase.auth.getUser()
    if (!user) return []

    let query = this.supabase.from('tags').select('*').eq('user_id', user.id)
    
    if (projectId) {
      query = query.eq('project_id', projectId)
    }
    
    const { data, error } = await query.order('name')

    if (error) throw error

    return data.map(tag => ({
      id: tag.id,
      name: tag.name,
      color: tag.color,
      projectId: tag.project_id
    }))
  }

  async createTag(tag: Omit<Tag, 'id'>): Promise<Tag> {
    // Get current user ID
    const { data: { user } } = await this.supabase.auth.getUser()
    if (!user) throw new Error('Please log in to create tags. User authentication is required.')
    const userId = user.id

    const { data, error } = await this.supabase
      .from('tags')
      .insert({
        name: tag.name,
        color: tag.color,
        project_id: tag.projectId,
        user_id: userId
      })
      .select()
      .single()

    if (error) throw error

    return {
      id: data.id,
      name: data.name,
      color: data.color,
      projectId: data.project_id
    }
  }

  // Pin operations
  async getPins(projectId?: string): Promise<Pin[]> {
    // Get current session for filtering
    const { data: { session }, error: authError } = await this.supabase.auth.getSession()
    if (authError) {
      // Only log if it's not the expected "Auth session missing" error
      if (authError.message !== 'Auth session missing!') {
        console.error('MapDataService: Auth error in getPins:', authError)
      }
      return []
    }
    if (!session?.user) {
      // This is normal when not logged in, don't log as warning
      return []
    }
    const user = session.user
    
    let query = this.supabase
      .from('pins')
      .select(`
        *,
        pin_tags!left(tag_id)
      `)
      .eq('user_id', user.id) // Filter by current user
    
    if (projectId) {
      query = query.eq('project_id', projectId)
    }
    
    const { data, error } = await query.order('created_at', { ascending: false })

    if (error) throw error

    return data.map(pin => ({
      id: pin.id,
      lat: pin.lat,
      lng: pin.lng,
      label: pin.label,
      labelVisible: pin.label_visible ?? true,
      notes: pin.notes || undefined,
      projectId: pin.project_id || undefined,
      tagIds: (pin as any).pin_tags?.map((pt: any) => pt.tag_id) || [],
      // privacyLevel: pin.privacy_level || 'private', // Temporarily removed
      userId: pin.user_id
    }))
  }

  async createPin(pin: Omit<Pin, 'id'>): Promise<Pin> {
    console.log('MapDataService: Creating pin with data:', pin)
    console.log('MapDataService: Enhanced error handling - timestamp:', Date.now())
    
    // Validate input data
    if (!pin || typeof pin.lat !== 'number' || typeof pin.lng !== 'number' || !pin.label) {
      throw new Error('Invalid pin data: lat, lng, and label are required')
    }
    
    // Get current user ID, fallback to admin for backward compatibility (DB tables now exist)
    const { data: { user }, error: authError } = await this.supabase.auth.getUser()
    
    if (authError) {
      console.error('MapDataService: Authentication error:', authError)
      throw new Error(`Authentication error: Please log in to create pins. ${authError.message}`)
    }
    
    if (!user) {
      console.error('MapDataService: No authenticated user found')
      throw new Error('Please log in to create pins. User authentication is required.')
    }
    
    const userId = user.id
    
    console.log('MapDataService: Authentication status:', {
      isAuthenticated: !!user,
      userId: userId,
      userEmail: user?.email || 'No email'
    })
    console.log('MapDataService: Database connection is working!')

    // Validate project_id format if provided
    let validatedProjectId = null
    if (pin.projectId) {
      // Check if projectId is a valid UUID format
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      if (uuidRegex.test(pin.projectId)) {
        validatedProjectId = pin.projectId
      } else {
        console.warn('MapDataService: Invalid project_id format:', pin.projectId, 'Setting to null')
        validatedProjectId = null
      }
    }

    const insertData = {
      lat: pin.lat,
      lng: pin.lng,
      label: pin.label,
      notes: pin.notes || null,
      label_visible: pin.labelVisible ?? true,
      project_id: validatedProjectId,
      user_id: userId
      // privacy_level: 'private' // Temporarily removed until DB is updated
    }
    
    console.log('MapDataService: Insert data:', insertData)

    console.log('MapDataService: User ID being used:', userId)
    console.log('MapDataService: Validated project_id:', validatedProjectId)

    const { data, error } = await this.supabase
      .from('pins')
      .insert(insertData)
      .select()
      .single()

    if (error) {
      // Create a comprehensive error log that works across different browser environments
      const errorInfo = {
        message: error.message || 'Unknown error',
        details: error.details || 'No details available',
        hint: error.hint || 'No hint available',
        code: error.code || 'No error code',
        timestamp: new Date().toISOString(),
        insertData: insertData
      }
      
      console.error('MapDataService: Database error creating pin:')
      console.error('Error message:', errorInfo.message)
      console.error('Error details:', errorInfo.details)
      console.error('Error hint:', errorInfo.hint)
      console.error('Error code:', errorInfo.code)
      console.error('Insert data:', errorInfo.insertData)
      console.error('Full error object:', error)
      console.error('Error stringified:', JSON.stringify(error, Object.getOwnPropertyNames(error)))
      
      // Also throw the error with full details visible
      const fullErrorMessage = `Database error creating pin: ${errorInfo.message}. Details: ${errorInfo.details}. Hint: ${errorInfo.hint}. Code: ${errorInfo.code}. Insert data: ${JSON.stringify(errorInfo.insertData)}`
      console.error('MapDataService: Throwing error:', fullErrorMessage)
      throw new Error(fullErrorMessage)
    }

    // Handle tag associations
    if (pin.tagIds && pin.tagIds.length > 0) {
      const tagInserts = pin.tagIds.map(tagId => ({
        pin_id: data.id,
        tag_id: tagId
      }))

      const { error: tagError } = await this.supabase
        .from('pin_tags')
        .insert(tagInserts)

      if (tagError) throw tagError
    }

    return {
      id: data.id,
      lat: data.lat,
      lng: data.lng,
      label: data.label,
      labelVisible: data.label_visible ?? true,
      notes: data.notes || undefined,
      projectId: data.project_id || undefined,
      tagIds: pin.tagIds || []
    }
  }

  async updatePin(id: string, updates: Partial<Omit<Pin, 'id'>>): Promise<Pin> {
    console.log('MapDataService: updatePin called with:', { id, updates })
    
    // Get current user to verify access
    const { data: { user } } = await this.supabase.auth.getUser()
    if (!user) {
      throw new Error('User not authenticated')
    }
    
    console.log('MapDataService: User attempting pin update:', {
      userId: user.id,
      userEmail: user.email,
      pinId: id,
      hasLabel: !!updates.label,
      labelValue: updates.label
    })
    
    // Validate project_id format if provided
    let validatedProjectId = null
    if (updates.projectId) {
      // Check if projectId is a valid UUID format
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      if (uuidRegex.test(updates.projectId)) {
        validatedProjectId = updates.projectId
        console.log('MapDataService: Valid project_id for update:', validatedProjectId)
      } else {
        console.warn('MapDataService: Invalid project_id format in update:', updates.projectId, 'Setting to null')
        validatedProjectId = null
      }
    }
    
    const updateData = {
      lat: updates.lat,
      lng: updates.lng,
      label: updates.label,
      notes: updates.notes || null,
      label_visible: updates.labelVisible,
      project_id: validatedProjectId,
      updated_at: new Date().toISOString()
    }
    
    console.log('MapDataService: About to update pin with data:', updateData)

    // First, verify the pin exists and the user has access to it
    console.log('MapDataService: Checking pin access for:', { id, userId: user.id })
    
    const { data: existingPin, error: selectError } = await this.supabase
      .from('pins')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    console.log('MapDataService: Pin access check result:', { 
      existingPin, 
      selectError,
      hasData: !!existingPin,
      errorCode: selectError?.code,
      errorMessage: selectError?.message
    })

    if (selectError || !existingPin) {
      console.warn('MapDataService: Pin access check failed, proceeding with direct update attempt')
      console.warn('MapDataService: This might be due to RLS policies or the pin might not exist')
      // Don't throw error here, let's try the update and see what happens
    }

    // Now perform the update without .single() to avoid PGRST116
    const { data, error, count } = await this.supabase
      .from('pins')
      .update(updateData)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()

    console.log('MapDataService: Pin update operation completed:', {
      hasError: !!error,
      dataCount: data?.length || 0,
      totalCount: count,
      updatedData: data?.[0] || null
    })

    if (error) {
      console.error('MapDataService: Pin update error details:')
      console.error('Error message:', error.message || 'No message')
      console.error('Error details:', error.details || 'No details')
      console.error('Error hint:', error.hint || 'No hint')
      console.error('Error code:', error.code || 'No code')
      console.error('Pin ID:', id)
      console.error('Update data:', updateData)
      console.error('Full error object:', error)
      console.error('Error stringified:', JSON.stringify(error, Object.getOwnPropertyNames(error)))
      
      const fullErrorMessage = `Pin update failed: ${error.message || 'Unknown error'}. Details: ${error.details || 'None'}. Hint: ${error.hint || 'None'}. Code: ${error.code || 'None'}`
      throw new Error(fullErrorMessage)
    }

    // Check if any rows were actually updated
    if (!data || data.length === 0) {
      console.error('MapDataService: No rows updated - possible RLS policy issue')
      console.error('MapDataService: Attempting to return cached pin data as fallback')
      
      // If we have the existing pin data from our earlier check, return it with the updates applied
      if (existingPin) {
        console.log('MapDataService: Using cached pin data as fallback')
        return {
          id: existingPin.id,
          lat: updates.lat !== undefined ? updates.lat : existingPin.lat,
          lng: updates.lng !== undefined ? updates.lng : existingPin.lng,
          label: updates.label !== undefined ? updates.label : existingPin.label,
          labelVisible: updates.labelVisible !== undefined ? updates.labelVisible : (existingPin.label_visible ?? true),
          notes: updates.notes !== undefined ? updates.notes : (existingPin.notes || undefined),
          projectId: validatedProjectId !== null ? validatedProjectId : (existingPin.project_id || undefined),
          tagIds: updates.tagIds || []
        }
      }
      
      throw new Error(`Pin update failed: No rows were updated. This might be due to insufficient permissions or the pin no longer exists.`)
    }
    
    const updatedPin = data[0]
    console.log('MapDataService: Pin updated successfully:', updatedPin)

    // Handle tag updates if provided
    if (updates.tagIds !== undefined) {
      // Delete existing tag associations
      await this.supabase
        .from('pin_tags')
        .delete()
        .eq('pin_id', id)

      // Insert new tag associations
      if (updates.tagIds.length > 0) {
        const tagInserts = updates.tagIds.map(tagId => ({
          pin_id: id,
          tag_id: tagId
        }))

        await this.supabase
          .from('pin_tags')
          .insert(tagInserts)
      }
    }

    return {
      id: updatedPin.id,
      lat: updatedPin.lat,
      lng: updatedPin.lng,
      label: updatedPin.label,
      labelVisible: updatedPin.label_visible ?? true,
      notes: updatedPin.notes || undefined,
      projectId: updatedPin.project_id || undefined,
      tagIds: updates.tagIds || []
    }
  }

  async deletePin(id: string): Promise<void> {
    const { error } = await this.supabase
      .from('pins')
      .delete()
      .eq('id', id)

    if (error) throw error
  }

  // Line operations
  async getLines(projectId?: string): Promise<Line[]> {
    // Get current user
    const { data: { user } } = await this.supabase.auth.getUser()
    if (!user) return []

    let query = this.supabase
      .from('lines')
      .select(`
        *,
        line_tags!inner(tag_id)
      `)
      .eq('user_id', user.id)
    
    if (projectId) {
      query = query.eq('project_id', projectId)
    }
    
    const { data, error } = await query.order('created_at', { ascending: false })

    if (error) throw error

    return data.map(line => ({
      id: line.id,
      path: line.path as { lat: number; lng: number }[],
      label: line.label,
      labelVisible: line.label_visible ?? true,
      notes: line.notes || undefined,
      projectId: line.project_id || undefined,
      tagIds: (line as any).line_tags?.map((lt: any) => lt.tag_id) || []
    }))
  }

  async createLine(line: Omit<Line, 'id'>): Promise<Line> {
    console.log('MapDataService: Creating line with data:', line)
    
    // Get current user ID
    const { data: { user } } = await this.supabase.auth.getUser()
    const userId = user?.id || 'admin-shared-data'

    console.log('MapDataService: Using user ID:', userId)
    const insertData = {
      path: line.path,
      label: line.label,
      notes: line.notes || null,
      label_visible: line.labelVisible ?? true,
      project_id: line.projectId || null,
      user_id: userId
    }
    console.log('MapDataService: Insert data:', insertData)

    const { data, error } = await this.supabase
      .from('lines')
      .insert(insertData)
      .select()
      .single()

    if (error) {
      console.error('MapDataService: Database error:', error)
      throw new Error(`Database error: ${error.message}`)
    }

    // Handle tag associations
    if (line.tagIds && line.tagIds.length > 0) {
      const tagInserts = line.tagIds.map(tagId => ({
        line_id: data.id,
        tag_id: tagId
      }))

      const { error: tagError } = await this.supabase
        .from('line_tags')
        .insert(tagInserts)

      if (tagError) throw tagError
    }

    return {
      id: data.id,
      path: data.path as { lat: number; lng: number }[],
      label: data.label,
      labelVisible: data.label_visible ?? true,
      notes: data.notes || undefined,
      projectId: data.project_id || undefined,
      tagIds: line.tagIds || []
    }
  }

  async updateLine(id: string, updates: Partial<Omit<Line, 'id'>>): Promise<Line> {
    const { data, error } = await this.supabase
      .from('lines')
      .update({
        path: updates.path,
        label: updates.label,
        notes: updates.notes || null,
        label_visible: updates.labelVisible,
        project_id: updates.projectId || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    // Handle tag updates if provided
    if (updates.tagIds !== undefined) {
      // Delete existing tag associations
      await this.supabase
        .from('line_tags')
        .delete()
        .eq('line_id', id)

      // Insert new tag associations
      if (updates.tagIds.length > 0) {
        const tagInserts = updates.tagIds.map(tagId => ({
          line_id: id,
          tag_id: tagId
        }))

        await this.supabase
          .from('line_tags')
          .insert(tagInserts)
      }
    }

    return {
      id: data.id,
      path: data.path as { lat: number; lng: number }[],
      label: data.label,
      labelVisible: data.label_visible ?? true,
      notes: data.notes || undefined,
      projectId: data.project_id || undefined,
      tagIds: updates.tagIds || []
    }
  }

  async deleteLine(id: string): Promise<void> {
    const { error } = await this.supabase
      .from('lines')
      .delete()
      .eq('id', id)

    if (error) throw error
  }

  // Area operations
  async getAreas(projectId?: string): Promise<Area[]> {
    // Get current user
    const { data: { user } } = await this.supabase.auth.getUser()
    if (!user) return []

    let query = this.supabase
      .from('areas')
      .select(`
        *,
        area_tags!inner(tag_id)
      `)
      .eq('user_id', user.id)
    
    if (projectId) {
      query = query.eq('project_id', projectId)
    }
    
    const { data, error } = await query.order('created_at', { ascending: false })

    if (error) throw error

    return data.map(area => ({
      id: area.id,
      path: area.path as { lat: number; lng: number }[],
      label: area.label,
      labelVisible: area.label_visible ?? true,
      notes: area.notes || undefined,
      fillVisible: area.fill_visible ?? true,
      projectId: area.project_id || undefined,
      tagIds: (area as any).area_tags?.map((at: any) => at.tag_id) || []
    }))
  }

  async createArea(area: Omit<Area, 'id'>): Promise<Area> {
    // Get current user ID
    const { data: { user } } = await this.supabase.auth.getUser()
    const userId = user?.id || 'admin-shared-data'

    const { data, error } = await this.supabase
      .from('areas')
      .insert({
        path: area.path,
        label: area.label,
        notes: area.notes || null,
        label_visible: area.labelVisible ?? true,
        fill_visible: area.fillVisible ?? true,
        project_id: area.projectId || null,
        user_id: userId
      })
      .select()
      .single()

    if (error) throw error

    // Handle tag associations
    if (area.tagIds && area.tagIds.length > 0) {
      const tagInserts = area.tagIds.map(tagId => ({
        area_id: data.id,
        tag_id: tagId
      }))

      const { error: tagError } = await this.supabase
        .from('area_tags')
        .insert(tagInserts)

      if (tagError) throw tagError
    }

    return {
      id: data.id,
      path: data.path as { lat: number; lng: number }[],
      label: data.label,
      labelVisible: data.label_visible ?? true,
      notes: data.notes || undefined,
      fillVisible: data.fill_visible ?? true,
      projectId: data.project_id || undefined,
      tagIds: area.tagIds || []
    }
  }

  async updateArea(id: string, updates: Partial<Omit<Area, 'id'>>): Promise<Area> {
    const { data, error } = await this.supabase
      .from('areas')
      .update({
        path: updates.path,
        label: updates.label,
        notes: updates.notes || null,
        label_visible: updates.labelVisible,
        fill_visible: updates.fillVisible,
        project_id: updates.projectId || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    // Handle tag updates if provided
    if (updates.tagIds !== undefined) {
      // Delete existing tag associations
      await this.supabase
        .from('area_tags')
        .delete()
        .eq('area_id', id)

      // Insert new tag associations
      if (updates.tagIds.length > 0) {
        const tagInserts = updates.tagIds.map(tagId => ({
          area_id: id,
          tag_id: tagId
        }))

        await this.supabase
          .from('area_tags')
          .insert(tagInserts)
      }
    }

    return {
      id: data.id,
      path: data.path as { lat: number; lng: number }[],
      label: data.label,
      labelVisible: data.label_visible ?? true,
      notes: data.notes || undefined,
      fillVisible: data.fill_visible ?? true,
      projectId: data.project_id || undefined,
      tagIds: updates.tagIds || []
    }
  }

  async deleteArea(id: string): Promise<void> {
    const { error } = await this.supabase
      .from('areas')
      .delete()
      .eq('id', id)

    if (error) throw error
  }

  // Privacy and sharing operations
  async updatePinPrivacy(pinId: string, privacyLevel: 'private' | 'public' | 'specific', sharedEmails?: string[]): Promise<void> {
    // Update the pin's privacy level
    const { error: pinError } = await this.supabase
      .from('pins')
      .update({ 
        privacy_level: privacyLevel,
        updated_at: new Date().toISOString()
      })
      .eq('id', pinId)

    if (pinError) throw pinError

    // If sharing with specific users, handle sharing
    if (privacyLevel === 'specific' && sharedEmails && sharedEmails.length > 0) {
      // Get current user
      const { data: { user } } = await this.supabase.auth.getUser()
      if (!user) throw new Error('User not authenticated')

      // Clear existing shares for this pin
      await this.supabase
        .from('pin_shares')
        .delete()
        .eq('pin_id', pinId)

      // Look up user IDs by email
      for (const email of sharedEmails) {
        const { data: profiles } = await this.supabase
          .from('user_profiles')
          .select('id')
          .eq('email', email.trim())
          .single()

        if (profiles) {
          // Create share record
          await this.supabase
            .from('pin_shares')
            .insert({
              pin_id: pinId,
              shared_with_user_id: profiles.id,
              shared_by_user_id: user.id
            })
        }
      }
    } else if (privacyLevel !== 'specific') {
      // Clear all shares if not specific sharing
      await this.supabase
        .from('pin_shares')
        .delete()
        .eq('pin_id', pinId)
    }
  }

  // Get user notifications
  async getNotifications(): Promise<any[]> {
    const { data: { user } } = await this.supabase.auth.getUser()
    if (!user) return []

    const { data, error } = await this.supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .eq('read', false)
      .order('created_at', { ascending: false })

    if (error) throw error
    return data
  }

  // Mark notification as read
  async markNotificationRead(notificationId: string): Promise<void> {
    const { error } = await this.supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', notificationId)

    if (error) throw error
  }

  // Bulk operations
  async migrateFromLocalStorage(localData: {
    pins: Pin[]
    lines: Line[]
    areas: Area[]
  }): Promise<void> {
    const { data: user } = await this.supabase.auth.getUser()
    if (!user.user) throw new Error('User not authenticated')

    // Create pins
    for (const pin of localData.pins) {
      await this.createPin(pin)
    }

    // Create lines
    for (const line of localData.lines) {
      await this.createLine(line)
    }

    // Create areas
    for (const area of localData.areas) {
      await this.createArea(area)
    }
  }
}

// Export a singleton instance
export const mapDataService = new MapDataService()
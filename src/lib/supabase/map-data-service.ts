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
    const { data, error } = await this.supabase
      .from('projects')
      .select('*')
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
    // Use admin user ID for shared data
    const ADMIN_USER_ID = 'admin-shared-data'

    const { data, error } = await this.supabase
      .from('projects')
      .insert({
        name: project.name,
        description: project.description || null,
        user_id: ADMIN_USER_ID
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
    let query = this.supabase.from('tags').select('*')
    
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
    // Use admin user ID for shared data
    const ADMIN_USER_ID = 'admin-shared-data'

    const { data, error } = await this.supabase
      .from('tags')
      .insert({
        name: tag.name,
        color: tag.color,
        project_id: tag.projectId,
        user_id: ADMIN_USER_ID
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
    let query = this.supabase
      .from('pins')
      .select(`
        *,
        pin_tags!inner(tag_id)
      `)
    
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
      tagIds: (pin as any).pin_tags?.map((pt: any) => pt.tag_id) || []
    }))
  }

  async createPin(pin: Omit<Pin, 'id'>): Promise<Pin> {
    // Use admin user ID for shared data
    const ADMIN_USER_ID = 'admin-shared-data'

    const { data, error } = await this.supabase
      .from('pins')
      .insert({
        lat: pin.lat,
        lng: pin.lng,
        label: pin.label,
        notes: pin.notes || null,
        label_visible: pin.labelVisible ?? true,
        project_id: pin.projectId || null,
        user_id: ADMIN_USER_ID
      })
      .select()
      .single()

    if (error) throw error

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
    const { data, error } = await this.supabase
      .from('pins')
      .update({
        lat: updates.lat,
        lng: updates.lng,
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
      id: data.id,
      lat: data.lat,
      lng: data.lng,
      label: data.label,
      labelVisible: data.label_visible ?? true,
      notes: data.notes || undefined,
      projectId: data.project_id || undefined,
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
    let query = this.supabase
      .from('lines')
      .select(`
        *,
        line_tags!inner(tag_id)
      `)
    
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
    
    // Use admin user ID for shared data
    const ADMIN_USER_ID = 'admin-shared-data'

    console.log('MapDataService: Using admin user ID, inserting line...')
    const insertData = {
      path: line.path,
      label: line.label,
      notes: line.notes || null,
      label_visible: line.labelVisible ?? true,
      project_id: line.projectId || null,
      user_id: ADMIN_USER_ID
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
    let query = this.supabase
      .from('areas')
      .select(`
        *,
        area_tags!inner(tag_id)
      `)
    
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
    // Use admin user ID for shared data
    const ADMIN_USER_ID = 'admin-shared-data'

    const { data, error } = await this.supabase
      .from('areas')
      .insert({
        path: area.path,
        label: area.label,
        notes: area.notes || null,
        label_visible: area.labelVisible ?? true,
        fill_visible: area.fillVisible ?? true,
        project_id: area.projectId || null,
        user_id: ADMIN_USER_ID
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
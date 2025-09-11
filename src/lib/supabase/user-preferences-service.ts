import { createClient } from '@/lib/supabase/client'

export interface UserPreferences {
  id: string
  email: string
  display_name: string | null
  avatar_url: string | null
  active_project_id: string | null
  created_at: string
  updated_at: string
}

export class UserPreferencesService {
  private supabase = createClient()

  async getCurrentUserPreferences(): Promise<UserPreferences | null> {
    try {
      const { data: { user } } = await this.supabase.auth.getUser()
      
      if (!user) {
        return null
      }

      const { data, error } = await this.supabase
        .from('user_profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (error) {
        console.log('User preferences not found, creating default profile')
        return await this.createUserProfile(user)
      }

      return data
    } catch (error) {
      console.error('Error getting user preferences:', error)
      return null
    }
  }

  async updateActiveProject(projectId: string | null): Promise<boolean> {
    try {
      const { data: { user } } = await this.supabase.auth.getUser()
      
      if (!user) {
        console.error('No authenticated user')
        return false
      }

      const { error } = await this.supabase
        .from('user_profiles')
        .update({ 
          active_project_id: projectId,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id)

      if (error) {
        console.error('Error updating active project:', error)
        return false
      }

      return true
    } catch (error) {
      console.error('Error updating active project:', error)
      return false
    }
  }

  private async createUserProfile(user: any): Promise<UserPreferences | null> {
    try {
      const newProfile = {
        id: user.id,
        email: user.email,
        display_name: user.user_metadata?.display_name || user.email?.split('@')[0] || null,
        avatar_url: user.user_metadata?.avatar_url || null,
        active_project_id: null
      }

      const { data, error } = await this.supabase
        .from('user_profiles')
        .insert([newProfile])
        .select()
        .single()

      if (error) {
        console.error('Error creating user profile:', error)
        return null
      }

      return data
    } catch (error) {
      console.error('Error creating user profile:', error)
      return null
    }
  }
}

export const userPreferencesService = new UserPreferencesService()
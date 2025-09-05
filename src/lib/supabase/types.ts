export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      projects: {
        Row: {
          id: string
          name: string
          description: string | null
          user_id: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          user_id: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          user_id?: string
          created_at?: string
          updated_at?: string
        }
      }
      tags: {
        Row: {
          id: string
          name: string
          color: string
          project_id: string
          user_id: string
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          color: string
          project_id: string
          user_id: string
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          color?: string
          project_id?: string
          user_id?: string
          created_at?: string
        }
      }
      pins: {
        Row: {
          id: string
          lat: number
          lng: number
          label: string
          notes: string | null
          label_visible: boolean | null
          project_id: string | null
          user_id: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          lat: number
          lng: number
          label: string
          notes?: string | null
          label_visible?: boolean | null
          project_id?: string | null
          user_id: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          lat?: number
          lng?: number
          label?: string
          notes?: string | null
          label_visible?: boolean | null
          project_id?: string | null
          user_id?: string
          created_at?: string
          updated_at?: string
        }
      }
      lines: {
        Row: {
          id: string
          path: Json
          label: string
          notes: string | null
          label_visible: boolean | null
          project_id: string | null
          user_id: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          path: Json
          label: string
          notes?: string | null
          label_visible?: boolean | null
          project_id?: string | null
          user_id: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          path?: Json
          label?: string
          notes?: string | null
          label_visible?: boolean | null
          project_id?: string | null
          user_id?: string
          created_at?: string
          updated_at?: string
        }
      }
      areas: {
        Row: {
          id: string
          path: Json
          label: string
          notes: string | null
          label_visible: boolean | null
          fill_visible: boolean | null
          project_id: string | null
          user_id: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          path: Json
          label: string
          notes?: string | null
          label_visible?: boolean | null
          fill_visible?: boolean | null
          project_id?: string | null
          user_id: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          path?: Json
          label?: string
          notes?: string | null
          label_visible?: boolean | null
          fill_visible?: boolean | null
          project_id?: string | null
          user_id?: string
          created_at?: string
          updated_at?: string
        }
      }
      pin_tags: {
        Row: {
          pin_id: string
          tag_id: string
        }
        Insert: {
          pin_id: string
          tag_id: string
        }
        Update: {
          pin_id?: string
          tag_id?: string
        }
      }
      line_tags: {
        Row: {
          line_id: string
          tag_id: string
        }
        Insert: {
          line_id: string
          tag_id: string
        }
        Update: {
          line_id?: string
          tag_id?: string
        }
      }
      area_tags: {
        Row: {
          area_id: string
          tag_id: string
        }
        Insert: {
          area_id: string
          tag_id: string
        }
        Update: {
          area_id?: string
          tag_id?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

// Application types
export interface Project {
  id: string
  name: string
  description?: string
  createdAt: Date
}

export interface Tag {
  id: string
  name: string
  color: string
  projectId: string
}

export interface Pin {
  id: string
  lat: number
  lng: number
  label: string
  labelVisible?: boolean
  notes?: string
  projectId?: string
  tagIds?: string[]
  color?: string
  size?: number
  privacyLevel?: 'private' | 'public' | 'specific'
  userId?: string
}

export interface Line {
  id: string
  path: { lat: number; lng: number }[]
  label: string
  labelVisible?: boolean
  notes?: string
  projectId?: string
  tagIds?: string[]
  color?: string
  size?: number
}

export interface Area {
  id: string
  path: { lat: number; lng: number }[]
  label: string
  labelVisible?: boolean
  notes?: string
  fillVisible?: boolean
  projectId?: string
  tagIds?: string[]
  color?: string
  size?: number
}
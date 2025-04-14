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
      users: {
        Row: {
          id: string
          email: string
          created_at: string
          last_opened_project_id: number | null
        }
        Insert: {
          id?: string
          email: string
          created_at?: string
          last_opened_project_id?: number | null
        }
        Update: {
          id?: string
          email?: string
          created_at?: string
          last_opened_project_id?: number | null
        }
      }
      projects: {
        Row: {
          id: number
          user_id: string
          name: string
          start_slogan: string | null
          end_slogan: string | null
          author: string | null
          last_viewed_slide_index: number
          is_locked: boolean
          created_at: string
        }
        Insert: {
          id?: number
          user_id: string
          name: string
          start_slogan?: string | null
          end_slogan?: string | null
          author?: string | null
          last_viewed_slide_index?: number
          is_locked?: boolean
          created_at?: string
        }
        Update: {
          id?: number
          user_id?: string
          name?: string
          start_slogan?: string | null
          end_slogan?: string | null
          author?: string | null
          last_viewed_slide_index?: number
          is_locked?: boolean
          created_at?: string
        }
      }
      notes: {
        Row: {
          id: number
          project_id: number
          parent_id: number | null
          content: string
          url: string | null
          link_text: string | null
          youtube_link: string | null
          time: string | null
          is_discussion: boolean
          images: string[]
          order: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: number
          project_id: number
          parent_id?: number | null
          content: string
          url?: string | null
          link_text?: string | null
          youtube_link?: string | null
          time?: string | null
          is_discussion?: boolean
          images?: string[]
          order?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: number
          project_id?: number
          parent_id?: number | null
          content?: string
          url?: string | null
          link_text?: string | null
          youtube_link?: string | null
          time?: string | null
          is_discussion?: boolean
          images?: string[]
          order?: number
          created_at?: string
          updated_at?: string
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
  }
}
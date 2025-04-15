import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { IStorage } from './storage';
import {
  User,
  InsertUser,
  Project,
  InsertProject,
  UpdateProject,
  ToggleProjectLock,
  Note,
  InsertNote,
  UpdateNote
} from '@shared/schema';
import { getSupabaseClient } from './supabase-storage';
import memorystore from 'memorystore';
import session from 'express-session';
import { Database } from '../types/supabase';

/**
 * SupabaseStorage - A complete implementation of the IStorage interface that uses Supabase
 * for all data storage instead of the local PostgreSQL database.
 * 
 * Uses the Supabase Service Role key to bypass RLS and perform admin operations.
 */
export class SupabaseStorage implements IStorage {
  // Session store (in memory for simplicity, could be replaced with a Supabase-backed store)
  sessionStore: any;
  
  constructor() {
    // Create a memory store for sessions - we could replace this with a DB-backed store
    const MemoryStore = memorystore(session);
    this.sessionStore = new MemoryStore({
      checkPeriod: 86400000 // Clear expired sessions every 24h
    });
    
    console.log('Initialized SupabaseStorage adapter');
  }
  
  // Helper: Convert user from Supabase format to our schema format
  private convertSupabaseUser(data: any): User {
    return {
      id: data.id,
      username: data.email || `user_${data.id.substring(0, 8)}`,
      password: null, // Password not needed when using Supabase Auth
      lastOpenedProjectId: data.last_opened_project_id
    };
  }
  
  // Helper: Convert project from Supabase format to our schema format
  private convertSupabaseProject(data: any): Project {
    return {
      id: data.id,
      userId: data.user_id,
      name: data.name,
      startSlogan: data.start_slogan,
      endSlogan: data.end_slogan,
      author: data.author,
      lastViewedSlideIndex: data.last_viewed_slide_index,
      isLocked: data.is_locked,
      createdAt: new Date(data.created_at)
    };
  }
  
  // Helper: Convert note from Supabase format to our schema format
  private convertSupabaseNote(data: any): Note {
    return {
      id: data.id,
      projectId: data.project_id,
      parentId: data.parent_id,
      content: data.content,
      url: data.url,
      linkText: data.link_text,
      youtubeLink: data.youtube_link,
      time: data.time,
      isDiscussion: data.is_discussion,
      images: data.images || [],
      order: data.order.toString(), // Convert to string as our schema expects
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at)
    };
  }
  
  // Helper: Convert our schema note to Supabase format
  private convertToSupabaseNote(note: InsertNote): any {
    return {
      project_id: note.projectId,
      parent_id: note.parentId,
      content: note.content,
      url: note.url,
      link_text: note.linkText,
      youtube_link: note.youtubeLink,
      time: note.time,
      is_discussion: note.isDiscussion,
      images: note.images,
      order: typeof note.order === 'string' ? parseFloat(note.order) : note.order
    };
  }
  
  // Helper: Convert our schema project to Supabase format
  private convertToSupabaseProject(project: InsertProject): any {
    return {
      user_id: project.userId,
      name: project.name,
      start_slogan: project.startSlogan,
      end_slogan: project.endSlogan,
      author: project.author,
      is_locked: project.isLocked
    };
  }
  
  // Helper: Convert update project to Supabase format
  private convertToSupabaseProjectUpdate(project: UpdateProject): any {
    return {
      name: project.name,
      start_slogan: project.startSlogan,
      end_slogan: project.endSlogan,
      author: project.author,
      is_locked: project.isLocked,
      last_viewed_slide_index: project.lastViewedSlideIndex
    };
  }
  
  // Helper: Convert update note to Supabase format
  private convertToSupabaseNoteUpdate(note: UpdateNote): any {
    const update: any = {};
    
    if (note.content !== undefined) update.content = note.content;
    if (note.parentId !== undefined) update.parent_id = note.parentId;
    if (note.url !== undefined) update.url = note.url;
    if (note.linkText !== undefined) update.link_text = note.linkText;
    if (note.youtubeLink !== undefined) update.youtube_link = note.youtubeLink;
    if (note.time !== undefined) update.time = note.time;
    if (note.isDiscussion !== undefined) update.is_discussion = note.isDiscussion;
    if (note.images !== undefined) update.images = note.images;
    if (note.order !== undefined) {
      update.order = typeof note.order === 'string' ? parseFloat(note.order) : note.order;
    }
    
    // Always update the updated_at timestamp
    update.updated_at = new Date().toISOString();
    
    return update;
  }
  
  // User operations
  async getUser(id: string | number): Promise<User | undefined> {
    try {
      const supabase = await getSupabaseClient();
      if (!supabase) throw new Error('Failed to get Supabase client');
      
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) {
        console.error('Error getting user from Supabase:', error);
        return undefined;
      }
      
      if (!data) return undefined;
      
      return this.convertSupabaseUser(data);
    } catch (error) {
      console.error('Exception in getUser:', error);
      return undefined;
    }
  }
  
  async getUserByUsername(username: string): Promise<User | undefined> {
    try {
      const supabase = await getSupabaseClient();
      if (!supabase) throw new Error('Failed to get Supabase client');
      
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('email', username)
        .single();
      
      if (error) {
        console.error('Error getting user by username from Supabase:', error);
        return undefined;
      }
      
      if (!data) return undefined;
      
      return this.convertSupabaseUser(data);
    } catch (error) {
      console.error('Exception in getUserByUsername:', error);
      return undefined;
    }
  }
  
  async createUser(user: InsertUser): Promise<User> {
    try {
      const supabase = await getSupabaseClient();
      if (!supabase) throw new Error('Failed to get Supabase client');
      
      // In Supabase, the "username" field in our schema maps to "email" in Supabase
      const { data, error } = await supabase
        .from('users')
        .insert({
          id: user.id, // Use provided id if there is one (for Supabase auth)
          email: user.username,
          last_opened_project_id: user.lastOpenedProjectId
        })
        .select()
        .single();
      
      if (error) {
        console.error('Error creating user in Supabase:', error);
        throw error;
      }
      
      if (!data) {
        throw new Error('Failed to create user in Supabase');
      }
      
      return this.convertSupabaseUser(data);
    } catch (error) {
      console.error('Exception in createUser:', error);
      throw error;
    }
  }
  
  async updateLastOpenedProject(userId: string | number, projectId: number | null): Promise<boolean> {
    try {
      const supabase = await getSupabaseClient();
      if (!supabase) throw new Error('Failed to get Supabase client');
      
      console.log(`Updating last opened project for user ${userId} to project ${projectId}`);
      
      const { error } = await supabase
        .from('users')
        .update({ last_opened_project_id: projectId })
        .eq('id', userId);
      
      if (error) {
        console.error('Error updating last opened project in Supabase:', error);
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('Exception in updateLastOpenedProject:', error);
      return false;
    }
  }
  
  // Project operations
  async getProjects(userId: string | number): Promise<Project[]> {
    try {
      const supabase = await getSupabaseClient();
      if (!supabase) throw new Error('Failed to get Supabase client');
      
      console.log(`Getting projects for user ${userId} (${typeof userId})`);
      
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('Error getting projects from Supabase:', error);
        return [];
      }
      
      return data.map(project => this.convertSupabaseProject(project));
    } catch (error) {
      console.error('Exception in getProjects:', error);
      return [];
    }
  }
  
  async getProject(id: number): Promise<Project | undefined> {
    try {
      const supabase = await getSupabaseClient();
      if (!supabase) throw new Error('Failed to get Supabase client');
      
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) {
        console.error('Error getting project from Supabase:', error);
        return undefined;
      }
      
      if (!data) return undefined;
      
      return this.convertSupabaseProject(data);
    } catch (error) {
      console.error('Exception in getProject:', error);
      return undefined;
    }
  }
  
  async createProject(project: InsertProject): Promise<Project> {
    try {
      const supabase = await getSupabaseClient();
      if (!supabase) throw new Error('Failed to get Supabase client');
      
      const supabaseProject = this.convertToSupabaseProject(project);
      
      const { data, error } = await supabase
        .from('projects')
        .insert(supabaseProject)
        .select()
        .single();
      
      if (error) {
        console.error('Error creating project in Supabase:', error);
        throw error;
      }
      
      if (!data) {
        throw new Error('Failed to create project in Supabase');
      }
      
      return this.convertSupabaseProject(data);
    } catch (error) {
      console.error('Exception in createProject:', error);
      throw error;
    }
  }
  
  async updateProject(id: number, data: UpdateProject): Promise<Project | undefined> {
    try {
      const supabase = await getSupabaseClient();
      if (!supabase) throw new Error('Failed to get Supabase client');
      
      const supabaseData = this.convertToSupabaseProjectUpdate(data);
      
      const { data: updatedData, error } = await supabase
        .from('projects')
        .update(supabaseData)
        .eq('id', id)
        .select()
        .single();
      
      if (error) {
        console.error('Error updating project in Supabase:', error);
        return undefined;
      }
      
      if (!updatedData) return undefined;
      
      return this.convertSupabaseProject(updatedData);
    } catch (error) {
      console.error('Exception in updateProject:', error);
      return undefined;
    }
  }
  
  async updateLastViewedSlideIndex(projectId: number, slideIndex: number): Promise<boolean> {
    try {
      const supabase = await getSupabaseClient();
      if (!supabase) throw new Error('Failed to get Supabase client');
      
      const { error } = await supabase
        .from('projects')
        .update({ last_viewed_slide_index: slideIndex })
        .eq('id', projectId);
      
      if (error) {
        console.error('Error updating last viewed slide index in Supabase:', error);
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('Exception in updateLastViewedSlideIndex:', error);
      return false;
    }
  }
  
  async toggleProjectLock(id: number, lockStatus: ToggleProjectLock): Promise<Project | undefined> {
    try {
      const supabase = await getSupabaseClient();
      if (!supabase) throw new Error('Failed to get Supabase client');
      
      const { data, error } = await supabase
        .from('projects')
        .update({ is_locked: lockStatus.isLocked })
        .eq('id', id)
        .select()
        .single();
      
      if (error) {
        console.error('Error toggling project lock in Supabase:', error);
        return undefined;
      }
      
      if (!data) return undefined;
      
      return this.convertSupabaseProject(data);
    } catch (error) {
      console.error('Exception in toggleProjectLock:', error);
      return undefined;
    }
  }
  
  async deleteProject(id: number): Promise<boolean> {
    try {
      const supabase = await getSupabaseClient();
      if (!supabase) throw new Error('Failed to get Supabase client');
      
      // First delete all notes associated with this project
      const notesResponse = await supabase
        .from('notes')
        .delete()
        .eq('project_id', id);
      
      if (notesResponse.error) {
        console.error('Error deleting project notes from Supabase:', notesResponse.error);
        return false;
      }
      
      // Then delete the project itself
      const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', id);
      
      if (error) {
        console.error('Error deleting project from Supabase:', error);
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('Exception in deleteProject:', error);
      return false;
    }
  }
  
  // Note operations
  async getNotes(projectId: number): Promise<Note[]> {
    try {
      const supabase = await getSupabaseClient();
      if (!supabase) throw new Error('Failed to get Supabase client');
      
      const { data, error } = await supabase
        .from('notes')
        .select('*')
        .eq('project_id', projectId)
        .order('order', { ascending: true });
      
      if (error) {
        console.error('Error getting notes from Supabase:', error);
        return [];
      }
      
      return data.map(note => this.convertSupabaseNote(note));
    } catch (error) {
      console.error('Exception in getNotes:', error);
      return [];
    }
  }
  
  async getNote(id: number): Promise<Note | undefined> {
    try {
      const supabase = await getSupabaseClient();
      if (!supabase) throw new Error('Failed to get Supabase client');
      
      const { data, error } = await supabase
        .from('notes')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) {
        console.error('Error getting note from Supabase:', error);
        return undefined;
      }
      
      if (!data) return undefined;
      
      return this.convertSupabaseNote(data);
    } catch (error) {
      console.error('Exception in getNote:', error);
      return undefined;
    }
  }
  
  async createNote(note: InsertNote): Promise<Note> {
    try {
      const supabase = await getSupabaseClient();
      if (!supabase) throw new Error('Failed to get Supabase client');
      
      const supabaseNote = this.convertToSupabaseNote(note);
      
      // Add timestamps
      supabaseNote.created_at = new Date().toISOString();
      supabaseNote.updated_at = new Date().toISOString();
      
      const { data, error } = await supabase
        .from('notes')
        .insert(supabaseNote)
        .select()
        .single();
      
      if (error) {
        console.error('Error creating note in Supabase:', error);
        throw error;
      }
      
      if (!data) {
        throw new Error('Failed to create note in Supabase');
      }
      
      return this.convertSupabaseNote(data);
    } catch (error) {
      console.error('Exception in createNote:', error);
      throw error;
    }
  }
  
  async updateNote(id: number, updateData: UpdateNote): Promise<Note | undefined> {
    try {
      const supabase = await getSupabaseClient();
      if (!supabase) throw new Error('Failed to get Supabase client');
      
      const supabaseData = this.convertToSupabaseNoteUpdate(updateData);
      
      const { data, error } = await supabase
        .from('notes')
        .update(supabaseData)
        .eq('id', id)
        .select()
        .single();
      
      if (error) {
        console.error('Error updating note in Supabase:', error);
        return undefined;
      }
      
      if (!data) return undefined;
      
      return this.convertSupabaseNote(data);
    } catch (error) {
      console.error('Exception in updateNote:', error);
      return undefined;
    }
  }
  
  async deleteNote(id: number, deleteChildren: boolean = true): Promise<boolean> {
    try {
      const supabase = await getSupabaseClient();
      if (!supabase) throw new Error('Failed to get Supabase client');
      
      if (deleteChildren) {
        // First get all child notes recursively
        const childIds = await this.getAllChildNoteIds(id, supabase);
        
        // Then delete all child notes
        if (childIds.length > 0) {
          const { error: childrenError } = await supabase
            .from('notes')
            .delete()
            .in('id', childIds);
          
          if (childrenError) {
            console.error('Error deleting child notes from Supabase:', childrenError);
            return false;
          }
        }
      } else {
        // If not deleting children, set their parent_id to null
        const { error: updateError } = await supabase
          .from('notes')
          .update({ parent_id: null })
          .eq('parent_id', id);
        
        if (updateError) {
          console.error('Error updating child notes in Supabase:', updateError);
          return false;
        }
      }
      
      // Delete the note itself
      const { error } = await supabase
        .from('notes')
        .delete()
        .eq('id', id);
      
      if (error) {
        console.error('Error deleting note from Supabase:', error);
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('Exception in deleteNote:', error);
      return false;
    }
  }
  
  // Helper method to recursively get all child note IDs
  private async getAllChildNoteIds(parentId: number, supabase: SupabaseClient): Promise<number[]> {
    const { data, error } = await supabase
      .from('notes')
      .select('id')
      .eq('parent_id', parentId);
    
    if (error || !data) {
      console.error('Error getting child notes:', error);
      return [];
    }
    
    let childIds = data.map(note => note.id);
    
    // Recursively get children of children
    for (const childId of childIds) {
      const grandchildIds = await this.getAllChildNoteIds(childId, supabase);
      childIds = [...childIds, ...grandchildIds];
    }
    
    return childIds;
  }
  
  async updateNoteOrder(id: number, order: number | string): Promise<boolean> {
    try {
      const supabase = await getSupabaseClient();
      if (!supabase) throw new Error('Failed to get Supabase client');
      
      const numericOrder = typeof order === 'string' ? parseFloat(order) : order;
      
      const { error } = await supabase
        .from('notes')
        .update({ 
          order: numericOrder,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);
      
      if (error) {
        console.error('Error updating note order in Supabase:', error);
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('Exception in updateNoteOrder:', error);
      return false;
    }
  }
  
  async updateNoteParent(id: number, parentId: number | null, order?: number | string): Promise<boolean> {
    try {
      const supabase = await getSupabaseClient();
      if (!supabase) throw new Error('Failed to get Supabase client');
      
      const update: any = {
        parent_id: parentId,
        updated_at: new Date().toISOString()
      };
      
      if (order !== undefined) {
        update.order = typeof order === 'string' ? parseFloat(order) : order;
      }
      
      const { error } = await supabase
        .from('notes')
        .update(update)
        .eq('id', id);
      
      if (error) {
        console.error('Error updating note parent in Supabase:', error);
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('Exception in updateNoteParent:', error);
      return false;
    }
  }
  
  async updateNoteParentsBatch(updates: {id: number, parentId: number | null, order?: number | string}[]): Promise<boolean> {
    try {
      const supabase = await getSupabaseClient();
      if (!supabase) throw new Error('Failed to get Supabase client');
      
      // Unfortunately, Supabase doesn't support batch updates directly, so we need to do them one by one
      for (const update of updates) {
        const supabaseUpdate: any = {
          parent_id: update.parentId,
          updated_at: new Date().toISOString()
        };
        
        if (update.order !== undefined) {
          supabaseUpdate.order = typeof update.order === 'string' ? parseFloat(update.order) : update.order;
        }
        
        const { error } = await supabase
          .from('notes')
          .update(supabaseUpdate)
          .eq('id', update.id);
        
        if (error) {
          console.error(`Error updating note ${update.id} parent in batch:`, error);
          return false;
        }
      }
      
      return true;
    } catch (error) {
      console.error('Exception in updateNoteParentsBatch:', error);
      return false;
    }
  }
  
  async normalizeNoteOrders(parentId: number | null): Promise<boolean> {
    try {
      const supabase = await getSupabaseClient();
      if (!supabase) throw new Error('Failed to get Supabase client');
      
      // First get all notes with the specified parent
      const { data, error } = await supabase
        .from('notes')
        .select('*')
        .eq('parent_id', parentId)
        .order('order', { ascending: true });
      
      if (error) {
        console.error('Error getting notes for normalization from Supabase:', error);
        return false;
      }
      
      if (!data || data.length === 0) {
        return true; // No notes to normalize
      }
      
      // Apply new orders
      for (let i = 0; i < data.length; i++) {
        const newOrder = i * 10; // Space them out by 10
        
        const { error: updateError } = await supabase
          .from('notes')
          .update({ 
            order: newOrder,
            updated_at: new Date().toISOString()
          })
          .eq('id', data[i].id);
        
        if (updateError) {
          console.error(`Error normalizing order for note ${data[i].id}:`, updateError);
          return false;
        }
      }
      
      return true;
    } catch (error) {
      console.error('Exception in normalizeNoteOrders:', error);
      return false;
    }
  }
  
  async normalizeAllProjectNotes(projectId: number): Promise<boolean> {
    try {
      const supabase = await getSupabaseClient();
      if (!supabase) throw new Error('Failed to get Supabase client');
      
      // First get all notes for this project
      const { data, error } = await supabase
        .from('notes')
        .select('id, parent_id')
        .eq('project_id', projectId);
      
      if (error) {
        console.error('Error getting project notes for normalization from Supabase:', error);
        return false;
      }
      
      if (!data || data.length === 0) {
        return true; // No notes to normalize
      }
      
      // Get all unique parent IDs
      const parentIds = new Set<number | null>();
      data.forEach(note => parentIds.add(note.parent_id));
      
      // Normalize each parent group
      for (const parentId of parentIds) {
        const success = await this.normalizeNoteOrders(parentId);
        if (!success) {
          console.error(`Failed to normalize notes with parent ${parentId}`);
          return false;
        }
      }
      
      return true;
    } catch (error) {
      console.error('Exception in normalizeAllProjectNotes:', error);
      return false;
    }
  }
}
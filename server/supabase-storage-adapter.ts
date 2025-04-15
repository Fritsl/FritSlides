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
    if (!data) {
      console.error('Null or undefined data passed to convertSupabaseUser');
      throw new Error('Invalid user data');
    }
    const userId = data.id as string;
    return {
      id: userId || '',
      username: data.username || `user_${typeof userId === 'string' ? userId.substring(0, 8) : 'unknown'}`,
      password: data.password || null, // May be null when using Supabase Auth
      lastOpenedProjectId: data.lastopenedprojectid || null
    };
  }
  
  // Helper: Convert project from Supabase format to our schema format
  private convertSupabaseProject(data: any): Project {
    if (!data) {
      console.error('Null or undefined data passed to convertSupabaseProject');
      throw new Error('Invalid project data');
    }
    return {
      id: data.id || 0,
      userId: data.userid || '',
      name: data.name || '',
      startSlogan: data.startslogan || '',
      endSlogan: data.endslogan || '',
      author: data.author || '',
      lastViewedSlideIndex: typeof data.lastviewedslideindex === 'number' ? data.lastviewedslideindex : 0,
      isLocked: typeof data.islocked === 'boolean' ? data.islocked : false,
      createdAt: data.createdat ? new Date(data.createdat) : new Date()
    };
  }
  
  // Helper: Convert note from Supabase format to our schema format
  private convertSupabaseNote(data: any): Note {
    if (!data) {
      console.error('Null or undefined data passed to convertSupabaseNote');
      throw new Error('Invalid note data');
    }
    return {
      id: data.id || 0,
      projectId: data.projectId || 0,
      parentId: data.parentId, // Can be null
      content: data.content || '',
      url: data.url || null,
      linkText: data.linkText || null,
      youtubeLink: data.youtubeLink || null,
      time: data.time || null,
      isDiscussion: typeof data.isDiscussion === 'boolean' ? data.isDiscussion : false,
      images: Array.isArray(data.images) ? data.images : [],
      order: data.order ? data.order.toString() : "0", // Convert to string as our schema expects
      createdAt: data.createdAt ? new Date(data.createdAt) : new Date(),
      updatedAt: data.updatedAt ? new Date(data.updatedAt) : new Date()
    };
  }
  
  // Helper: Convert our schema note to Supabase format
  private convertToSupabaseNote(note: InsertNote): any {
    console.log('Converting note to Supabase format:', JSON.stringify(note, null, 2));
    
    return {
      projectId: note.projectId,
      parentId: note.parentId,
      content: note.content || '',
      url: note.url || null,
      linkText: note.linkText || null,
      youtubeLink: note.youtubeLink || null,
      time: note.time || null,
      isDiscussion: note.isDiscussion || false,
      images: note.images || [],
      order: typeof note.order === 'string' ? parseFloat(note.order) : (note.order || 0)
    };
  }
  
  // Helper: Convert our schema project to Supabase format
  private convertToSupabaseProject(project: InsertProject): any {
    console.log('Converting project to Supabase format:', JSON.stringify(project, null, 2));
    
    return {
      userId: project.userId,
      name: project.name,
      startSlogan: project.startSlogan || '',
      endSlogan: project.endSlogan || '',
      author: project.author || '',
      isLocked: project.isLocked || false,
      lastViewedSlideIndex: 0  // Default value for new projects
    };
  }
  
  // Helper: Convert update project to Supabase format
  private convertToSupabaseProjectUpdate(project: UpdateProject): any {
    return {
      name: project.name,
      startSlogan: project.startSlogan,
      endSlogan: project.endSlogan,
      author: project.author,
      isLocked: project.isLocked,
      lastViewedSlideIndex: project.lastViewedSlideIndex
    };
  }
  
  // Helper: Convert update note to Supabase format
  private convertToSupabaseNoteUpdate(note: UpdateNote): any {
    const update: any = {};
    
    if (note.content !== undefined) update.content = note.content;
    if (note.parentId !== undefined) update.parentId = note.parentId;
    if (note.url !== undefined) update.url = note.url;
    if (note.linkText !== undefined) update.linkText = note.linkText;
    if (note.youtubeLink !== undefined) update.youtubeLink = note.youtubeLink;
    if (note.time !== undefined) update.time = note.time;
    if (note.isDiscussion !== undefined) update.isDiscussion = note.isDiscussion;
    if (note.images !== undefined) update.images = note.images;
    if (note.order !== undefined) {
      update.order = typeof note.order === 'string' ? parseFloat(note.order) : note.order;
    }
    
    // Always update the updated_at timestamp
    update.updatedAt = new Date().toISOString();
    
    return update;
  }
  
  // User operations
  async getUser(id: string | number): Promise<User | undefined> {
    try {
      const supabase = await getSupabaseClient();
      if (!supabase) throw new Error('Failed to get Supabase client');
      
      // Make sure id is a string for Supabase users table
      const userId = String(id);
      console.log(`Getting user with ID: ${userId} (type: ${typeof userId})`);
      
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
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
        .eq('username', username)
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
      
      // Create a new user record with the Supabase user ID
      console.log(`Creating user record with ID: ${user.id}`);
      
      const { data, error } = await supabase
        .from('users')
        .insert({
          id: user.id, // Use provided id if there is one (for Supabase auth)
          username: user.username,
          lastOpenedProjectId: user.lastOpenedProjectId
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
      
      // Make sure userId is a string for Supabase users table
      const supabaseUserId = String(userId);
      console.log(`Updating last opened project for user ${supabaseUserId} to project ${projectId}`);
      
      const { error } = await supabase
        .from('users')
        .update({ lastOpenedProjectId: projectId })
        .eq('id', supabaseUserId);
      
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
      
      // Make sure userId is a string for Supabase (UUID format)
      const supabaseUserId = String(userId);
      console.log(`Getting projects for user ${supabaseUserId} (${typeof supabaseUserId})`);
      
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('userId', supabaseUserId)
        .order('createdAt', { ascending: false });
      
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
      
      // Add timestamps
      supabaseProject.createdAt = new Date().toISOString();
      supabaseProject.updatedAt = new Date().toISOString();
      
      console.log('Creating project with data:', JSON.stringify(supabaseProject, null, 2));
      
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
      
      // updatedAt doesn't exist in projects table
      console.log('Updating project with data:', JSON.stringify(supabaseData, null, 2));
      
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
        .update({ 
          lastViewedSlideIndex: slideIndex
          // No updatedAt field in projects table
        })
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
        .update({ 
          isLocked: lockStatus.isLocked
          // No updatedAt field in projects table
        })
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
        .eq('projectId', id);
      
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
        .eq('projectId', projectId)
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
      supabaseNote.createdAt = new Date().toISOString();
      supabaseNote.updatedAt = new Date().toISOString();
      
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
        // If not deleting children, set their parentId to null
        const { error: updateError } = await supabase
          .from('notes')
          .update({ parentId: null })
          .eq('parentId', id);
        
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
      .eq('parentId', parentId);
    
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
          updatedAt: new Date().toISOString()
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
        parentId: parentId,
        updatedAt: new Date().toISOString()
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
          parentId: update.parentId,
          updatedAt: new Date().toISOString()
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
      
      // First get all notes with the specified parent - handling null properly
      let query = supabase
        .from('notes')
        .select('*')
        .order('order', { ascending: true });
        
      // Use IS NULL for null values, eq for non-null values
      if (parentId === null) {
        query = query.is('parentId', null);
      } else {
        query = query.eq('parentId', parentId);
      }
      
      const { data, error } = await query;
      
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
        
        // Type-safe update
        if (data[i] && data[i].id) {
          const noteUpdate: Record<string, any> = { 
            order: newOrder,
            updatedat: new Date().toISOString()
          };
          
          const { error: updateError } = await supabase
            .from('notes')
            .update(noteUpdate)
            .eq('id', data[i].id as number);
          
          if (updateError) {
            console.error(`Error normalizing order for note ${data[i].id}:`, updateError);
            return false;
          }
        } else {
          console.error(`Invalid note data at index ${i}`);
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
        .select('id, parentId')
        .eq('projectId', projectId);
      
      if (error) {
        console.error('Error getting project notes for normalization from Supabase:', error);
        return false;
      }
      
      if (!data || data.length === 0) {
        return true; // No notes to normalize
      }
      
      // Get all unique parent IDs
      const parentIds = new Set<number | null>();
      data.forEach(note => {
        if (note && note.parentId !== undefined) {
          parentIds.add(note.parentId as number | null);
        }
      });
      
      // Convert Set to Array to avoid iteration issues
      const parentIdArray = Array.from(parentIds);
      
      // Normalize each parent group
      for (const parentId of parentIdArray) {
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
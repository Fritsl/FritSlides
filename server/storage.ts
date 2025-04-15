import { users, type User, type InsertUser, projects, type Project, type InsertProject, type UpdateProject, notes, type Note, type InsertNote, type UpdateNote, type ToggleProjectLock } from "@shared/schema";
import session from "express-session";
import createMemoryStore from "memorystore";
import connectPg from "connect-pg-simple";
import { db } from "./db";
import { eq, and, desc, asc, isNull, sql, inArray } from "drizzle-orm";
import { client } from "./db";
import pg from "pg";

const MemoryStore = createMemoryStore(session);
const PostgresSessionStore = connectPg(session);

// Create a standard pg Pool for the session store
const pgPool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

export interface IStorage {
  // User operations - updated for Supabase (string user IDs)
  getUser(id: string | number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateLastOpenedProject(userId: string | number, projectId: number | null): Promise<boolean>;
  
  // Project operations - updated for Supabase (string user IDs)
  getProjects(userId: string | number): Promise<Project[]>;
  getProject(id: number): Promise<Project | undefined>;
  createProject(project: InsertProject): Promise<Project>;
  updateProject(id: number, data: UpdateProject): Promise<Project | undefined>;
  updateLastViewedSlideIndex(projectId: number, slideIndex: number): Promise<boolean>;
  toggleProjectLock(id: number, lockStatus: ToggleProjectLock): Promise<Project | undefined>;
  deleteProject(id: number): Promise<boolean>;
  
  // Note operations
  getNotes(projectId: number): Promise<Note[]>;
  getNote(id: number): Promise<Note | undefined>;
  createNote(note: InsertNote): Promise<Note>;
  updateNote(id: number, note: UpdateNote): Promise<Note | undefined>;
  deleteNote(id: number, deleteChildren?: boolean): Promise<boolean>;
  updateNoteOrder(id: number, order: number | string): Promise<boolean>;
  updateNoteParent(id: number, parentId: number | null, order?: number | string): Promise<boolean>;
  
  // Optimized batch version for imports
  updateNoteParentsBatch(updates: {id: number, parentId: number | null, order?: number | string}[]): Promise<boolean>;
  normalizeNoteOrders(parentId: number | null): Promise<boolean>;
  normalizeAllProjectNotes(projectId: number): Promise<boolean>;
  
  // Session store
  sessionStore: any; // Use any for session store type to avoid type issues
}

export class DatabaseStorage implements IStorage {
  sessionStore: any; // Use any for session store type

  constructor() {
    this.sessionStore = new PostgresSessionStore({
      pool: pgPool, // Use standard pg Pool
      createTableIfMissing: true
    });
  }

  // User operations - updated for Supabase
  async getUser(id: string | number): Promise<User | undefined> {
    console.log(`Getting user with ID: ${id} (type: ${typeof id})`);
    
    // Convert to string to ensure proper comparison with database
    const idStr = String(id);
    console.log(`Converted ID: ${idStr}`);
    
    try {
      const [user] = await db.select().from(users).where(eq(users.id, idStr));
      console.log(`User lookup result: ${user ? 'User found' : 'User NOT found'}`);
      return user;
    } catch (error) {
      console.error(`Error getting user with ID ${idStr}:`, error);
      throw error;
    }
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    // For Supabase integration, add ID if not provided
    const userData = {
      ...insertUser,
      // Use provided ID or generate a random one for testing
      id: insertUser.id || crypto.randomUUID()
    };
    
    const [user] = await db.insert(users).values(userData).returning();
    return user;
  }
  
  async updateLastOpenedProject(userId: string | number, projectId: number | null): Promise<boolean> {
    try {
      // Make sure projectId is a number or null (not an object)
      let validProjectId: number | null = null;
      
      if (projectId !== null && projectId !== undefined) {
        // Handle the case where projectId might be an object by extracting number value
        if (typeof projectId === 'object') {
          console.warn(`Received object instead of number for projectId: ${JSON.stringify(projectId)}`);
          // Try to extract id if it's in projectId.id format
          if (projectId && typeof projectId === 'object' && 'id' in projectId) {
            validProjectId = Number(projectId.id);
          }
        } else {
          // Convert to number to ensure it's a proper integer
          validProjectId = Number(projectId);
        }
        
        // Final validation that we have a valid number
        if (isNaN(validProjectId)) {
          console.error(`Invalid projectId: ${projectId}, setting to null`);
          validProjectId = null;
        }
      }
      
      console.log(`Updating last opened project for user ${userId} to project ${validProjectId}`);
      
      // Now use the validated project ID and ensure userId is a string
      const userIdStr = String(userId);
      const [updatedUser] = await db
        .update(users)
        .set({ lastOpenedProjectId: validProjectId })
        .where(eq(users.id, userIdStr))
        .returning();
        
      if (!updatedUser) {
        // If user doesn't exist yet (first Supabase login), create the user
        console.log(`User ${userId} not found, creating new user record for Supabase integration`);
        const newUser = await this.createUser({
          id: userIdStr,
          username: `user_${userIdStr.substring(0, 8)}`,
          password: null, // Password not needed for Supabase users
          lastOpenedProjectId: validProjectId
        });
        return !!newUser;
      }
      
      return !!updatedUser;
    } catch (error) {
      console.error("Error updating last opened project:", error);
      return false;
    }
  }

  // Project operations - updated for Supabase (string user IDs)
  async getProjects(userId: string | number): Promise<Project[]> {
    console.log(`Getting projects for user ${userId} (${typeof userId})`);
    return await db.select().from(projects).where(eq(projects.userId, String(userId)));
  }

  async getProject(id: number): Promise<Project | undefined> {
    const [project] = await db.select().from(projects).where(eq(projects.id, id));
    return project;
  }

  async createProject(insertProject: InsertProject): Promise<Project> {
    // Add default lastViewedSlideIndex if not provided
    const projectData = {
      ...insertProject,
      lastViewedSlideIndex: insertProject.lastViewedSlideIndex ?? 0
    };
    const [project] = await db.insert(projects).values(projectData).returning();
    return project;
  }

  async updateProject(id: number, data: UpdateProject): Promise<Project | undefined> {
    const [updatedProject] = await db
      .update(projects)
      .set(data)
      .where(eq(projects.id, id))
      .returning();
    return updatedProject;
  }
  
  async updateLastViewedSlideIndex(projectId: number, slideIndex: number): Promise<boolean> {
    try {
      const [updatedProject] = await db
        .update(projects)
        .set({ lastViewedSlideIndex: slideIndex })
        .where(eq(projects.id, projectId))
        .returning();
      return !!updatedProject;
    } catch (error) {
      console.error("Error updating last viewed slide index:", error);
      return false;
    }
  }
  
  async toggleProjectLock(id: number, lockStatus: ToggleProjectLock): Promise<Project | undefined> {
    try {
      // First check if project exists
      const [project] = await db.select().from(projects).where(eq(projects.id, id));
      if (!project) {
        console.error(`Project with id ${id} not found`);
        return undefined;
      }
      
      // Update the project lock status
      const [updatedProject] = await db
        .update(projects)
        .set({ isLocked: lockStatus.isLocked })
        .where(eq(projects.id, id))
        .returning();
      
      return updatedProject;
    } catch (error) {
      console.error(`Error toggling project lock status (id=${id}):`, error);
      throw error;
    }
  }

  async deleteProject(id: number): Promise<boolean> {
    try {
      // Check if the project exists and if it's locked
      const [project] = await db.select().from(projects).where(eq(projects.id, id));
      
      if (!project) {
        return false; // Project doesn't exist
      }
      
      if (project.isLocked) {
        console.error(`Cannot delete project (id=${id}) because it is locked`);
        return false; // Project is locked, cannot delete
      }
      
      // First, clear any users' lastOpenedProjectId if it's set to this project
      await db
        .update(users)
        .set({ lastOpenedProjectId: null })
        .where(eq(users.lastOpenedProjectId, id));
      
      // Delete associated notes using a CTE to handle nested relationships properly
      await db.execute(sql`
        WITH RECURSIVE descendant_notes AS (
          SELECT "id" FROM notes WHERE "projectId" = ${id}
        )
        DELETE FROM notes WHERE "projectId" = ${id}
      `);
      
      // Delete the project
      const deleted = await db.delete(projects).where(eq(projects.id, id)).returning();
      return deleted.length > 0;
    } catch (error) {
      console.error(`Error deleting project (id=${id}):`, error);
      throw error;
    }
  }

  // Note operations
  async getNotes(projectId: number): Promise<Note[]> {
    const result = await db
      .select()
      .from(notes)
      .where(eq(notes.projectId, projectId))
      .orderBy(notes.parentId, notes.order);
    
    return result as Note[];
  }

  async getNote(id: number): Promise<Note | undefined> {
    const [result] = await db.select().from(notes).where(eq(notes.id, id));
    return result as Note | undefined;
  }

  async createNote(insertNote: InsertNote): Promise<Note> {
    try {
      // Check if the project exists and if it's locked
      const [project] = await db.select().from(projects).where(eq(projects.id, insertNote.projectId));
      
      if (!project) {
        throw new Error(`Project with id ${insertNote.projectId} not found`);
      }
      
      if (project.isLocked) {
        throw new Error(`Cannot create note in project ${insertNote.projectId} because it is locked`);
      }
      
      // Find max order value for siblings to place this note at the end
      const [maxOrderResult] = await db
        .select({ maxOrder: sql<number>`COALESCE(MAX(${notes.order}), -1)` })
        .from(notes)
        .where(and(
          eq(notes.projectId, insertNote.projectId),
          insertNote.parentId ? eq(notes.parentId, insertNote.parentId) : isNull(notes.parentId)
        ));
      
      const maxOrder = maxOrderResult?.maxOrder ?? -1;
      
      // Calculate the order value:
      // - If explicit order is provided, use it (allows precise positioning)
      // - Otherwise, always place new notes at the end (maxOrder + 1)
      const order = insertNote.order !== undefined ? Number(insertNote.order) : maxOrder + 1;
      
      // Log the order calculation for debugging
      console.log(`Creating note with order ${order} (maxOrder was ${maxOrder})`); 
      
      // Create and return the note first, so we can respond quickly to the client
      const [note] = await db
        .insert(notes)
        .values({ ...insertNote, order })
        .returning();
      
      // Check if fastCreate flag is present to determine if we should normalize immediately
      // or schedule it to happen asynchronously
      const skipNormalize = insertNote.fastCreate === true;
      
      if (skipNormalize) {
        // For fast create requests, schedule normalization to happen after responding to client
        // by wrapping in a Promise that will be executed after the current call stack is clear
        Promise.resolve().then(async () => {
          try {
            console.log(`Performing delayed normalization for note ${note.id} with parent ${insertNote.parentId === null ? 'ROOT' : insertNote.parentId}`);
            await this.normalizeNoteOrders(insertNote.parentId);
          } catch (err) {
            console.error(`Error in delayed normalization for note ${note.id}:`, err);
          }
        });
      } else {
        // Standard behavior - normalize immediately before returning
        await this.normalizeNoteOrders(insertNote.parentId);
      }
      
      return note;
    } catch (error) {
      console.error("Error creating note:", error);
      throw error;
    }
  }

  async updateNote(id: number, updateData: UpdateNote): Promise<Note | undefined> {
    try {
      // First check if the note exists and find its project
      const [noteToUpdate] = await db
        .select()
        .from(notes)
        .where(eq(notes.id, id));
      
      if (!noteToUpdate) {
        return undefined;
      }
      
      // Check if the project is locked
      const [project] = await db.select().from(projects).where(eq(projects.id, noteToUpdate.projectId));
      
      if (!project) {
        throw new Error(`Project with id ${noteToUpdate.projectId} not found`);
      }
      
      if (project.isLocked) {
        throw new Error(`Cannot update note in project ${noteToUpdate.projectId} because it is locked`);
      }
      
      // Proceed with the update
      const [updatedNote] = await db
        .update(notes)
        .set({ ...updateData, updatedAt: new Date() })
        .where(eq(notes.id, id))
        .returning();
        
      // @ts-ignore - TypeScript issue with drizzle-orm return types
      return updatedNote;
    } catch (error) {
      console.error("Error updating note:", error);
      throw error;
    }
  }

  async deleteNote(id: number, deleteChildren: boolean = true): Promise<boolean> {
    try {
      // First check if the note exists
      const [noteToDelete] = await db
        .select()
        .from(notes)
        .where(eq(notes.id, id));
      
      if (!noteToDelete) {
        return false;
      }
      
      // Check if the project is locked
      const [project] = await db.select().from(projects).where(eq(projects.id, noteToDelete.projectId));
      
      if (!project) {
        throw new Error(`Project with id ${noteToDelete.projectId} not found`);
      }
      
      if (project.isLocked) {
        throw new Error(`Cannot delete note in project ${noteToDelete.projectId} because it is locked`);
      }
      
      if (deleteChildren) {
        // Find all descendant notes recursively using a CTE query
        // Using quotes to ensure proper column casing
        await db.execute(sql`
          WITH RECURSIVE descendants AS (
            SELECT "id" FROM notes WHERE "id" = ${id}
            UNION
            SELECT n."id" FROM notes n, descendants d WHERE n."parentId" = d."id"
          )
          DELETE FROM notes WHERE "id" IN (SELECT "id" FROM descendants)
        `);
      } else {
        // First update all child notes to have the same parent as the deleted note
        await db.execute(sql`
          UPDATE notes 
          SET "parentId" = ${noteToDelete.parentId} 
          WHERE "parentId" = ${id}
        `);
        
        // Then delete only the requested note
        await db.delete(notes).where(eq(notes.id, id));
        
        // Normalize order of remaining notes
        await this.normalizeNoteOrders(noteToDelete.parentId);
      }
      
      return true;
    } catch (error) {
      console.error("Error deleting note:", error);
      throw error;
    }
  }

  async updateNoteOrder(id: number, order: number | string): Promise<boolean> {
    try {
      // First get the note to update to access its properties
      const [noteToUpdate] = await db
        .select()
        .from(notes)
        .where(eq(notes.id, id));
        
      if (!noteToUpdate) return false;
      
      // Check if the project is locked
      const [project] = await db.select().from(projects).where(eq(projects.id, noteToUpdate.projectId));
      
      if (!project) {
        throw new Error(`Project with id ${noteToUpdate.projectId} not found`);
      }
      
      if (project.isLocked) {
        throw new Error(`Cannot update note order in project ${noteToUpdate.projectId} because it is locked`);
      }
      
      // Store old parent for normalization
      const parentId = noteToUpdate.parentId;
      
      // Allow for fractional order values during drag operations (don't round immediately)
      // This preserves the relative ordering during drag operations 
      const numOrder = Number(order);
      
      // Update the note with the new order
      const [updatedNote] = await db
        .update(notes)
        .set({ order: numOrder, updatedAt: new Date() })
        .where(eq(notes.id, id))
        .returning();
      
      // Always normalize the orders of siblings after any order change
      // This ensures consistent sequential ordering (0, 1, 2...) of all notes
      if (updatedNote) {
        await this.normalizeNoteOrders(parentId);
      }
      
      return !!updatedNote;
    } catch (error) {
      console.error("Error updating note order:", error);
      throw error;
    }
  }

  async updateNoteParent(id: number, parentId: number | null, order?: number | string): Promise<boolean> {
    try {
      // Get the note we're updating to get its project ID and current parent
      const [noteToUpdate] = await db
        .select()
        .from(notes)
        .where(eq(notes.id, id));
        
      if (!noteToUpdate) return false;
      
      // Check if the project is locked
      const [project] = await db.select().from(projects).where(eq(projects.id, noteToUpdate.projectId));
      
      if (!project) {
        throw new Error(`Project with id ${noteToUpdate.projectId} not found`);
      }
      
      if (project.isLocked) {
        throw new Error(`Cannot update note parent in project ${noteToUpdate.projectId} because it is locked`);
      }
      
      // Store old parent for normalization
      const oldParentId = noteToUpdate.parentId;
      
      // If specific order is not provided, find max order value for new siblings to place this note at the end
      let newOrder: number;
      
      if (order !== undefined) {
        // Allow fractional orders during drag operations to maintain relative ordering
        newOrder = Number(order);
      } else {
        // Calculate a new order at the end
        const [maxOrderResult] = await db
          .select({ maxOrder: sql<number>`COALESCE(MAX(${notes.order}), -1)` })
          .from(notes)
          .where(and(
            eq(notes.projectId, noteToUpdate.projectId),
            parentId ? eq(notes.parentId, parentId) : isNull(notes.parentId)
          ));
        
        newOrder = (maxOrderResult?.maxOrder ?? -1) + 1;
      }
      
      console.log(`Updating note parent: id=${id}, parentId=${parentId}, order=${newOrder}`);
      
      const [updatedNote] = await db
        .update(notes)
        .set({ 
          parentId, 
          order: newOrder,
          updatedAt: new Date() 
        })
        .where(eq(notes.id, id))
        .returning();
      
      // If updated successfully, normalize both old and new parent's children
      if (updatedNote) {
        // Normalize orders for the old parent's children
        if (oldParentId !== parentId) {
          await this.normalizeNoteOrders(oldParentId);
        }
        
        // Normalize orders for the new parent's children
        await this.normalizeNoteOrders(parentId);
      }
      
      return !!updatedNote;
    } catch (error) {
      console.error("Error updating note parent:", error);
      throw error;
    }
  }
  
  async updateNoteParentsBatch(updates: {id: number, parentId: number | null, order?: number | string}[]): Promise<boolean> {
    try {
      if (!updates.length) return true;
      
      // Track unique parent IDs that need normalization after updates
      const parentsToNormalize = new Set<number | null>();
      
      // First, get note IDs to fetch notes with their project IDs
      const noteIds = updates.map(update => update.id);
      
      // Fetch all affected notes with a single query
      const notesToUpdate = await db
        .select()
        .from(notes)
        .where(inArray(notes.id, noteIds));
      
      if (!notesToUpdate.length) {
        console.log("No valid notes found for batch update");
        return true;
      }
      
      // Collect all unique project IDs
      const projectIds = new Set<number>();
      for (const note of notesToUpdate) {
        projectIds.add(note.projectId);
      }
      
      // Check if any of the projects are locked
      for (const projectId of projectIds) {
        const [project] = await db
          .select()
          .from(projects)
          .where(eq(projects.id, projectId));
        
        if (!project) {
          throw new Error(`Project with id ${projectId} not found`);
        }
        
        if (project.isLocked) {
          throw new Error(`Cannot update notes in project ${projectId} because it is locked`);
        }
      }
      
      // Process updates in smaller, sequential batches to prevent deadlocks
      const batchSize = 10; // Smaller batch size to reduce deadlock risk
      
      for (let i = 0; i < updates.length; i += batchSize) {
        const batch = updates.slice(i, i + batchSize);
        
        // Use a separate transaction for each small batch
        await db.transaction(async (tx) => {
          // Process updates sequentially within each batch to avoid concurrency issues
          for (const { id, parentId, order } of batch) {
            // Convert order to a number if provided, or use a default
            const orderValue = order !== undefined ? Number(order) : 999999;
            
            await tx.update(notes)
              .set({ 
                parentId, 
                order: orderValue,
                updatedAt: new Date() 
              })
              .where(eq(notes.id, id));
            
            // Add this parent to the list that needs normalization
            parentsToNormalize.add(parentId);
          }
        });
        
        // Optional: Log progress periodically to avoid console spam
        if (i % 20 === 0 || i + batchSize >= updates.length) {
          console.log(`Batch parent update progress: ${Math.min(i + batchSize, updates.length)}/${updates.length}`);
        }
        
        // Add a small delay between batches to reduce database contention
        if (updates.length > 50 && i + batchSize < updates.length) {
          await new Promise(resolve => setTimeout(resolve, 50));
        }
      }
      
      console.log(`Successfully updated ${updates.length} note parents in batch mode`);
      
      // For large imports, we'll skip immediate normalization to avoid deadlocks
      // It will be done as a separate step at the end of the import process
      return true;
    } catch (error) {
      console.error("Error in batch update of note parents:", error);
      throw error; // Propagate the error to notify about locked projects
    }
  }
  
  async normalizeNoteOrders(parentId: number | null): Promise<boolean> {
    try {
      const parentLabel = parentId === null ? 'ROOT' : parentId;
      console.log(`ORDER NORMALIZATION: Starting for parent ${parentLabel}`);

      // Get all notes with the same parent, ordered by their current order
      // Specifically cast order to number to ensure correct sorting
      const notesWithSameParent = await db
        .select()
        .from(notes)
        .where(parentId ? eq(notes.parentId, parentId) : isNull(notes.parentId))
        .orderBy(sql`CAST(${notes.order} AS FLOAT)`);
      
      if (!notesWithSameParent.length) {
        console.log(`ORDER NORMALIZATION: No notes found for parent ${parentLabel}`);
        return true;
      }
      
      // Skip logging for large collections to improve performance
      const noteCount = notesWithSameParent.length;
      const isLargeCollection = noteCount > 50;
      
      if (!isLargeCollection) {
        console.log(`ORDER NORMALIZATION: Found ${noteCount} notes to normalize for parent ${parentLabel}`);
        
        // Create a list of the current orders for logging (only for small collections)
        const currentOrders = notesWithSameParent.map(n => `${n.id}:${n.order}`);
        console.log(`ORDER NORMALIZATION: Current order values: ${currentOrders.join(', ')}`);
      } else {
        console.log(`ORDER NORMALIZATION: Found ${noteCount} notes to normalize for parent ${parentLabel} (order details omitted for performance)`);
      }
      
      // Check if notes are already in sequential order (0, 1, 2...)
      let alreadyNormalized = true;
      for (let i = 0; i < noteCount; i++) {
        if (Number(notesWithSameParent[i].order) !== i) {
          alreadyNormalized = false;
          break;
        }
      }
      
      // Skip normalization if already in correct order to improve performance
      if (alreadyNormalized) {
        console.log(`ORDER NORMALIZATION: Notes for parent ${parentLabel} already normalized, skipping`);
        return true;
      }
      
      // Build updates with sequential integers starting from 0
      const allUpdates = notesWithSameParent.map((note, index) => ({
        id: note.id,
        newOrder: index
      }));
      
      // Only log new orders for small collections to avoid console spam
      if (!isLargeCollection) {
        const newOrders = allUpdates.map(u => `${u.id}:${u.newOrder}`);
        console.log(`ORDER NORMALIZATION: New order values: ${newOrders.join(', ')}`);
      }
      
      // For large collections, use batched updates to avoid overloading the DB connection
      if (isLargeCollection) {
        const BATCH_SIZE = 50;
        console.log(`ORDER NORMALIZATION: Using batched updates for ${noteCount} notes`);
        
        for (let i = 0; i < allUpdates.length; i += BATCH_SIZE) {
          const batch = allUpdates.slice(i, i + BATCH_SIZE);
          
          // Process each batch in its own transaction
          await db.transaction(async (tx) => {
            await Promise.all(batch.map(update => 
              tx
                .update(notes)
                .set({ order: update.newOrder, updatedAt: new Date() })
                .where(eq(notes.id, update.id))
            ));
          });
          
          // Log progress for large batches
          if ((i + BATCH_SIZE) % 200 === 0 || i + BATCH_SIZE >= allUpdates.length) {
            console.log(`ORDER NORMALIZATION: Processed ${Math.min(i + BATCH_SIZE, allUpdates.length)}/${allUpdates.length} notes`);
          }
        }
      } else {
        // For small collections, use a single transaction for all updates
        await db.transaction(async (tx) => {
          await Promise.all(allUpdates.map(update => 
            tx
              .update(notes)
              .set({ order: update.newOrder, updatedAt: new Date() })
              .where(eq(notes.id, update.id))
          ));
        });
      }
      
      console.log(`ORDER NORMALIZATION: Successfully normalized ${noteCount} notes for parent ${parentLabel}`);
      return true;
    } catch (error) {
      console.error(`ORDER NORMALIZATION ERROR for parent ${parentId === null ? 'ROOT' : parentId}:`, error);
      // Return false instead of throwing to make error handling more graceful
      return false;
    }
  }
  
  // Recursively normalize all notes in a project
  async normalizeAllProjectNotes(projectId: number): Promise<boolean> {
    try {
      console.log(`PROJECT NOTE NORMALIZATION: Starting for project ${projectId}`);
      
      // First get all notes in the project
      const allNotes = await db
        .select()
        .from(notes)
        .where(eq(notes.projectId, projectId));
      
      console.log(`PROJECT NOTE NORMALIZATION: Found ${allNotes.length} notes in project ${projectId}`);
      
      // Build a hierarchy map to identify all unique parent IDs
      const parentIds = new Set<number | null>();
      allNotes.forEach(note => {
        parentIds.add(note.parentId);
      });
      
      // Convert to array and ensure null (root) comes first for better handling
      const uniqueParentIds = Array.from(parentIds);
      if (uniqueParentIds.includes(null)) {
        // Remove null and add it to the front
        const nullIndex = uniqueParentIds.indexOf(null);
        uniqueParentIds.splice(nullIndex, 1);
        uniqueParentIds.unshift(null);
      }
      
      console.log(`PROJECT NOTE NORMALIZATION: Identified ${uniqueParentIds.length} unique parent levels to normalize`);
      
      // Normalize each parent ID group sequentially to avoid race conditions
      for (const parentId of uniqueParentIds) {
        console.log(`PROJECT NOTE NORMALIZATION: Normalizing notes with parent ${parentId === null ? 'ROOT' : parentId}`);
        await this.normalizeNoteOrders(parentId);
      }
      
      console.log(`PROJECT NOTE NORMALIZATION: Successfully normalized all notes in project ${projectId}`);
      return true;
    } catch (error) {
      console.error(`PROJECT NOTE NORMALIZATION ERROR for project ${projectId}:`, error);
      return false;
    }
  }
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private projects: Map<number, Project>;
  private notes: Map<number, Note>;
  currentUserId: number;
  currentProjectId: number;
  currentNoteId: number;
  sessionStore: any; // Use any for session store type

  constructor() {
    this.users = new Map();
    this.projects = new Map();
    this.notes = new Map();
    this.currentUserId = 1;
    this.currentProjectId = 1;
    this.currentNoteId = 1;
    this.sessionStore = new MemoryStore({
      checkPeriod: 86400000, // Prune expired sessions every 24h
    });
  }

  // User operations
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.currentUserId++;
    const user: User = { ...insertUser, id, lastOpenedProjectId: null };
    this.users.set(id, user);
    return user;
  }
  
  async updateLastOpenedProject(userId: number, projectId: number | null): Promise<boolean> {
    const user = this.users.get(userId);
    if (!user) return false;
    
    // Make sure projectId is a number or null (not an object)
    let validProjectId: number | null = null;
    
    if (projectId !== null && projectId !== undefined) {
      // Handle the case where projectId might be an object by extracting number value
      if (typeof projectId === 'object') {
        console.warn(`Received object instead of number for projectId: ${JSON.stringify(projectId)}`);
        // Try to extract id if it's in projectId.id format
        if (projectId && typeof projectId === 'object' && 'id' in projectId) {
          validProjectId = Number(projectId.id);
        }
      } else {
        // Convert to number to ensure it's a proper integer
        validProjectId = Number(projectId);
      }
      
      // Final validation that we have a valid number
      if (isNaN(validProjectId)) {
        console.error(`Invalid projectId: ${projectId}, setting to null`);
        validProjectId = null;
      }
    }
    
    const updatedUser = { ...user, lastOpenedProjectId: validProjectId };
    this.users.set(userId, updatedUser);
    return true;
  }

  // Project operations
  async getProjects(userId: number): Promise<Project[]> {
    return Array.from(this.projects.values()).filter(
      (project) => project.userId === userId,
    );
  }

  async getProject(id: number): Promise<Project | undefined> {
    return this.projects.get(id);
  }

  async createProject(insertProject: InsertProject): Promise<Project> {
    const id = this.currentProjectId++;
    const project: Project = { 
      ...insertProject, 
      id,
      lastViewedSlideIndex: 0,
      createdAt: new Date() 
    };
    this.projects.set(id, project);
    return project;
  }

  async updateProject(id: number, data: UpdateProject): Promise<Project | undefined> {
    const project = this.projects.get(id);
    if (!project) return undefined;
    
    const updatedProject = { ...project, ...data };
    this.projects.set(id, updatedProject);
    return updatedProject;
  }
  
  async updateLastViewedSlideIndex(projectId: number, slideIndex: number): Promise<boolean> {
    try {
      const project = this.projects.get(projectId);
      if (!project) return false;
      
      const updatedProject = { ...project, lastViewedSlideIndex: slideIndex };
      this.projects.set(projectId, updatedProject);
      return true;
    } catch (error) {
      console.error("Error updating last viewed slide index:", error);
      return false;
    }
  }
  
  async toggleProjectLock(id: number, lockStatus: ToggleProjectLock): Promise<Project | undefined> {
    try {
      const project = this.projects.get(id);
      if (!project) return undefined;
      
      const updatedProject = { ...project, isLocked: lockStatus.isLocked };
      this.projects.set(id, updatedProject);
      return updatedProject;
    } catch (error) {
      console.error(`Error toggling project lock status (id=${id}):`, error);
      throw error;
    }
  }

  async deleteProject(id: number): Promise<boolean> {
    // Check if the project exists and if it's locked
    const project = this.projects.get(id);
    
    if (!project) {
      return false; // Project doesn't exist
    }
    
    if (project.isLocked) {
      console.error(`Cannot delete project (id=${id}) because it is locked`);
      return false; // Project is locked, cannot delete
    }
    
    // Delete associated notes first
    const projectNotes = Array.from(this.notes.values()).filter(
      (note) => note.projectId === id
    );
    
    for (const note of projectNotes) {
      this.notes.delete(note.id);
    }
    
    return this.projects.delete(id);
  }

  // Note operations
  async getNotes(projectId: number): Promise<Note[]> {
    return Array.from(this.notes.values()).filter(
      (note) => note.projectId === projectId
    );
  }

  async getNote(id: number): Promise<Note | undefined> {
    return this.notes.get(id);
  }

  async createNote(insertNote: InsertNote): Promise<Note> {
    try {
      // Check if the project exists and if it's locked
      const project = this.projects.get(insertNote.projectId);
      
      if (!project) {
        throw new Error(`Project with id ${insertNote.projectId} not found`);
      }
      
      if (project.isLocked) {
        throw new Error(`Cannot create note in project ${insertNote.projectId} because it is locked`);
      }
      
      const id = this.currentNoteId++;
      const now = new Date();
      
      // Find max order value for siblings to place this note at the end
      const siblings = Array.from(this.notes.values()).filter(
        (note: Note) => 
          note.projectId === insertNote.projectId && 
          String(note.parentId) === String(insertNote.parentId)
      );
      
      let maxOrder = -1;
      if (siblings.length > 0) {
        const orders = siblings.map(n => Number(n.order));
        maxOrder = Math.max(...orders);
      }
      
      const order = insertNote.order !== undefined ? insertNote.order : maxOrder + 1;
      
      const note: Note = { 
        ...insertNote, 
        id, 
        order,
        createdAt: now,
        updatedAt: now 
      };
      
      this.notes.set(id, note);
      
      // Always normalize orders after creating a note to ensure consistent ordering
      await this.normalizeNoteOrders(insertNote.parentId);
      
      return note;
    } catch (error) {
      console.error("Error creating note in MemStorage:", error);
      throw error;
    }
  }

  async updateNote(id: number, updateData: UpdateNote): Promise<Note | undefined> {
    try {
      const note = this.notes.get(id);
      if (!note) return undefined;
      
      // Check if the project is locked
      const project = this.projects.get(note.projectId);
      
      if (!project) {
        throw new Error(`Project with id ${note.projectId} not found`);
      }
      
      if (project.isLocked) {
        throw new Error(`Cannot update note in project ${note.projectId} because it is locked`);
      }
      
      const updatedNote: Note = { 
        ...note, 
        ...updateData,
        updatedAt: new Date() 
      };
      
      this.notes.set(id, updatedNote);
      return updatedNote;
    } catch (error) {
      console.error("Error updating note in MemStorage:", error);
      throw error;
    }
  }

  async deleteNote(id: number, deleteChildren: boolean = true): Promise<boolean> {
    try {
      // Get the note to delete
      const noteToDelete = this.notes.get(id);
      if (!noteToDelete) return false;
      
      // Check if the project is locked
      const project = this.projects.get(noteToDelete.projectId);
      
      if (!project) {
        throw new Error(`Project with id ${noteToDelete.projectId} not found`);
      }
      
      if (project.isLocked) {
        throw new Error(`Cannot delete note in project ${noteToDelete.projectId} because it is locked`);
      }
      
      if (deleteChildren) {
        // Find and delete all children recursively
        const deleteDescendants = (parentId: number) => {
          const children = Array.from(this.notes.values()).filter(
            note => note.parentId === parentId
          );
          
          for (const child of children) {
            deleteDescendants(child.id); // Delete grandchildren
            this.notes.delete(child.id); // Delete the child
          }
        };
        
        deleteDescendants(id);
      } else {
        // Reassign all direct children to the parent of the note being deleted
        const childNotes = Array.from(this.notes.values()).filter(
          note => note.parentId === id
        );
        
        for (const child of childNotes) {
          this.notes.set(child.id, {
            ...child,
            parentId: noteToDelete.parentId,
            updatedAt: new Date()
          });
        }
      }
      
      // Delete the note itself
      const result = this.notes.delete(id);
      
      // If we reassigned children, normalize their order
      if (!deleteChildren) {
        await this.normalizeNoteOrders(noteToDelete.parentId);
      }
      
      return result;
    } catch (error) {
      console.error("Error deleting note in MemStorage:", error);
      throw error;
    }
  }

  async updateNoteOrder(id: number, order: number | string): Promise<boolean> {
    try {
      const note = this.notes.get(id);
      if (!note) return false;
      
      // Check if the project is locked
      const project = this.projects.get(note.projectId);
      
      if (!project) {
        throw new Error(`Project with id ${note.projectId} not found`);
      }
      
      if (project.isLocked) {
        throw new Error(`Cannot update note order in project ${note.projectId} because it is locked`);
      }
      
      // Store the parent for normalization
      const parentId = note.parentId;
      
      // Use the order value directly now that we're using numeric type
      const numericOrder = Number(order);
      
      // Update the note
      const updatedNote = { ...note, order: numericOrder, updatedAt: new Date() };
      this.notes.set(id, updatedNote);
      
      // Normalize orders of all siblings
      await this.normalizeNoteOrders(parentId);
      
      return true;
    } catch (error) {
      console.error("Error updating note order in MemStorage:", error);
      throw error;
    }
  }

  async updateNoteParent(id: number, parentId: number | null, order?: number | string): Promise<boolean> {
    try {
      const note = this.notes.get(id);
      if (!note) return false;
      
      // Check if the project is locked
      const project = this.projects.get(note.projectId);
      
      if (!project) {
        throw new Error(`Project with id ${note.projectId} not found`);
      }
      
      if (project.isLocked) {
        throw new Error(`Cannot update note parent in project ${note.projectId} because it is locked`);
      }
      
      // Store old parent for normalization later
      const oldParentId = note.parentId;
      
      let newOrder: number;
      
      if (order !== undefined) {
        // Use the order value directly (can be fractional now)
        newOrder = Number(order);
      } else {
        // Find max order value for new siblings to place this note at the end
        const newSiblings = Array.from(this.notes.values()).filter(
          (n: Note) => 
            n.projectId === note.projectId && 
            String(n.parentId) === String(parentId)
        );
        
        let maxOrder = -1;
        if (newSiblings.length > 0) {
          const orders = newSiblings.map(n => Number(n.order));
          maxOrder = Math.max(...orders);
        }
        
        newOrder = maxOrder + 1;
      }
      
      const updatedNote = { 
        ...note, 
        parentId, 
        order: newOrder,
        updatedAt: new Date() 
      };
      
      // Update the note with its new parent and order
      this.notes.set(id, updatedNote);
      
      // Normalize orders for both the old and new parent's children
      if (oldParentId !== parentId) {
        await this.normalizeNoteOrders(oldParentId);
      }
      await this.normalizeNoteOrders(parentId);
      
      return true;
    } catch (error) {
      console.error("Error updating note parent in MemStorage:", error);
      throw error;
    }
  }
  
  async updateNoteParentsBatch(updates: {id: number, parentId: number | null, order?: number | string}[]): Promise<boolean> {
    try {
      // Track unique parent IDs that need normalization after updates
      const parentsToNormalize = new Set<number | null>();
      // Track unique project IDs to check lock status
      const projectIds = new Set<number>();
      
      // First, collect all the notes and their project IDs
      const notesToUpdate: Array<{note: Note, parentId: number | null, order?: number | string}> = [];
      
      for (const update of updates) {
        const note = this.notes.get(update.id);
        if (!note) continue;
        
        notesToUpdate.push({
          note,
          parentId: update.parentId,
          order: update.order
        });
        
        projectIds.add(note.projectId);
      }
      
      // Check if any of the projects are locked
      for (const projectId of projectIds) {
        const project = this.projects.get(projectId);
        
        if (!project) {
          throw new Error(`Project with id ${projectId} not found`);
        }
        
        if (project.isLocked) {
          throw new Error(`Cannot update notes in project ${projectId} because it is locked`);
        }
      }
      
      // If no projects are locked, proceed with the updates
      for (let i = 0; i < notesToUpdate.length; i++) {
        const { note, parentId, order } = notesToUpdate[i];
        
        // Store old parent for normalization
        const oldParentId = note.parentId;
        if (oldParentId !== parentId) {
          parentsToNormalize.add(oldParentId);
        }
        parentsToNormalize.add(parentId);
        
        // Convert order to a number or use a default
        const orderValue = order !== undefined ? Number(order) : 999999;
        
        // Update the note with its new parent and order
        const updatedNote = { 
          ...note, 
          parentId, 
          order: orderValue,
          updatedAt: new Date() 
        };
        
        this.notes.set(note.id, updatedNote);
        
        // Log progress periodically
        if (i % 25 === 0 || i === notesToUpdate.length - 1) {
          console.log(`Batch parent update progress (memory): ${i + 1}/${notesToUpdate.length}`);
        }
      }
      
      // After all updates, normalize the order values for each affected parent
      // We skip this during large imports as it's done at the end
      if (notesToUpdate.length < 100) {
        for (const parentId of parentsToNormalize) {
          await this.normalizeNoteOrders(parentId);
        }
      }
      
      return true;
    } catch (error) {
      console.error("Error in batch update of note parents in MemStorage:", error);
      throw error; // Propagate the error to notify the caller about locked projects
    }
  }
  
  async normalizeNoteOrders(parentId: number | null): Promise<boolean> {
    try {
      // Get notes with the same parent, ordered by their current order
      const notesWithSameParent = Array.from(this.notes.values())
        .filter((note: Note) => String(note.parentId) === String(parentId))
        .sort((a, b) => Number(a.order) - Number(b.order));
      
      if (!notesWithSameParent.length) return true;
      
      // Reassign orders in sequence (0, 1, 2, etc.)
      notesWithSameParent.forEach((note, index) => {
        this.notes.set(note.id, {
          ...note,
          order: index,  // We can use integer values for normalized ordering
          updatedAt: new Date()
        });
      });
      
      return true;
    } catch (error) {
      console.error("Error normalizing note orders in MemStorage:", error);
      throw error;
    }
  }
  
  // Recursively normalize all notes in a project
  async normalizeAllProjectNotes(projectId: number): Promise<boolean> {
    try {
      console.log(`PROJECT NOTE NORMALIZATION (Memory): Starting for project ${projectId}`);
      
      // First get all notes in the project
      const allNotes = Array.from(this.notes.values())
        .filter(note => note.projectId === projectId);
      
      console.log(`PROJECT NOTE NORMALIZATION (Memory): Found ${allNotes.length} notes in project ${projectId}`);
      
      // Build a hierarchy map to identify all unique parent IDs
      const parentIds = new Set<number | null>();
      allNotes.forEach(note => {
        parentIds.add(note.parentId);
      });
      
      // Convert to array and ensure null (root) comes first for better handling
      const uniqueParentIds = Array.from(parentIds);
      if (uniqueParentIds.includes(null)) {
        // Remove null and add it to the front
        const nullIndex = uniqueParentIds.indexOf(null);
        uniqueParentIds.splice(nullIndex, 1);
        uniqueParentIds.unshift(null);
      }
      
      console.log(`PROJECT NOTE NORMALIZATION (Memory): Identified ${uniqueParentIds.length} unique parent levels to normalize`);
      
      // Normalize each parent ID group sequentially to avoid race conditions
      for (const parentId of uniqueParentIds) {
        console.log(`PROJECT NOTE NORMALIZATION (Memory): Normalizing notes with parent ${parentId === null ? 'ROOT' : parentId}`);
        await this.normalizeNoteOrders(parentId);
      }
      
      console.log(`PROJECT NOTE NORMALIZATION (Memory): Successfully normalized all notes in project ${projectId}`);
      return true;
    } catch (error) {
      console.error(`PROJECT NOTE NORMALIZATION ERROR (Memory) for project ${projectId}:`, error);
      return false;
    }
  }
}

// Switch from memory storage to database storage
export const storage = new DatabaseStorage();

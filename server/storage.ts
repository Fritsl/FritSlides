import { users, type User, type InsertUser, projects, type Project, type InsertProject, type UpdateProject, notes, type Note, type InsertNote, type UpdateNote } from "@shared/schema";
import session from "express-session";
import createMemoryStore from "memorystore";
import connectPg from "connect-pg-simple";
import { db } from "./db";
import { eq, and, desc, asc, isNull, sql } from "drizzle-orm";
import { client } from "./db";
import pg from "pg";

const MemoryStore = createMemoryStore(session);
const PostgresSessionStore = connectPg(session);

// Create a standard pg Pool for the session store
const pgPool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

export interface IStorage {
  // User operations
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Project operations
  getProjects(userId: number): Promise<Project[]>;
  getProject(id: number): Promise<Project | undefined>;
  createProject(project: InsertProject): Promise<Project>;
  updateProject(id: number, data: UpdateProject): Promise<Project | undefined>;
  deleteProject(id: number): Promise<boolean>;
  
  // Note operations
  getNotes(projectId: number): Promise<Note[]>;
  getNote(id: number): Promise<Note | undefined>;
  createNote(note: InsertNote): Promise<Note>;
  updateNote(id: number, note: UpdateNote): Promise<Note | undefined>;
  deleteNote(id: number): Promise<boolean>;
  updateNoteOrder(id: number, order: number | string): Promise<boolean>;
  updateNoteParent(id: number, parentId: number | null, order?: number | string): Promise<boolean>;
  normalizeNoteOrders(parentId: number | null): Promise<boolean>;
  
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

  // User operations
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  // Project operations
  async getProjects(userId: number): Promise<Project[]> {
    return await db.select().from(projects).where(eq(projects.userId, userId));
  }

  async getProject(id: number): Promise<Project | undefined> {
    const [project] = await db.select().from(projects).where(eq(projects.id, id));
    return project;
  }

  async createProject(insertProject: InsertProject): Promise<Project> {
    const [project] = await db.insert(projects).values(insertProject).returning();
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

  async deleteProject(id: number): Promise<boolean> {
    // Delete associated notes first (cascade deletion in database)
    await db.delete(notes).where(eq(notes.projectId, id));
    
    // Delete the project
    const deleted = await db.delete(projects).where(eq(projects.id, id)).returning();
    return deleted.length > 0;
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
      // Find max order value for siblings to place this note at the end
      const [maxOrderResult] = await db
        .select({ maxOrder: sql<number>`COALESCE(MAX(${notes.order}), -1)` })
        .from(notes)
        .where(and(
          eq(notes.projectId, insertNote.projectId),
          insertNote.parentId ? eq(notes.parentId, insertNote.parentId) : isNull(notes.parentId)
        ));
      
      const maxOrder = maxOrderResult?.maxOrder ?? -1;
      const order = insertNote.order ?? maxOrder + 1;
      
      const [note] = await db
        .insert(notes)
        .values({ ...insertNote, order })
        .returning();
      
      // Always normalize orders after creating a note to ensure consistent ordering
      await this.normalizeNoteOrders(insertNote.parentId);
      
      return note;
    } catch (error) {
      console.error("Error creating note:", error);
      throw error;
    }
  }

  async updateNote(id: number, updateData: UpdateNote): Promise<Note | undefined> {
    const [updatedNote] = await db
      .update(notes)
      .set({ ...updateData, updatedAt: new Date() })
      .where(eq(notes.id, id))
      .returning();
      
    // @ts-ignore - TypeScript issue with drizzle-orm return types
    return updatedNote;
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
  
  async normalizeNoteOrders(parentId: number | null): Promise<boolean> {
    try {
      // Get all notes with the same parent, ordered by their current order
      const notesWithSameParent = await db
        .select()
        .from(notes)
        .where(parentId ? eq(notes.parentId, parentId) : isNull(notes.parentId))
        .orderBy(notes.order);
      
      if (!notesWithSameParent.length) return true;
      
      // Use a transaction to ensure all updates happen atomically
      await db.transaction(async (tx) => {
        // Reassign orders in sequence (0, 1, 2, etc.)
        for (let i = 0; i < notesWithSameParent.length; i++) {
          const note = notesWithSameParent[i];
          await tx
            .update(notes)
            .set({ order: i, updatedAt: new Date() })
            .where(eq(notes.id, note.id));
        }
      });
      
      return true;
    } catch (error) {
      console.error("Error normalizing note orders:", error);
      throw error;
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
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
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

  async deleteProject(id: number): Promise<boolean> {
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
    const note = this.notes.get(id);
    if (!note) return undefined;
    
    const updatedNote: Note = { 
      ...note, 
      ...updateData,
      updatedAt: new Date() 
    };
    
    this.notes.set(id, updatedNote);
    return updatedNote;
  }

  async deleteNote(id: number, deleteChildren: boolean = true): Promise<boolean> {
    // Get the note to delete
    const noteToDelete = this.notes.get(id);
    if (!noteToDelete) return false;
    
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
  }

  async updateNoteOrder(id: number, order: number | string): Promise<boolean> {
    try {
      const note = this.notes.get(id);
      if (!note) return false;
      
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
}

// Switch from memory storage to database storage
export const storage = new DatabaseStorage();

import { users, type User, type InsertUser, projects, type Project, type InsertProject, notes, type Note, type InsertNote, type UpdateNote } from "@shared/schema";
import session from "express-session";
import createMemoryStore from "memorystore";

const MemoryStore = createMemoryStore(session);

export interface IStorage {
  // User operations
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Project operations
  getProjects(userId: number): Promise<Project[]>;
  getProject(id: number): Promise<Project | undefined>;
  createProject(project: InsertProject): Promise<Project>;
  updateProject(id: number, name: string): Promise<Project | undefined>;
  deleteProject(id: number): Promise<boolean>;
  
  // Note operations
  getNotes(projectId: number): Promise<Note[]>;
  getNote(id: number): Promise<Note | undefined>;
  createNote(note: InsertNote): Promise<Note>;
  updateNote(id: number, note: UpdateNote): Promise<Note | undefined>;
  deleteNote(id: number): Promise<boolean>;
  updateNoteOrder(id: number, order: number): Promise<boolean>;
  updateNoteParent(id: number, parentId: number | null): Promise<boolean>;
  
  // Session store
  sessionStore: session.SessionStore;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private projects: Map<number, Project>;
  private notes: Map<number, Note>;
  currentUserId: number;
  currentProjectId: number;
  currentNoteId: number;
  sessionStore: session.SessionStore;

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

  async updateProject(id: number, name: string): Promise<Project | undefined> {
    const project = this.projects.get(id);
    if (!project) return undefined;
    
    const updatedProject = { ...project, name };
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
    const id = this.currentNoteId++;
    const now = new Date();
    
    // Find max order value for siblings to place this note at the end
    const siblings = Array.from(this.notes.values()).filter(
      note => note.projectId === insertNote.projectId && 
      note.parentId === insertNote.parentId
    );
    
    const maxOrder = siblings.length > 0 
      ? Math.max(...siblings.map(n => n.order)) 
      : -1;
    
    const order = insertNote.order ?? maxOrder + 1;
    
    const note: Note = { 
      ...insertNote, 
      id, 
      order,
      createdAt: now,
      updatedAt: now 
    };
    
    this.notes.set(id, note);
    return note;
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

  async deleteNote(id: number): Promise<boolean> {
    // Get the note to delete
    const noteToDelete = this.notes.get(id);
    if (!noteToDelete) return false;
    
    // Find and delete all children recursively
    const deleteChildren = (parentId: number) => {
      const children = Array.from(this.notes.values()).filter(
        note => note.parentId === parentId
      );
      
      for (const child of children) {
        deleteChildren(child.id); // Delete grandchildren
        this.notes.delete(child.id); // Delete the child
      }
    };
    
    deleteChildren(id);
    
    // Delete the note itself
    return this.notes.delete(id);
  }

  async updateNoteOrder(id: number, order: number): Promise<boolean> {
    const note = this.notes.get(id);
    if (!note) return false;
    
    const updatedNote = { ...note, order, updatedAt: new Date() };
    this.notes.set(id, updatedNote);
    return true;
  }

  async updateNoteParent(id: number, parentId: number | null): Promise<boolean> {
    const note = this.notes.get(id);
    if (!note) return false;
    
    // Find max order value for new siblings to place this note at the end
    const newSiblings = Array.from(this.notes.values()).filter(
      n => n.projectId === note.projectId && n.parentId === parentId
    );
    
    const maxOrder = newSiblings.length > 0 
      ? Math.max(...newSiblings.map(n => n.order)) 
      : -1;
    
    const updatedNote = { 
      ...note, 
      parentId, 
      order: maxOrder + 1,
      updatedAt: new Date() 
    };
    
    this.notes.set(id, updatedNote);
    return true;
  }
}

export const storage = new MemStorage();

import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth } from "./auth";
import multer from "multer";
import { db } from "./db";
import { sql } from "drizzle-orm";
import { User } from "../shared/schema";

// Helper function to escape special characters in strings used in regular expressions
function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
}
import { insertProjectSchema, updateProjectSchema, insertNoteSchema, updateNoteSchema } from "@shared/schema";
import fs from "fs";
import path from "path";
import { randomBytes } from "crypto";
import { ImportData, ImportedNote, convertImportedNoteToInsert } from "./types";

// Configure multer for file uploads
const storage_dir = path.join(process.cwd(), "uploads");
// Create the upload directory if it doesn't exist
if (!fs.existsSync(storage_dir)) {
  fs.mkdirSync(storage_dir, { recursive: true });
}

const upload = multer({
  storage: multer.diskStorage({
    destination: function(req, file, cb) {
      cb(null, storage_dir);
    },
    filename: function(req, file, cb) {
      // Generate a unique filename
      const uniqueSuffix = `${Date.now()}-${randomBytes(6).toString('hex')}`;
      const ext = path.extname(file.originalname);
      cb(null, `${uniqueSuffix}${ext}`);
    }
  }),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept only image files
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed"));
    }
  }
});

import { getSupabaseClient, getSupabaseUser, createSupabaseUser, updateSupabaseUserLastProject } from './supabase-storage';

// Authentication middleware
async function isAuthenticated(req: Request, res: Response, next: Function) {
  // For Supabase authentication, we'll check if the request contains a valid user ID in a header
  // This is a temporary solution until we fully implement Supabase authentication on the server
  
  // Log all headers for debugging (except sensitive ones)
  const safeHeaders = { ...req.headers };
  delete safeHeaders.authorization;
  delete safeHeaders.cookie;
  console.log(`Authentication headers:`, JSON.stringify(safeHeaders));
  
  if (req.headers['x-supabase-user-id']) {
    // If Supabase user ID is provided in header, use it
    const supabaseUserId = req.headers['x-supabase-user-id'] as string;
    
    // Verify the user exists in Supabase using the service role key (which bypasses RLS)
    try {
      // Get the Supabase admin client using the service role key
      const supabase = await getSupabaseClient();
      
      if (supabase) {
        console.log("SUPABASE_SERVICE_ROLE_KEY is available and Supabase client created");
        
        // Using the admin client to verify user exists (bypasses RLS)
        const { data: userData, error } = await supabase
          .from('users')
          .select('*')
          .eq('id', supabaseUserId)
          .single();
        
        if (error) {
          console.error("Error verifying user with Supabase admin client:", error);
        }
        
        console.log("Supabase direct user lookup result:", userData ? "User found" : "User NOT found");
        
        // If user doesn't exist in Supabase, create it using our SQL database
        if (!userData) {
          console.log(`User ${supabaseUserId} not found in Supabase, will fall back to local DB`);
        }
      } else {
        console.log("SUPABASE_SERVICE_ROLE_KEY is available but Supabase client creation failed");
      }
    } catch (err) {
      console.error("Error attempting to verify user with Supabase:", err);
    }
    
    // Set up the user object that the rest of the code expects
    req.user = {
      id: supabaseUserId,
      username: req.headers['x-supabase-user-email'] as string || supabaseUserId,
      password: null, // Password not needed for Supabase users
      lastOpenedProjectId: null
    };
    
    console.log("Authenticated with Supabase user ID:", supabaseUserId);
    return next();
  } 
  else if (req.isAuthenticated && req.isAuthenticated()) {
    // Fallback to local passport authentication (will be removed in the future)
    console.log("Authenticated with passport authentication");
    return next();
  }
  
  console.log("Authentication failed - no valid auth method found");
  return res.status(401).json({ message: "Unauthorized - No valid authentication found" });
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup authentication routes
  setupAuth(app);

  // Get user's last opened project
  app.get("/api/user/lastProject", isAuthenticated, async (req, res) => {
    try {
      // Ensure userId is a string
      const userId = String(req.user!.id);
      const userEmail = req.headers['x-supabase-user-email'] as string || null;
      
      // Log the user ID for debugging
      console.log(`Getting last project for user: ${userId} (${typeof userId})`);
      
      // First, try to get user directly from Supabase using service role key
      // This bypasses RLS completely
      let user = await getSupabaseUser(userId);
      
      // If not found in Supabase, try our local database
      if (!user) {
        console.log(`User ${userId} not found in Supabase, checking local database`);
        user = await storage.getUser(userId);
        
        // If still not found, create the user in both Supabase and our local database
        if (!user && req.headers['x-supabase-user-id']) {
          console.log(`User ${userId} not found in local database either - creating new user record`);
          
          // First, try to create in Supabase
          const supabaseUser = await createSupabaseUser(userId, userEmail);
          
          if (supabaseUser) {
            console.log(`Successfully created user ${userId} in Supabase`);
            user = supabaseUser;
          } else {
            console.log(`Failed to create user in Supabase, falling back to local database creation only`);
            
            // Create user in our local database
            try {
              user = await storage.createUser({
                id: userId,
                username: userEmail || `user_${userId.substring(0, 8)}`,
                password: null, // Password not needed for Supabase users
                lastOpenedProjectId: null
              });
              console.log(`Successfully created user with ID: ${user.id} in local database`);
            } catch (createErr: any) {
              // If error is a duplicate key violation, try to fetch the user again
              // as it might have been created in a race condition
              console.error("Error creating user:", createErr);
              if (createErr.message && createErr.message.includes('duplicate key')) {
                console.log('User creation failed due to duplicate key - attempting to fetch existing user');
                
                // One more try with storage method
                user = await storage.getUser(userId);
              } else {
                console.error("Error creating user from Supabase auth:", createErr);
                return res.status(500).json({ message: "Failed to create user" });
              }
            }
          }
        }
      } else {
        console.log(`Found user ${userId} in Supabase with lastOpenedProjectId: ${user.lastOpenedProjectId}`);
      }
      
      if (!user) {
        console.log(`User ${userId} still not found after creation attempts in both Supabase and local database`);
        // For debugging purposes, return a 404 with more details
        return res.status(404).json({ 
          message: "User not found", 
          userId: userId,
          debug: "User could not be found in both Supabase and local database after multiple attempts"
        });
      }
      
      // Log the result for debugging
      console.log(`Found user ${user.id} with lastOpenedProjectId: ${user.lastOpenedProjectId}`);
      
      res.json({ lastOpenedProjectId: user.lastOpenedProjectId });
    } catch (err) {
      console.error("Error getting last project:", err);
      res.status(500).json({ message: "Failed to get last opened project", error: String(err) });
    }
  });

  // Supabase credentials
  app.get("/api/supabase-credentials", async (req, res) => {
    try {
      // Check for environment variables - try both with and without VITE_ prefix
      let supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
      
      // TEMPORARY FIX: Hard-code the correct Supabase URL
      // This is based on the project ID extracted from the existing URL
      if (supabaseUrl) {
        // Extract the project ID regardless of the current domain
        const projectIdMatch = supabaseUrl.match(/https:\/\/([^.]+)/);
        if (projectIdMatch && projectIdMatch[1]) {
          const projectId = projectIdMatch[1];
          // Override with the correct URL format
          supabaseUrl = `https://${projectId}.supabase.co`;
          console.log(`Ensuring correct Supabase URL format: https://${projectId}.supabase.co`);
        }
      }
      
      console.log('Supabase env variables status:', {
        urlPresent: !!supabaseUrl, 
        anonKeyPresent: !!supabaseAnonKey,
        urlFormat: supabaseUrl ? supabaseUrl.substring(0, 15) + '...' : 'none'
      });
      
      if (!supabaseUrl || !supabaseAnonKey) {
        return res.status(500).json({ 
          message: "Supabase configuration is missing",
          url: null,
          anonKey: null
        });
      }
      
      // Return the credentials
      res.json({
        url: supabaseUrl,
        anonKey: supabaseAnonKey
      });
    } catch (error) {
      console.error("Error fetching Supabase credentials:", error);
      res.status(500).json({ message: "Failed to fetch Supabase credentials" });
    }
  });

  // Project routes
  app.get("/api/projects", isAuthenticated, async (req, res) => {
    try {
      const projects = await storage.getProjects(req.user!.id);
      res.json(projects);
    } catch (err) {
      res.status(500).json({ message: "Failed to get projects" });
    }
  });
  
  app.get("/api/projects/:id", isAuthenticated, async (req, res) => {
    try {
      const projectId = parseInt(req.params.id);
      
      // Check if project exists and belongs to user
      const project = await storage.getProject(projectId);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }
      
      if (project.userId !== req.user!.id) {
        return res.status(403).json({ message: "Not authorized to access this project" });
      }
      
      res.json(project);
    } catch (err) {
      console.error("Error getting project:", err);
      res.status(500).json({ message: "Failed to get project" });
    }
  });

  app.post("/api/projects", isAuthenticated, async (req, res) => {
    try {
      // First, ensure the user exists in our database
      let user = await storage.getUser(req.user!.id);
      
      // If the user doesn't exist yet (first time Supabase user), create them
      if (!user && req.headers['x-supabase-user-id']) {
        console.log(`Creating user record for Supabase user: ${req.user!.id}`);
        try {
          user = await storage.createUser({
            id: String(req.user!.id),
            username: `user_${String(req.user!.id).substring(0, 8)}`,
            password: null, // Password not needed for Supabase users
            lastOpenedProjectId: null
          });
          console.log(`Successfully created user record for Supabase user: ${req.user!.id}`);
        } catch (createErr) {
          console.error("Error creating user from Supabase auth:", createErr);
          return res.status(500).json({ message: "Failed to create user record" });
        }
      }
      
      // Check if we're duplicating from an existing project
      if (req.body.duplicateFromId) {
        const sourceId = parseInt(req.body.duplicateFromId);
        if (isNaN(sourceId)) {
          return res.status(400).json({ message: "Invalid source project ID" });
        }
        
        // Get the source project data
        const sourceProject = await storage.getProject(sourceId);
        if (!sourceProject) {
          return res.status(404).json({ message: "Source project not found" });
        }
        
        // Verify user owns the source project
        if (sourceProject.userId !== req.user!.id) {
          return res.status(403).json({ message: "Not authorized to duplicate this project" });
        }
        
        // Generate a unique name for the copy - simplified approach
        const sourceName = sourceProject.name;
        let newName;
        
        // Use provided name if given, otherwise base on source
        if (req.body.name) {
          newName = req.body.name;
        } else {
          // Always append " (Copy)" to the source name
          newName = `${sourceName} (Copy)`;
        }
        
        // Make sure name is unique
        const userProjects = await storage.getProjects(req.user!.id);
        if (userProjects.some(p => p.name === newName)) {
          // If the name already exists, add a timestamp for uniqueness
          const timestamp = new Date().toISOString().slice(11, 19).replace(/:/g, '-');
          newName = `${newName} ${timestamp}`;
        }
        
        console.log(`PROJECT DUPLICATION: Using name "${newName}" for duplicated project`);
        
        // Create new project with the same settings but new name
        const newProject = await storage.createProject({
          userId: req.user!.id,
          name: newName,
          startSlogan: sourceProject.startSlogan,
          endSlogan: sourceProject.endSlogan,
          author: sourceProject.author
        });
        
        // Update the last opened project to the new project
        await storage.updateLastOpenedProject(req.user!.id, newProject.id);
        
        // Get all notes from the source project
        // IMPORTANT CHANGE: Now we do the duplication synchronously before responding
        try {
          console.log(`PROJECT DUPLICATION: Starting synchronous duplication of project ${sourceId} to ${newProject.id}`);
          
          // Get source notes
          const sourceNotes = await storage.getNotes(sourceId);
          if (sourceNotes && sourceNotes.length > 0) {
            console.log(`PROJECT DUPLICATION: Found ${sourceNotes.length} notes to duplicate from project ${sourceId} to ${newProject.id}`);
            
            // Maps original IDs to new IDs
            const idMap = new Map<number, number>(); 
            
            // First, create a complete, structured representation of the notes
            interface NoteWithChildren {
              note: any;
              children: NoteWithChildren[];
            }
            
            // Build a map of notes by ID
            const notesById = new Map();
            sourceNotes.forEach(note => notesById.set(note.id, { note, children: [] }));
            
            // Build the tree structure
            const rootNotes: NoteWithChildren[] = [];
            sourceNotes.forEach(note => {
              const noteWrapper = notesById.get(note.id);
              if (note.parentId === null) {
                // Root note
                rootNotes.push(noteWrapper);
                console.log(`PROJECT DUPLICATION: Adding root note ID ${note.id} to tree`);
              } else {
                // Child note
                const parent = notesById.get(note.parentId);
                if (parent) {
                  parent.children.push(noteWrapper);
                  console.log(`PROJECT DUPLICATION: Adding note ID ${note.id} as child of ${note.parentId}`);
                } else {
                  // Parent not found, treat as root
                  rootNotes.push(noteWrapper);
                  console.log(`PROJECT DUPLICATION: Note ID ${note.id} has parent ${note.parentId} but parent not found, treating as root`);
                }
              }
            });
            
            console.log(`PROJECT DUPLICATION: Built tree with ${rootNotes.length} root notes`);
            
            // Recursive function to duplicate a note and all its children
            async function duplicateNoteTree(noteWrapper: NoteWithChildren, parentId: number | null): Promise<void> {
              const { note, children } = noteWrapper;
              
              try {
                // Create the new note
                const contentPreview = note.content.substring(0, 30) + (note.content.length > 30 ? "..." : "");
                console.log(`PROJECT DUPLICATION: Creating note with content "${contentPreview}" and parent ${parentId}`);
                
                const newNote = await storage.createNote({
                  projectId: newProject.id,
                  content: note.content,
                  parentId: parentId, // Set correct parent immediately
                  url: note.url,
                  linkText: note.linkText,
                  youtubeLink: note.youtubeLink,
                  time: note.time,
                  isDiscussion: note.isDiscussion,
                  images: note.images,
                  order: note.order
                });
                
                // Store the mapping from old ID to new ID
                console.log(`PROJECT DUPLICATION: Created note ${newNote.id} for original ${note.id} with parent ${parentId}`);
                idMap.set(note.id, newNote.id);
                
                // Recursively duplicate all children
                console.log(`PROJECT DUPLICATION: Note ${note.id} has ${children.length} children to duplicate`);
                for (let i = 0; i < children.length; i++) {
                  await duplicateNoteTree(children[i], newNote.id);
                }
              } catch (error) {
                console.error(`PROJECT DUPLICATION ERROR: Failed duplicating note ${note.id}:`, error);
                throw error; // Propagate error to abort the duplication
              }
            }
            
            // Start the duplication with root notes
            console.log(`PROJECT DUPLICATION: Starting duplication of ${rootNotes.length} root notes`);
            for (let i = 0; i < rootNotes.length; i++) {
              console.log(`PROJECT DUPLICATION: Duplicating root note ${i + 1} of ${rootNotes.length}`);
              await duplicateNoteTree(rootNotes[i], null);
            }
            
            // Normalize ALL note orders in the entire project
            console.log(`PROJECT DUPLICATION: Normalizing all note orders in project ${newProject.id}`);
            await storage.normalizeAllProjectNotes(newProject.id);
            
            console.log(`PROJECT DUPLICATION: Complete! ${sourceNotes.length} notes copied with correct hierarchy.`);
          } else {
            console.log(`PROJECT DUPLICATION: No notes found in source project ${sourceId}`);
          }
          
          // Successfully duplicated, return the new project
          console.log(`PROJECT DUPLICATION: Returning new project with ID ${newProject.id}`);
          return res.status(201).json({
            ...newProject,
            notesCopied: sourceNotes ? sourceNotes.length : 0
          });
          
        } catch (error) {
          console.error("PROJECT DUPLICATION CRITICAL ERROR:", error);
          
          // If we already created a project but failed to copy notes, delete the incomplete project
          try {
            console.log(`PROJECT DUPLICATION: Cleaning up incomplete project ${newProject.id} due to error`);
            await storage.deleteProject(newProject.id);
          } catch (cleanupError) {
            console.error("PROJECT DUPLICATION: Error during cleanup:", cleanupError);
          }
          
          return res.status(500).json({ 
            message: "Failed to duplicate project notes",
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }
      
      // Normal project creation (not a duplication)
      const result = insertProjectSchema.safeParse({
        ...req.body,
        userId: req.user!.id,
      });
      
      if (!result.success) {
        return res.status(400).json({ message: "Invalid project data", errors: result.error.format() });
      }
      
      const project = await storage.createProject(result.data);
      
      // Update the last opened project
      await storage.updateLastOpenedProject(req.user!.id, project.id);
      
      res.status(201).json(project);
    } catch (err) {
      console.error("Error creating project:", err);
      res.status(500).json({ message: "Failed to create project" });
    }
  });

  app.put("/api/projects/:id", isAuthenticated, async (req, res) => {
    try {
      const projectId = parseInt(req.params.id);
      
      // Check if project exists and belongs to user
      const project = await storage.getProject(projectId);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }
      
      if (project.userId !== req.user!.id) {
        return res.status(403).json({ message: "Not authorized to update this project" });
      }
      
      const result = updateProjectSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ message: "Invalid project data", errors: result.error.format() });
      }
      
      const updatedProject = await storage.updateProject(projectId, result.data);
      res.json(updatedProject);
    } catch (err) {
      res.status(500).json({ message: "Failed to update project" });
    }
  });

  // Update the last viewed slide index for a project
  app.put("/api/projects/:id/lastViewedSlideIndex", isAuthenticated, async (req, res) => {
    try {
      const projectId = parseInt(req.params.id);
      const { slideIndex } = req.body;
      
      if (slideIndex === undefined || isNaN(parseInt(slideIndex))) {
        return res.status(400).json({ message: "Invalid slide index" });
      }
      
      // Check if project exists and belongs to user
      const project = await storage.getProject(projectId);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }
      
      if (project.userId !== req.user!.id) {
        return res.status(403).json({ message: "Not authorized to access this project" });
      }
      
      const success = await storage.updateLastViewedSlideIndex(projectId, parseInt(slideIndex));
      if (success) {
        res.status(200).json({ message: "Last viewed slide index updated successfully" });
      } else {
        res.status(500).json({ message: "Failed to update last viewed slide index" });
      }
    } catch (err) {
      console.error("Error updating last viewed slide index:", err);
      res.status(500).json({ message: "Failed to update last viewed slide index" });
    }
  });

  app.delete("/api/projects/:id", isAuthenticated, async (req, res) => {
    try {
      const projectId = parseInt(req.params.id);
      
      // Check if project exists and belongs to user
      const project = await storage.getProject(projectId);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }
      
      if (project.userId !== req.user!.id) {
        return res.status(403).json({ message: "Not authorized to delete this project" });
      }
      
      await storage.deleteProject(projectId);
      res.sendStatus(204);
    } catch (err) {
      res.status(500).json({ message: "Failed to delete project" });
    }
  });

  // Note routes
  app.get("/api/projects/:projectId/notes", isAuthenticated, async (req, res) => {
    try {
      const projectId = parseInt(req.params.projectId);
      
      // Check if project exists and belongs to user
      const project = await storage.getProject(projectId);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }
      
      if (project.userId !== req.user!.id) {
        return res.status(403).json({ message: "Not authorized to access this project's notes" });
      }
      
      // Update the last opened project ID for this user
      await storage.updateLastOpenedProject(req.user!.id, projectId);
      
      const notes = await storage.getNotes(projectId);
      res.json(notes);
    } catch (err) {
      res.status(500).json({ message: "Failed to get notes" });
    }
  });

  app.post("/api/projects/:projectId/notes", isAuthenticated, async (req, res) => {
    try {
      // Start measuring server processing time
      const startTime = Date.now();
      
      const projectId = parseInt(req.params.projectId);
      
      // Check if project exists and belongs to user
      const project = await storage.getProject(projectId);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }
      
      if (project.userId !== req.user!.id) {
        return res.status(403).json({ message: "Not authorized to add notes to this project" });
      }
      
      // Track project check time
      const projectCheckTime = Date.now() - startTime;
      
      const result = insertNoteSchema.safeParse({
        ...req.body,
        projectId,
      });
      
      if (!result.success) {
        return res.status(400).json({ message: "Invalid note data", errors: result.error.format() });
      }
      
      // Record validation time
      const validationTime = Date.now() - startTime - projectCheckTime;
      
      // Performance enhancement: Use Promise.resolve().then() to make the actual database
      // operation asynchronous while immediately sending back the response
      // This reduces perceived latency dramatically
      
      // Create the note
      const notePromise = storage.createNote(result.data);
      
      // For super fast response, we can respond immediately with a "creating" status
      // and let the client handle the optimistic UI update
      if (req.body.fastCreate === true) {
        // Log processing time before returning response
        const responseTime = Date.now() - startTime;
        console.log(`NOTE CREATION PERF: Project check: ${projectCheckTime}ms, Validation: ${validationTime}ms, Total server prep: ${responseTime}ms`);
        
        // Get the note and immediately send it back without waiting for normalization to complete
        const note = await notePromise;
        
        // Log total processing time before sending response
        const totalTime = Date.now() - startTime;
        console.log(`NOTE CREATION PERF: Total time before response: ${totalTime}ms`);
        
        // Send the response immediately
        res.status(201).json(note);
        
        // No need to wait for this request to complete
        // NOTE: This will make the operation complete after the response is sent
        // Any normalization happens after client gets the response
        return;
      }
      
      // Standard flow - wait for note creation to complete
      const note = await notePromise;
      
      // Log total processing time before sending response
      const totalTime = Date.now() - startTime;
      console.log(`NOTE CREATION PERF: Total server processing time: ${totalTime}ms`);
      
      res.status(201).json(note);
    } catch (err) {
      console.error("Error creating note:", err);
      res.status(500).json({ message: "Failed to create note" });
    }
  });

  app.put("/api/notes/:id", isAuthenticated, async (req, res) => {
    try {
      const noteId = parseInt(req.params.id);
      
      // Check if note exists and belongs to user's project
      const note = await storage.getNote(noteId);
      if (!note) {
        return res.status(404).json({ message: "Note not found" });
      }
      
      const project = await storage.getProject(note.projectId);
      if (!project || project.userId !== req.user!.id) {
        return res.status(403).json({ message: "Not authorized to update this note" });
      }
      
      const result = updateNoteSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ message: "Invalid note data", errors: result.error.format() });
      }
      
      const updatedNote = await storage.updateNote(noteId, result.data);
      res.json(updatedNote);
    } catch (err) {
      res.status(500).json({ message: "Failed to update note" });
    }
  });

  app.delete("/api/notes/:id", isAuthenticated, async (req, res) => {
    try {
      const noteId = parseInt(req.params.id);
      // Default to not deleting children unless explicitly requested
      const deleteChildren = req.query.deleteChildren === 'true';
      
      // Check if note exists and belongs to user's project
      const note = await storage.getNote(noteId);
      if (!note) {
        return res.status(404).json({ message: "Note not found" });
      }
      
      const project = await storage.getProject(note.projectId);
      if (!project || project.userId !== req.user!.id) {
        return res.status(403).json({ message: "Not authorized to delete this note" });
      }
      
      // Attempt to delete the note
      const result = await storage.deleteNote(noteId, deleteChildren);
      
      if (result) {
        res.sendStatus(204);
      } else {
        res.status(404).json({ message: "Note could not be deleted or was not found" });
      }
    } catch (err) {
      console.error("Error deleting note:", err);
      res.status(500).json({ message: "Failed to delete note" });
    }
  });

  // Update note parent (for drag-and-drop reorganizing)
  app.put("/api/notes/:id/parent", isAuthenticated, async (req, res) => {
    try {
      const noteId = parseInt(req.params.id);
      const { parentId, order } = req.body;
      
      // Check if note exists and belongs to user's project
      const note = await storage.getNote(noteId);
      if (!note) {
        return res.status(404).json({ message: "Note not found" });
      }
      
      const project = await storage.getProject(note.projectId);
      if (!project || project.userId !== req.user!.id) {
        return res.status(403).json({ message: "Not authorized to update this note" });
      }
      
      // If parentId is provided, make sure it exists and is in the same project
      if (parentId !== null && parentId !== undefined) {
        const parentNote = await storage.getNote(parseInt(parentId));
        if (!parentNote || parentNote.projectId !== note.projectId) {
          return res.status(400).json({ message: "Invalid parent note" });
        }
        
        // Prevent circular references
        let current = parentNote;
        while (current.parentId) {
          if (current.parentId === noteId) {
            return res.status(400).json({ message: "Cannot create circular parent-child relationship" });
          }
          const parent = await storage.getNote(current.parentId);
          if (!parent) break;
          current = parent;
        }
      }
      
      // Update parent and order if both are provided
      if (order !== undefined) {
        const result = await storage.updateNoteParent(noteId, parentId !== null ? parseInt(parentId) : null, order);
        if (!result) {
          return res.status(500).json({ message: "Failed to update note parent" });
        }
        // After updating parent with order, we need to adjust orders of siblings
        await storage.normalizeNoteOrders(parentId !== null ? parseInt(parentId) : null);
      } else {
        // Just update parent
        const result = await storage.updateNoteParent(noteId, parentId !== null ? parseInt(parentId) : null);
        if (!result) {
          return res.status(500).json({ message: "Failed to update note parent" });
        }
      }
      
      return res.sendStatus(200);
    } catch (err) {
      console.error("Error updating note parent:", err);
      return res.status(500).json({ message: "Failed to update note parent" });
    }
  });

  // Update note order (for drag-and-drop reordering)
  app.put("/api/notes/:id/order", isAuthenticated, async (req, res) => {
    try {
      const noteId = parseInt(req.params.id);
      const { order } = req.body;
      
      // Check if note exists and belongs to user's project
      const note = await storage.getNote(noteId);
      if (!note) {
        return res.status(404).json({ message: "Note not found" });
      }
      
      const project = await storage.getProject(note.projectId);
      if (!project || project.userId !== req.user!.id) {
        return res.status(403).json({ message: "Not authorized to update this note" });
      }
      
      const result = await storage.updateNoteOrder(noteId, order);
      if (!result) {
        return res.status(500).json({ message: "Failed to update note order" });
      }
      return res.sendStatus(200);
    } catch (err) {
      console.error("Error updating note order:", err);
      return res.status(500).json({ message: "Failed to update note order" });
    }
  });

  // Image upload
  app.post("/api/upload", isAuthenticated, upload.single("image"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }
      
      // First store locally as before, so we have backward compatibility
      const localImageUrl = `/api/images/${req.file.filename}`;
      
      // Try to upload to Supabase storage if available
      try {
        // Dynamic import to avoid circular dependencies
        const { uploadToSupabaseStorage } = await import('./supabase-storage');
        
        // Upload the file to Supabase
        const supabaseUrl = await uploadToSupabaseStorage(req.file.path);
        
        // If successful, return the Supabase URL
        if (supabaseUrl) {
          console.log(`Image uploaded to Supabase storage: ${supabaseUrl}`);
          return res.status(201).json({ 
            imageUrl: supabaseUrl,
            storedIn: 'supabase' 
          });
        }
      } catch (supabaseError) {
        // Log the error but don't fail - fall back to local storage
        console.error("Error uploading to Supabase (falling back to local):", supabaseError);
      }
      
      // Fall back to local URL if Supabase upload fails
      console.log(`Image stored locally: ${localImageUrl}`);
      return res.status(201).json({ 
        imageUrl: localImageUrl,
        storedIn: 'local' 
      });
    } catch (err) {
      console.error("Error uploading image:", err);
      return res.status(500).json({ message: "Failed to upload image" });
    }
  });

  // Serve uploaded images
  app.get("/api/images/:filename", (req, res) => {
    try {
      const filename = req.params.filename;
      const filepath = path.join(storage_dir, filename);
      
      // Check if file exists
      if (fs.existsSync(filepath)) {
        return res.sendFile(filepath);
      } else {
        console.log(`Image not found: ${filename}`);
        
        // Send not-found image data instead of JSON error
        // This allows images to gracefully degrade in the browser
        // instead of triggering error events
        
        // Set appropriate headers for a transparent 1x1 PNG
        res.setHeader('Content-Type', 'image/png');
        res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour
        res.setHeader('X-Image-Missing', 'true'); // Custom header to flag missing images
        
        // Send a transparent 1x1 PNG (minimal base64 encoded)
        const transparentPixel = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');
        return res.send(transparentPixel);
      }
    } catch (err) {
      console.error("Error serving image:", err);
      
      // Same fallback for errors
      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Cache-Control', 'public, max-age=3600');
      res.setHeader('X-Image-Error', 'true');
      
      const transparentPixel = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');
      return res.send(transparentPixel);
    }
  });

  // Export notes from a project
  app.get("/api/projects/:projectId/export", isAuthenticated, async (req, res) => {
    try {
      const projectId = parseInt(req.params.projectId);
      
      // Check if project exists and belongs to the user
      const project = await storage.getProject(projectId);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }
      
      if (project.userId !== req.user!.id) {
        return res.status(403).json({ message: "Not authorized to export this project" });
      }
      
      // Get all notes for the project
      const notes = await storage.getNotes(projectId);
      
      // Format the timestamp for the filename
      const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
      const filename = `${project.name.replace(/\s+/g, '_')}_${timestamp}.json`;
      
      // Set headers for file download
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
      
      // Send the notes as a JSON file
      return res.json({ project: { name: project.name }, notes });
    } catch (err) {
      console.error("Error exporting notes:", err);
      return res.status(500).json({ message: "Failed to export notes" });
    }
  });
  
  // Export notes as plain text
  app.get("/api/projects/:projectId/export-text", isAuthenticated, async (req, res) => {
    try {
      const projectId = parseInt(req.params.projectId);
      
      // Check if project exists and belongs to the user
      const project = await storage.getProject(projectId);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }
      
      if (project.userId !== req.user!.id) {
        return res.status(403).json({ message: "Not authorized to export this project" });
      }
      
      // Get all notes for the project
      const notes = await storage.getNotes(projectId);
      
      // Create a map of notes by parent ID to build the hierarchy
      const notesByParent = new Map<number | null, Note[]>();
      notes.forEach(note => {
        if (!notesByParent.has(note.parentId)) {
          notesByParent.set(note.parentId, []);
        }
        notesByParent.get(note.parentId)!.push(note);
      });
      
      // Sort notes at each level by their order
      for (const [parentId, children] of notesByParent.entries()) {
        children.sort((a, b) => {
          const aOrder = parseFloat(String(a.order));
          const bOrder = parseFloat(String(b.order));
          return aOrder - bOrder;
        });
      }
      
      // Generate formatted text with proper indentation
      let textContent = `# ${project.name}\n`;
      if (project.author) {
        textContent += `Author: ${project.author}\n`;
      }
      textContent += `Exported: ${new Date().toLocaleString()}\n\n`;
      
      // Recursive function to build the text content
      function buildTextContent(parentId: number | null, level: number): string {
        const children = notesByParent.get(parentId) || [];
        let content = '';
        
        for (const note of children) {
          // Create the indentation based on the level
          const indent = '  '.repeat(level);
          
          // Add the note content with proper indentation
          content += `${indent}- ${note.content.replace(/\n/g, `\n${indent}  `)}\n`;
          
          // Add URL if available
          if (note.url) {
            content += `${indent}  [Link: ${note.linkText || note.url}](${note.url})\n`;
          }
          
          // Add YouTube link and time if available
          if (note.youtubeLink) {
            const timeInfo = note.time ? ` (at ${note.time})` : '';
            content += `${indent}  [YouTube${timeInfo}](${note.youtubeLink})\n`;
          } else if (note.time) {
            content += `${indent}  Time: ${note.time}\n`;
          }
          
          // Add images if available
          if (note.images && note.images.length > 0) {
            for (const image of note.images) {
              content += `${indent}  [Image](${image})\n`;
            }
          }
          
          // Recursively add children with increased indentation
          content += buildTextContent(note.id, level + 1);
        }
        
        return content;
      }
      
      // Start building content from the root
      textContent += buildTextContent(null, 0);
      
      // Format the timestamp for the filename
      const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
      const filename = `${project.name.replace(/\s+/g, '_')}_${timestamp}.txt`;
      
      // Set headers for file download
      res.setHeader('Content-Type', 'text/plain');
      res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
      
      // Send the text content
      return res.send(textContent);
    } catch (err) {
      console.error("Error exporting notes as text:", err);
      return res.status(500).json({ message: "Failed to export notes as text" });
    }
  });

  // Create a Map to store import status information
  const importStatusMap = new Map<string, {
    projectId: number,
    userId: number,
    startTime: number,
    statusLog: string[],
    progress: number,
    completed: boolean,
    totalNotes: number,
    processedNotes: number
  }>();
  
  // Endpoint to get real-time import status
  app.get("/api/projects/:projectId/import-status", isAuthenticated, async (req, res) => {
    try {
      const projectId = parseInt(req.params.projectId);
      const importId = req.query.id as string;
      
      if (!importId) {
        return res.status(400).json({ message: "Import ID is required" });
      }
      
      // Check if status exists for this import
      const importStatus = importStatusMap.get(importId);
      if (!importStatus) {
        return res.status(404).json({ message: "Import status not found" });
      }
      
      // Check if user has permission
      if (importStatus.userId !== req.user!.id || importStatus.projectId !== projectId) {
        return res.status(403).json({ message: "Not authorized to view this import status" });
      }
      
      // Calculate overall import progress
      let progress = 0;
      if (importStatus.totalNotes > 0) {
        // More accurate progress calculation:
        // - Up to 60% for note creation (phase 1)
        // - 30% for parent relationships (phase 2)
        // - 10% for normalization and completion
        let baseProgress = Math.min(60, Math.round((importStatus.processedNotes / importStatus.totalNotes) * 60));
        
        // If we're complete, always show 100%
        if (importStatus.completed) {
          progress = 100;
        } else {
          // Check status log to determine phases
          const lastStatus = importStatus.statusLog.length > 0 ? 
            importStatus.statusLog[importStatus.statusLog.length - 1] : "";
            
          if (lastStatus.includes("Phase 2:")) {
            // We're in phase 2 (parent relationships)
            // Extract progress from status message if possible
            const phase2Match = lastStatus.match(/Phase 2: Processed (\d+)\/(\d+)/);
            if (phase2Match && phase2Match.length >= 3) {
              const [_, processed, total] = phase2Match;
              const phase2Progress = Math.round((parseInt(processed) / parseInt(total)) * 30);
              progress = 60 + Math.min(30, phase2Progress);
            } else {
              // Fallback to just adding some progress to phase 1
              progress = 60 + 10; // Show some progress in phase 2
            }
          } else if (lastStatus.includes("normalizing") || lastStatus.includes("Normalizing")) {
            // Final normalization phase
            progress = 90;
          } else {
            // Still in phase 1 (note creation)
            progress = baseProgress;
          }
        }
        
        console.log(`Import ${importId} progress: ${progress}%, processedNotes: ${importStatus.processedNotes}/${importStatus.totalNotes}`);
      }
      
      // Return current status
      return res.status(200).json({
        importId,
        status: importStatus.statusLog.length > 0 ? 
          importStatus.statusLog[importStatus.statusLog.length - 1] : 
          "Import in progress",
        statusLog: importStatus.statusLog,
        progress,
        completed: importStatus.completed,
        elapsedTime: ((Date.now() - importStatus.startTime) / 1000).toFixed(1),
        totalNotes: importStatus.totalNotes,
        processedNotes: importStatus.processedNotes
      });
    } catch (error) {
      console.error("Error retrieving import status:", error);
      return res.status(500).json({ message: "Failed to retrieve import status" });
    }
  });
  
  // Import notes into a project
  app.post("/api/projects/:projectId/import", isAuthenticated, async (req, res) => {
    try {
      console.log("Import request received with user:", req.user ? `ID: ${req.user.id}` : "Not authenticated");
      console.log("Request body type:", typeof req.body);
      console.log("Request body:", JSON.stringify(req.body).substring(0, 300) + "...");
      console.log("Request body has notes array:", req.body && Array.isArray(req.body.notes));
      console.log("Headers:", JSON.stringify(req.headers));
      
      const projectId = parseInt(req.params.projectId);
      console.log("Project ID from params:", projectId);
      
      // Generate a unique import ID
      const importId = `import-${projectId}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      const importStartTime = Date.now();
      const statusUpdates: string[] = [];
      
      // Initialize status tracking
      importStatusMap.set(importId, {
        projectId,
        userId: req.user!.id,
        startTime: importStartTime,
        statusLog: [],
        progress: 0,
        completed: false,
        totalNotes: 0,
        processedNotes: 0
      });
      
      // Store status messages for response and status updates
      const addStatus = (message: string) => {
        console.log(message);
        statusUpdates.push(message);
        
        // Also update the import status map
        const status = importStatusMap.get(importId);
        if (status) {
          status.statusLog.push(message);
          importStatusMap.set(importId, status);
        }
      };
      
      // Check if project exists and belongs to the user
      const project = await storage.getProject(projectId);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }
      
      if (project.userId !== req.user!.id) {
        return res.status(403).json({ message: "Not authorized to import into this project" });
      }
      
      // Get the import data from the request body
      const importData = req.body as ImportData;
      
      // Validate the import data has the correct structure
      if (!importData || !importData.notes || !Array.isArray(importData.notes)) {
        console.error("Invalid import data format:", importData);
        return res.status(400).json({ message: "Invalid import data format - missing notes array" });
      }
      
      // Create a mapping of old ids to new ids for proper parent references
      const idMap = new Map<number, number>();
      
      // Calculate total notes for progress tracking
      const totalNotes = importData.notes.length;
      let processedNotes = 0;
      
      // Update the import status with total notes count
      const currentStatus = importStatusMap.get(importId);
      if (currentStatus) {
        currentStatus.totalNotes = totalNotes;
        importStatusMap.set(importId, currentStatus);
      }
      
      addStatus(`Starting import of ${totalNotes} notes (${new Date().toLocaleTimeString()})`);
      
      // Get current timestamp for performance tracking
      const processingStartTime = Date.now();
      
      // First pass: Create all notes without parent relationships
      // Process in batches for improved performance
      const BATCH_SIZE = 10; // Process notes in batches of 10
      for (let i = 0; i < importData.notes.length; i += BATCH_SIZE) {
        const batch = importData.notes.slice(i, i + BATCH_SIZE);
        const batchPromises = batch.map(async (note) => {
          // Use helper function to convert imported note to insert format
          const noteToInsert = convertImportedNoteToInsert(note, projectId);
          
          // Create a new note without parent reference
          const newNote = await storage.createNote(noteToInsert);
          
          // Store the mapping from original id to new id
          idMap.set(note.id, newNote.id);
        });
        
        // Wait for all notes in this batch to be created
        await Promise.all(batchPromises);
        
        // Update progress counter
        processedNotes += batch.length;
        
        // Provide periodic status updates
        if (i % 20 === 0 || processedNotes === totalNotes) {
          const percent = Math.round((processedNotes / totalNotes) * 100);
          const elapsed = ((Date.now() - processingStartTime) / 1000).toFixed(1);
          addStatus(`Phase 1: Created ${processedNotes}/${totalNotes} notes (${percent}%, ${elapsed}s elapsed)`);
          
          // Update the import status with processed notes count
          const currentStatus = importStatusMap.get(importId);
          if (currentStatus) {
            currentStatus.processedNotes = processedNotes;
            importStatusMap.set(importId, currentStatus);
          }
        }
      }
      
      // Report completion of first phase
      const phase1Time = ((Date.now() - processingStartTime) / 1000).toFixed(1);
      addStatus(`Note creation completed in ${phase1Time} seconds`);
      
      // Second pass: Update parent relationships using batch processing for better performance
      addStatus(`Phase 2: Starting parent relationship updates (${new Date().toLocaleTimeString()})`);
      
      const phase2Start = Date.now();
      // Modified filter for notes with parents to be more inclusive
      const notesWithParents = importData.notes.filter(note => {
        // First check if parentId exists and is non-null
        if (note.parentId === null || note.parentId === undefined) {
          return false;
        }
        
        // Handle both number and string parentIds (convert string to number if needed)
        const parentIdNum = typeof note.parentId === 'string' ? 
          parseInt(note.parentId, 10) : 
          note.parentId as number;
        
        // Check if we have this parent ID in our mapping
        const hasValidParent = !isNaN(parentIdNum) && idMap.has(parentIdNum);
        
        // Add debug logging
        if (!hasValidParent && note.parentId !== null) {
          console.log(`Note ${note.id} has parent ${note.parentId} (${typeof note.parentId}) but no mapping found`);
        }
        
        return hasValidParent;
      });
      
      // Group notes by parent ID to reduce database contention
      const notesByParent: Map<number, {id: number, parentId: number, order: number | string}[]> = new Map();
      
      for (let i = 0; i < notesWithParents.length; i++) {
        const note = notesWithParents[i];
        
        // Handle both number and string parentIds
        const parentIdNum = typeof note.parentId === 'string' ? 
          parseInt(note.parentId, 10) : 
          note.parentId as number;
        
        const newId = idMap.get(note.id);
        const newParentId = idMap.get(parentIdNum);
        
        if (newId !== undefined && newParentId !== undefined) {
          // Pass the original note's order if available, or derive from position
          const orderValue = typeof note.order !== 'undefined' ? 
            note.order : 
            typeof note.position === 'number' ? 
            note.position : 
            i; // Use index as fallback
          
          // Group by parent ID
          if (!notesByParent.has(newParentId)) {
            notesByParent.set(newParentId, []);
          }
          
          notesByParent.get(newParentId)?.push({
            id: newId,
            parentId: newParentId,
            order: orderValue
          });
        }
      }
      
      // Process parent groups sequentially to avoid deadlocks
      addStatus(`Processing notes grouped by ${notesByParent.size} parents to prevent deadlocks`);
      
      try {
        let parentsProcessed = 0;
        let notesProcessed = 0;
        const totalParents = notesByParent.size;
        
        // Process each parent group one at a time
        // Sort parents to process them in a consistent order to reduce deadlocks
        const sortedParents = Array.from(notesByParent.entries())
          .sort((a, b) => a[0] - b[0]);
          
        for (const [parentId, notes] of sortedParents) {
          // Use smaller batches for better performance and fewer deadlocks
          const PARENT_BATCH_SIZE = 5;
          
          // Ensure consistent processing order within each parent's children
          const sortedNotes = [...notes].sort((a, b) => {
            // First by order if available
            if (typeof a.order === 'number' && typeof b.order === 'number') {
              return a.order - b.order;
            } 
            // Then by ID
            return a.id - b.id;
          });
          
          addStatus(`Processing ${sortedNotes.length} children for parent ${parentId}`);
          
          for (let i = 0; i < sortedNotes.length; i += PARENT_BATCH_SIZE) {
            const batch = sortedNotes.slice(i, i + PARENT_BATCH_SIZE);
            
            // Process this small batch with retries for deadlocks
            let success = false;
            let attempts = 0;
            const MAX_ATTEMPTS = 3;
            
            while (!success && attempts < MAX_ATTEMPTS) {
              try {
                success = await storage.updateNoteParentsBatch(batch);
                // Add a small delay to reduce contention
                if (i + PARENT_BATCH_SIZE < sortedNotes.length) {
                  await new Promise(resolve => setTimeout(resolve, 50));
                }
              } catch (err) {
                attempts++;
                console.error(`Batch update failed (attempt ${attempts}):`, err);
                
                // Wait longer before retrying
                await new Promise(resolve => setTimeout(resolve, 100 * attempts));
              }
            }
            
            if (!success) {
              addStatus(`⚠️ Warning: Batch update for parent ${parentId} had issues - will continue with next batch`);
            }
            
            // Update processing counters
            notesProcessed += batch.length;
            
            // Provide status updates
            if (i % 20 === 0 || i + PARENT_BATCH_SIZE >= notes.length) {
              const percent = Math.round((notesProcessed / notesWithParents.length) * 100);
              const elapsed = ((Date.now() - phase2Start) / 1000).toFixed(1);
              addStatus(`Phase 2: Processed ${notesProcessed}/${notesWithParents.length} notes (${percent}%, ${elapsed}s elapsed)`);
              
              // Update the import status to reflect phase 2 progress
              const currentStatus = importStatusMap.get(importId);
              if (currentStatus) {
                // For phase 2, we continue from 60% to 90% (30% for this phase)
                const phase2Progress = Math.round((notesProcessed / notesWithParents.length) * 30);
                currentStatus.progress = 60 + Math.min(30, phase2Progress);
                importStatusMap.set(importId, currentStatus);
              }
            }
            
            // Add a small delay between batches to reduce database contention
            if (notes.length > 20 && i + PARENT_BATCH_SIZE < notes.length) {
              await new Promise(resolve => setTimeout(resolve, 50));
            }
          }
          
          parentsProcessed++;
          
          // Status update for each parent
          if (parentsProcessed % 5 === 0 || parentsProcessed === totalParents) {
            const parentPercent = Math.round((parentsProcessed / totalParents) * 100);
            addStatus(`Completed parent group ${parentsProcessed}/${totalParents} (${parentPercent}%)`);
          }
        }
        
        // After all parent updates, normalize the orders for each parent
        addStatus(`Post-processing: Normalizing note orders for all parents`);
        
        // Update status to show we're in the normalization phase (90%)
        const normStatus = importStatusMap.get(importId);
        if (normStatus) {
          normStatus.progress = 90;
          importStatusMap.set(importId, normStatus);
        }
        
        // Process each parent one at a time
        let normalizedParentCount = 0;
        const totalParentsToNormalize = notesByParent.size;
        
        for (const parentId of notesByParent.keys()) {
          const success = await storage.normalizeNoteOrders(parentId);
          normalizedParentCount++;
          
          if (!success) {
            addStatus(`⚠️ Warning: Could not normalize orders for parent ${parentId}`);
          }
          
          // Provide periodic progress updates
          if (normalizedParentCount % 5 === 0 || normalizedParentCount === totalParentsToNormalize) {
            const normPercent = Math.round((normalizedParentCount / totalParentsToNormalize) * 100);
            addStatus(`Post-processing: Normalized ${normalizedParentCount}/${totalParentsToNormalize} parent groups (${normPercent}%)`);
            
            // Update progress between 90-99%
            const normStatus = importStatusMap.get(importId);
            if (normStatus) {
              const normProgress = Math.round((normalizedParentCount / totalParentsToNormalize) * 9);
              normStatus.progress = 90 + Math.min(9, normProgress);
              importStatusMap.set(importId, normStatus);
            }
          }
        }
      } catch (error) {
        console.error("Error in parent relationship updates:", error);
        addStatus(`Error during parent relationship updates: ${error}`);
      }
      
      // Report completion of second phase
      const phase2Time = ((Date.now() - phase2Start) / 1000).toFixed(1);
      addStatus(`Parent relationship updates completed in ${phase2Time} seconds`);
      
      // Report total completion time
      const totalTime = ((Date.now() - processingStartTime) / 1000).toFixed(1);
      addStatus(`Import completed in ${totalTime} seconds total`);
      
      // Mark the import as completed in the status map
      const status = importStatusMap.get(importId);
      if (status) {
        status.completed = true;
        status.progress = 100;
        status.totalNotes = totalNotes;
        status.processedNotes = processedNotes;
        importStatusMap.set(importId, status);
        
        // For large imports, keep the status in memory for a limited time (5 minutes)
        setTimeout(() => {
          importStatusMap.delete(importId);
        }, 5 * 60 * 1000);
      }
      
      // Return success with count, total count, and detailed status for completion display
      return res.status(200).json({ 
        message: "Import successful",
        importId, // Include the import ID for continuous status polling
        count: importData.notes.length,
        processed: totalNotes,
        total: totalNotes,
        statusLog: statusUpdates, // Include detailed status log for display in UI
        timeElapsed: totalTime
      });
    } catch (err) {
      console.error("Error importing notes:", err);
      
      // Detailed error logging
      if (err instanceof Error) {
        console.error("Error message:", err.message);
        console.error("Error stack:", err.stack);
      }
      
      // Check if this is an authentication issue
      if (req.isAuthenticated && !req.isAuthenticated()) {
        console.error("Authentication failed during import - user not authenticated");
        return res.status(401).json({ 
          message: "Authentication required for import",
          error: "Not authenticated"
        });
      }
      
      return res.status(500).json({ 
        message: "Failed to import notes",
        error: err instanceof Error ? err.message : String(err)
      });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}

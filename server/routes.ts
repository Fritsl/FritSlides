import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth } from "./auth";
import multer from "multer";
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

// Authentication middleware
function isAuthenticated(req: Request, res: Response, next: Function) {
  if (req.isAuthenticated()) {
    return next();
  }
  return res.status(401).json({ message: "Unauthorized" });
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup authentication routes
  setupAuth(app);

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
      const result = insertProjectSchema.safeParse({
        ...req.body,
        userId: req.user!.id,
      });
      
      if (!result.success) {
        return res.status(400).json({ message: "Invalid project data", errors: result.error.format() });
      }
      
      const project = await storage.createProject(result.data);
      res.status(201).json(project);
    } catch (err) {
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
      const projectId = parseInt(req.params.projectId);
      
      // Check if project exists and belongs to user
      const project = await storage.getProject(projectId);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }
      
      if (project.userId !== req.user!.id) {
        return res.status(403).json({ message: "Not authorized to add notes to this project" });
      }
      
      const result = insertNoteSchema.safeParse({
        ...req.body,
        projectId,
      });
      
      if (!result.success) {
        return res.status(400).json({ message: "Invalid note data", errors: result.error.format() });
      }
      
      const note = await storage.createNote(result.data);
      res.status(201).json(note);
    } catch (err) {
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
  app.post("/api/upload", isAuthenticated, upload.single("image"), (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }
      
      const imageUrl = `/api/images/${req.file.filename}`;
      return res.status(201).json({ imageUrl });
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
        return res.status(404).json({ message: "Image not found" });
      }
    } catch (err) {
      console.error("Error serving image:", err);
      return res.status(500).json({ message: "Failed to serve image" });
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
      const projectId = parseInt(req.params.projectId);
      
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
      if (!importData || !Array.isArray(importData.notes)) {
        return res.status(400).json({ message: "Invalid import data" });
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
      const notesWithParents = importData.notes.filter(note => 
        typeof note.parentId === 'number' && 
        idMap.has(note.parentId as number)
      );
      
      // Group notes by parent ID to reduce database contention
      const notesByParent: Map<number, {id: number, parentId: number, order: number | string}[]> = new Map();
      
      for (let i = 0; i < notesWithParents.length; i++) {
        const note = notesWithParents[i];
        const parentId = note.parentId as number; 
        
        const newId = idMap.get(note.id);
        const newParentId = idMap.get(parentId);
        
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
        for (const [parentId, notes] of notesByParent.entries()) {
          // Smaller batches for each parent group
          const PARENT_BATCH_SIZE = 10;
          
          for (let i = 0; i < notes.length; i += PARENT_BATCH_SIZE) {
            const batch = notes.slice(i, i + PARENT_BATCH_SIZE);
            
            // Process this small batch
            const success = await storage.updateNoteParentsBatch(batch);
            
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
      return res.status(500).json({ message: "Failed to import notes" });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}

import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth } from "./auth";
import multer from "multer";
import { insertProjectSchema, insertNoteSchema, updateNoteSchema } from "@shared/schema";
import fs from "fs";
import path from "path";
import { randomBytes } from "crypto";

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
      
      const updatedProject = await storage.updateProject(projectId, req.body.name);
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
      const result = await storage.deleteNote(noteId);
      
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
        await storage.updateNoteParent(noteId, parentId !== null ? parseInt(parentId) : null, order);
        // After updating parent with order, we need to adjust orders of siblings
        await storage.normalizeNoteOrders(parentId !== null ? parseInt(parentId) : null);
      } else {
        // Just update parent
        await storage.updateNoteParent(noteId, parentId !== null ? parseInt(parentId) : null);
      }
      
      res.sendStatus(200);
    } catch (err) {
      res.status(500).json({ message: "Failed to update note parent" });
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
      
      await storage.updateNoteOrder(noteId, order);
      res.sendStatus(200);
    } catch (err) {
      res.status(500).json({ message: "Failed to update note order" });
    }
  });

  // Image upload
  app.post("/api/upload", isAuthenticated, upload.single("image"), (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }
      
      const imageUrl = `/api/images/${req.file.filename}`;
      res.status(201).json({ imageUrl });
    } catch (err) {
      res.status(500).json({ message: "Failed to upload image" });
    }
  });

  // Serve uploaded images
  app.get("/api/images/:filename", (req, res) => {
    const filename = req.params.filename;
    const filepath = path.join(storage_dir, filename);
    
    // Check if file exists
    if (fs.existsSync(filepath)) {
      res.sendFile(filepath);
    } else {
      res.status(404).json({ message: "Image not found" });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}

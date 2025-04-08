import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import { User as SelectUser } from "@shared/schema";

declare global {
  namespace Express {
    interface User extends SelectUser {}
  }
}

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function comparePasswords(supplied: string, stored: string) {
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

export function setupAuth(app: Express) {
  // Make sure session secret is set
  if (!process.env.SESSION_SECRET) {
    // For development only, in production this should be a strong secret
    process.env.SESSION_SECRET = "notesystem-secret-key";
  }
  
  const sessionSettings: session.SessionOptions = {
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: storage.sessionStore,
    cookie: {
      maxAge: 7 * 24 * 60 * 60 * 1000, // 1 week
    }
  };

  app.set("trust proxy", 1);
  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        const user = await storage.getUserByUsername(username);
        if (!user || !(await comparePasswords(password, user.password))) {
          return done(null, false);
        } else {
          return done(null, user);
        }
      } catch (err) {
        return done(err);
      }
    }),
  );

  passport.serializeUser((user, done) => done(null, user.id));
  passport.deserializeUser(async (id: number, done) => {
    try {
      const user = await storage.getUser(id);
      done(null, user);
    } catch (err) {
      done(err);
    }
  });

  app.post("/api/register", async (req, res, next) => {
    try {
      const existingUser = await storage.getUserByUsername(req.body.username);
      if (existingUser) {
        return res.status(400).json({ message: "Username already exists" });
      }

      const user = await storage.createUser({
        ...req.body,
        password: await hashPassword(req.body.password),
      });

      req.login(user, (err) => {
        if (err) return next(err);
        
        // Don't return the password in the response
        const { password, ...userWithoutPassword } = user;
        res.status(201).json(userWithoutPassword);
      });
    } catch (err) {
      next(err);
    }
  });

  app.post("/api/login", (req, res, next) => {
    passport.authenticate("local", (err, user, info) => {
      if (err) return next(err);
      if (!user) {
        return res.status(401).json({ message: "Invalid username or password" });
      }
      
      req.login(user, (err) => {
        if (err) return next(err);
        
        // Don't return the password in the response
        const { password, ...userWithoutPassword } = user;
        return res.status(200).json(userWithoutPassword);
      });
    })(req, res, next);
  });

  app.post("/api/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      res.sendStatus(200);
    });
  });

  app.get("/api/user", (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    // Don't return the password in the response
    if (req.user) {
      const { password, ...userWithoutPassword } = req.user;
      res.json(userWithoutPassword);
    } else {
      res.sendStatus(401);
    }
  });
  
  // Get user's last opened project
  app.get("/api/user/lastProject", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    try {
      const user = await storage.getUser(req.user!.id);
      
      if (!user || !user.lastOpenedProjectId) {
        return res.status(200).json({ lastOpenedProjectId: null });
      }
      
      // Get the project to ensure it still exists
      const project = await storage.getProject(user.lastOpenedProjectId);
      
      if (!project) {
        // If project doesn't exist anymore, clear the lastOpenedProjectId
        await storage.updateLastOpenedProject(req.user!.id, null);
        return res.status(200).json({ lastOpenedProjectId: null });
      }
      
      res.status(200).json({ lastOpenedProjectId: user.lastOpenedProjectId });
    } catch (err) {
      console.error("Error getting last opened project:", err);
      res.status(500).json({ message: "Failed to get last opened project" });
    }
  });
  
  // Update user's last opened project
  app.post("/api/user/lastProject", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    const { projectId } = req.body;
    
    // Validate projectId
    if (projectId === undefined || projectId === null) {
      return res.status(400).json({ message: "Project ID is required" });
    }
    
    try {
      // Check if the project exists
      const project = await storage.getProject(projectId);
      
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }
      
      // Update the user's last opened project
      const success = await storage.updateLastOpenedProject(req.user!.id, projectId);
      
      if (success) {
        return res.status(200).json({ message: "Last opened project updated" });
      } else {
        return res.status(500).json({ message: "Failed to update last opened project" });
      }
    } catch (err) {
      console.error("Error updating last opened project:", err);
      res.status(500).json({ message: "Failed to update last opened project" });
    }
  });
}

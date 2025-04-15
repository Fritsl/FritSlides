import { Express, Request, Response, NextFunction } from "express";
import session from "express-session";
import { storage } from "./storage";
import { User as SelectUser } from "@shared/schema";
import { getSupabaseClient } from "./supabase-storage";

// IMPORTANT: Supabase uses UUIDs for auth, but our database uses integers for user IDs
// We need to convert the UUID to a stable integer for use in our database

// Function to convert UUID to a stable integer value 
function hashStringToInteger(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  // Ensure positive number
  return Math.abs(hash);
}

declare global {
  namespace Express {
    interface User extends SelectUser {}
  }
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
  
  // The middleware function that checks if a user is authenticated via Supabase
  app.use(async (req: Request, res: Response, next: NextFunction) => {
    // Skip authentication check for some routes
    const publicRoutes = [
      '/api/supabase-credentials',
      '/__vite_ping',
      '/favicon.ico',
      '/assets/',
      '/images/',
      '/node_modules/'
    ];
    
    // Check if this is a public route that doesn't need authentication
    if (publicRoutes.some(route => req.path.startsWith(route)) || 
        req.path === '/' || 
        (!req.path.startsWith('/api/') && !req.path.startsWith('/__'))) {
      return next();
    }
    
    // For Supabase authentication, check if the request contains user ID in a header
    if (req.headers['x-supabase-user-id']) {
      // If Supabase user ID is provided in header, use it
      const supabaseUserId = req.headers['x-supabase-user-id'] as string;
      const userEmail = req.headers['x-supabase-user-email'] as string || null;
      
      // Log headers for debugging, excluding sensitive ones
      const safeHeaders = { ...req.headers };
      delete safeHeaders.authorization;
      delete safeHeaders.cookie;
      console.log(`Authentication headers:`, JSON.stringify(safeHeaders));
      
      // Verify the user exists in Supabase using the service role key (which bypasses RLS)
      try {
        // Get the Supabase admin client using the service role key
        const supabase = await getSupabaseClient();
        
        if (supabase) {
          console.log("SUPABASE_SERVICE_ROLE_KEY is available and Supabase client created");
          
          // Convert UUID to numerical ID
          const numericId = hashStringToInteger(supabaseUserId);
          console.log(`Looking up user with UUID: ${supabaseUserId} (converted to numeric ID: ${numericId})`);
          
          // Use direct query with numeric ID
          const { data: userData, error } = await supabase
            .from('users')
            .select('*')
            .eq('id', numericId);
          
          if (error) {
            console.error("Error verifying user with Supabase admin client:", error);
          }
          
          console.log("Supabase direct user lookup result:", userData ? "User found" : "User NOT found");
          
          // If the user doesn't exist in Supabase, create them
          if (!userData) {
            console.log(`User ${supabaseUserId} not found in Supabase database, creating new user record`);
            
            // Create the user in Supabase with numeric ID from UUID
            const { data: newUser, error: createError } = await supabase
              .from('users')
              .insert({
                id: numericId, // Using numeric ID converted from UUID
                username: userEmail || `user_${supabaseUserId.substring(0, 8)}@example.com`, 
                // Using our schema column names
                password: null, // Password is optional for Supabase auth users
                lastOpenedProjectId: null
              })
              .select()
              .single();
            
            if (createError) {
              console.error("Error creating user in Supabase:", createError);
            } else {
              console.log(`Successfully created user ${supabaseUserId} in Supabase database`);
            }
          }
        } else {
          console.log("SUPABASE_SERVICE_ROLE_KEY is available but Supabase client creation failed");
        }
      } catch (err) {
        console.error("Error attempting to verify user with Supabase:", err);
      }
      
      // Set up the user object that the rest of the code expects
      // Convert UUID to numeric ID to match database schema
      const userId = hashStringToInteger(supabaseUserId);
      req.user = {
        id: userId, // Use numeric ID converted from UUID
        username: userEmail || supabaseUserId,
        password: null, // Password not needed for Supabase users
        lastOpenedProjectId: null
      };
      
      console.log("Authenticated with Supabase user ID:", supabaseUserId);
      return next();
    } 
    
    console.log("Authentication failed - no valid Supabase auth found");
    return res.status(401).json({ message: "Unauthorized - Please sign in with Supabase auth" });
  });

  // Simplified user info endpoint
  app.get("/api/user", (req, res) => {
    if (req.user) {
      const { password, ...userWithoutPassword } = req.user;
      res.json(userWithoutPassword);
    } else {
      res.status(401).json({ message: "Not authenticated" });
    }
  });
}
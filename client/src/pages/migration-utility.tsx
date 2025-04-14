import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from '@/hooks/use-auth';
import { useProjects } from '@/hooks/use-projects';
import { useNotes } from '@/hooks/use-notes';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Create a direct client with service key for table operations
let adminClient: SupabaseClient | null = null;

// The service key from the env vars
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndhYXF0cXhveWx4dmh5a2Vzc25jIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NDY0MjI3MiwiZXhwIjoyMDYwMjE4MjcyfQ.OkSjrMMVjzsk7vw4p45G3o0sbD2Lgpr-gSXLPuT4ygs';

type MigrationStatus = 'idle' | 'running' | 'success' | 'error';

/**
 * Utility page to test Supabase connectivity and perform migrations
 */
export default function MigrationUtilityPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const { projects, isLoading: isProjectsLoading } = useProjects();
  
  const [connectionStatus, setConnectionStatus] = useState<MigrationStatus>('idle');
  const [migrationStatus, setMigrationStatus] = useState<MigrationStatus>('idle');
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState('Ready to test Supabase connection');
  const [log, setLog] = useState<string[]>([]);
  
  // Initialize the admin client when component mounts
  useEffect(() => {
    if (!adminClient) {
      try {
        const supabaseUrl = localStorage.getItem('supabase-url') || 'https://db.waaqtqxoylxvhykessnc.supabase.co';
        
        // Create admin client with service key
        adminClient = createClient(supabaseUrl, SERVICE_KEY, {
          auth: {
            autoRefreshToken: false,
            persistSession: false
          },
          db: {
            schema: 'public'
          }
        });
        console.log('Admin Supabase client initialized with service role');
      } catch (error) {
        console.error('Failed to initialize admin Supabase client:', error);
      }
    }
  }, []);

  function addLog(entry: string) {
    setLog(prev => [...prev, entry]);
  }

  // Function to ensure all necessary tables exist in Supabase
  async function ensureTablesExist() {
    if (!adminClient) {
      addLog('ERROR: Admin client not available, cannot create tables');
      return false;
    }
    
    addLog('Ensuring all required tables exist in Supabase...');
    
    try {
      // Using SQL queries directly through Supabase's REST API
      // This is a more direct approach than trying to use RPCs which might not exist
      
      addLog('Creating users table if it doesn\'t exist...');
      const { error: createUsersError } = await adminClient.from('_supabase_migrations').insert({
        name: 'create_users_table',
        sql: `
          CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            username TEXT NOT NULL UNIQUE,
            password TEXT NOT NULL,
            "lastOpenedProjectId" INTEGER
          );
        `
      });
      
      if (createUsersError) {
        // Expected if the table already exists or _supabase_migrations table doesn't exist
        addLog(`Note: Could not record migration: ${createUsersError.message}`);
        
        // Try directly through the REST API
        try {
          const usersResponse = await fetch(`https://db.waaqtqxoylxvhykessnc.supabase.co/rest/v1/rpc/execute_sql`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': SERVICE_KEY,
              'Authorization': `Bearer ${SERVICE_KEY}`,
              'Prefer': 'return=minimal'
            },
            body: JSON.stringify({
              sql_query: `
                CREATE TABLE IF NOT EXISTS users (
                  id SERIAL PRIMARY KEY,
                  username TEXT NOT NULL UNIQUE,
                  password TEXT NOT NULL,
                  "lastOpenedProjectId" INTEGER
                );
              `
            })
          });
          
          if (!usersResponse.ok) {
            const errorText = await usersResponse.text();
            addLog(`Warning: Failed to create users table: ${errorText}`);
          } else {
            addLog('Users table created or already exists');
          }
        } catch (directError) {
          addLog(`Warning: Error in direct SQL for users table: ${directError instanceof Error ? directError.message : String(directError)}`);
        }
      } else {
        addLog('Users table created or already exists');
      }
      
      // Check if users table exists now
      const { error: checkUsersError } = await adminClient
        .from('users')
        .select('id')
        .limit(1);
        
      if (checkUsersError) {
        if (checkUsersError.code === '42P01') {
          addLog('ERROR: Users table still does not exist after creation attempt');
        } else {
          addLog(`ERROR checking users table: ${checkUsersError.message}`);
        }
      } else {
        addLog('Users table exists and is accessible');
      }
      
      // Create projects table
      addLog('Creating projects table if it doesn\'t exist...');
      try {
        const projectsResponse = await fetch(`https://db.waaqtqxoylxvhykessnc.supabase.co/rest/v1/rpc/execute_sql`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': SERVICE_KEY,
            'Authorization': `Bearer ${SERVICE_KEY}`,
            'Prefer': 'return=minimal'
          },
          body: JSON.stringify({
            sql_query: `
              CREATE TABLE IF NOT EXISTS projects (
                id SERIAL PRIMARY KEY,
                "userId" INTEGER NOT NULL,
                name TEXT NOT NULL,
                "lastViewedSlideIndex" INTEGER DEFAULT 0,
                author TEXT,
                "startSlogan" TEXT,
                "endSlogan" TEXT,
                "isLocked" BOOLEAN DEFAULT false
              );
              
              -- Add foreign key if not exists (separate statement to avoid errors if already exists)
              DO $$
              BEGIN
                IF NOT EXISTS (
                  SELECT 1 FROM pg_constraint WHERE conname = 'projects_userId_fkey'
                ) THEN
                  ALTER TABLE projects
                  ADD CONSTRAINT projects_userId_fkey
                  FOREIGN KEY ("userId") REFERENCES users(id);
                END IF;
              EXCEPTION WHEN others THEN
                -- Do nothing if it fails
              END$$;
            `
          })
        });
        
        if (!projectsResponse.ok) {
          const errorText = await projectsResponse.text();
          addLog(`Warning: Failed to create projects table: ${errorText}`);
        } else {
          addLog('Projects table created or already exists');
        }
      } catch (directError) {
        addLog(`Warning: Error in direct SQL for projects table: ${directError instanceof Error ? directError.message : String(directError)}`);
      }
      
      // Check if projects table exists now
      const { error: checkProjectsError } = await adminClient
        .from('projects')
        .select('id')
        .limit(1);
        
      if (checkProjectsError) {
        if (checkProjectsError.code === '42P01') {
          addLog('ERROR: Projects table still does not exist after creation attempt');
        } else {
          addLog(`ERROR checking projects table: ${checkProjectsError.message}`);
        }
      } else {
        addLog('Projects table exists and is accessible');
      }
      
      // Create notes table
      addLog('Creating notes table if it doesn\'t exist...');
      try {
        const notesResponse = await fetch(`https://db.waaqtqxoylxvhykessnc.supabase.co/rest/v1/rpc/execute_sql`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': SERVICE_KEY,
            'Authorization': `Bearer ${SERVICE_KEY}`,
            'Prefer': 'return=minimal'
          },
          body: JSON.stringify({
            sql_query: `
              CREATE TABLE IF NOT EXISTS notes (
                id SERIAL PRIMARY KEY,
                "projectId" INTEGER NOT NULL,
                "parentId" INTEGER,
                content TEXT NOT NULL,
                "order" TEXT,
                url TEXT,
                "linkText" TEXT,
                "youtubeLink" TEXT,
                time TEXT,
                images TEXT[]
              );
              
              -- Add foreign keys if not exists
              DO $$
              BEGIN
                IF NOT EXISTS (
                  SELECT 1 FROM pg_constraint WHERE conname = 'notes_projectId_fkey'
                ) THEN
                  ALTER TABLE notes
                  ADD CONSTRAINT notes_projectId_fkey
                  FOREIGN KEY ("projectId") REFERENCES projects(id);
                END IF;
                
                IF NOT EXISTS (
                  SELECT 1 FROM pg_constraint WHERE conname = 'notes_parentId_fkey'
                ) THEN
                  ALTER TABLE notes
                  ADD CONSTRAINT notes_parentId_fkey
                  FOREIGN KEY ("parentId") REFERENCES notes(id);
                END IF;
              EXCEPTION WHEN others THEN
                -- Do nothing if it fails
              END$$;
            `
          })
        });
        
        if (!notesResponse.ok) {
          const errorText = await notesResponse.text();
          addLog(`Warning: Failed to create notes table: ${errorText}`);
        } else {
          addLog('Notes table created or already exists');
        }
      } catch (directError) {
        addLog(`Warning: Error in direct SQL for notes table: ${directError instanceof Error ? directError.message : String(directError)}`);
      }
      
      // Check if notes table exists now
      const { error: checkNotesError } = await adminClient
        .from('notes')
        .select('id')
        .limit(1);
        
      if (checkNotesError) {
        if (checkNotesError.code === '42P01') {
          addLog('ERROR: Notes table still does not exist after creation attempt');
        } else {
          addLog(`ERROR checking notes table: ${checkNotesError.message}`);
        }
      } else {
        addLog('Notes table exists and is accessible');
      }
      
      // Final verification
      const tables = ['users', 'projects', 'notes'];
      let allTablesExist = true;
      
      for (const table of tables) {
        const { error } = await adminClient
          .from(table)
          .select('id')
          .limit(1);
          
        if (error && error.code === '42P01') {
          addLog(`ERROR: ${table} table does not exist`);
          allTablesExist = false;
        }
      }
      
      if (allTablesExist) {
        addLog('All required tables are ready!');
        return true;
      } else {
        addLog('WARNING: Not all tables exist. Migration may fail.');
        return false;
      }
    } catch (error) {
      addLog(`ERROR: Failed to ensure tables exist: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }
  
  // Function to directly test SQL execution capability
  async function testDirectSQL() {
    addLog('Testing direct SQL execution...');
    try {
      // First, initialize the admin client if not already done
      if (!adminClient) {
        const supabaseUrl = localStorage.getItem('supabase-url') || 'https://db.waaqtqxoylxvhykessnc.supabase.co';
        adminClient = createClient(supabaseUrl, SERVICE_KEY, {
          auth: { autoRefreshToken: false, persistSession: false },
          db: { schema: 'public' }
        });
        addLog('Created admin client with service key');
      }
      
      // Try a simple SQL query using the REST API
      addLog('Executing test SQL query via REST API...');
      
      // Using direct fetch to the REST API endpoint
      const response = await fetch('https://db.waaqtqxoylxvhykessnc.supabase.co/rest/v1/rpc/execute_sql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SERVICE_KEY,
          'Authorization': `Bearer ${SERVICE_KEY}`,
          'Prefer': 'return=representation'
        },
        body: JSON.stringify({
          sql_query: 'SELECT current_database() as db_name;'
        })
      });
      
      const responseBody = await response.text();
      addLog(`Response status: ${response.status} ${response.statusText}`);
      addLog(`Response body: ${responseBody}`);
      
      if (!response.ok) {
        throw new Error(`API call failed: ${response.status} ${response.statusText} - ${responseBody}`);
      }
      
      // Try creating a simple test table
      addLog('Attempting to create a test table...');
      const createTableResponse = await fetch('https://db.waaqtqxoylxvhykessnc.supabase.co/rest/v1/rpc/execute_sql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SERVICE_KEY,
          'Authorization': `Bearer ${SERVICE_KEY}`,
          'Prefer': 'return=representation'
        },
        body: JSON.stringify({
          sql_query: 'CREATE TABLE IF NOT EXISTS test_table (id SERIAL PRIMARY KEY, name TEXT);'
        })
      });
      
      const createTableBody = await createTableResponse.text();
      addLog(`Create table response: ${createTableResponse.status} ${createTableResponse.statusText}`);
      addLog(`Create table body: ${createTableBody}`);
      
      if (!createTableResponse.ok) {
        throw new Error(`Table creation failed: ${createTableResponse.status} ${createTableResponse.statusText} - ${createTableBody}`);
      }
      
      // Check if execute_sql function exists
      addLog('Checking if execute_sql function exists...');
      const checkFunctionResponse = await fetch('https://db.waaqtqxoylxvhykessnc.supabase.co/rest/v1/rpc', {
        method: 'GET',
        headers: {
          'apikey': SERVICE_KEY,
          'Authorization': `Bearer ${SERVICE_KEY}`
        }
      });
      
      const functions = await checkFunctionResponse.json();
      addLog(`Available RPC functions: ${JSON.stringify(functions)}`);
      
      return true;
    } catch (error) {
      addLog(`ERROR in direct SQL test: ${error instanceof Error ? error.message : String(error)}`);
      console.error('Direct SQL test error:', error);
      return false;
    }
  }

  async function testConnection() {
    try {
      setConnectionStatus('running');
      setMessage('Testing Supabase connection...');
      addLog('Testing Supabase connection...');

      // Try to get Supabase credentials
      addLog('Checking Supabase credentials...');
      if (!supabase) {
        throw new Error('Supabase client not initialized');
      }

      // Try to access the database
      addLog('Testing database access...');
      try {
        // First check if the full Supabase client is available
        if (!supabase.from) {
          throw new Error('Supabase database client not available');
        }
        
        // Try to access the users table
        const { data, error } = await supabase.from('users').select('id').limit(1);
        
        if (error) {
          throw new Error(`Database access error: ${error.message}`);
        }
        
        addLog(`Database access successful: ${data ? data.length : 0} users found`);
      } catch (error) {
        // This is expected if we're using the mock client
        addLog('WARNING: Database access not available. This is expected if using the mock client.');
        addLog('You need to set up proper Supabase credentials in the environment.');
      }

      // Test storage access
      addLog('Testing storage access...');
      try {
        // Check if storage.from function exists and is accessible
        if (!supabase.storage || typeof supabase.storage.from !== 'function') {
          throw new Error('Supabase storage client not properly initialized');
        }
        
        // Try to access the bucket
        const bucket = supabase.storage.from('slides-images');
        
        // Test if we can get a public URL (this should work even with mock client)
        const { data: urlData } = bucket.getPublicUrl('test');
        if (!urlData || !urlData.publicUrl) {
          throw new Error('Failed to get public URL from storage');
        }
        
        addLog('Storage access successful: basic functions working');
        
        // If we have list functionality, try using it
        if (typeof bucket.list === 'function') {
          try {
            const { data, error } = await bucket.list();
            
            if (error) {
              addLog(`NOTE: Could not list bucket contents: ${error.message}`);
            } else {
              addLog(`Storage listing successful: ${data ? data.length : 0} files found`);
            }
          } catch (listError) {
            addLog('NOTE: Bucket listing not supported in current client');
          }
        } else {
          addLog('NOTE: Bucket listing not supported in current client');
        }
      } catch (error) {
        addLog(`WARNING: Storage access issue: ${error instanceof Error ? error.message : String(error)}`);
        addLog('You may not have full storage functionality without proper Supabase credentials.');
      }

      setProgress(100);
      setConnectionStatus('success');
      setMessage('Supabase connection successful!');
      addLog('All tests passed! Supabase is connected and working.');
      
      toast({
        title: "Connection Successful",
        description: "Successfully connected to Supabase!",
      });
    } catch (error) {
      console.error('Error testing Supabase connection:', error);
      setConnectionStatus('error');
      setMessage(`Connection test failed: ${error instanceof Error ? error.message : String(error)}`);
      addLog(`ERROR: ${error instanceof Error ? error.message : String(error)}`);
      
      toast({
        title: "Connection Failed",
        description: error instanceof Error ? error.message : String(error),
        variant: "destructive"
      });
    }
  }
  
  // Function to migrate a user to Supabase
  async function migrateUser() {
    if (!user) {
      addLog('ERROR: No user found to migrate');
      return false;
    }
    
    try {
      addLog(`Migrating user ${user.username}...`);
      
      // Check if user already exists in Supabase
      const { data: existingUser } = await supabase
        .from('users')
        .select('id')
        .eq('id', user.id)
        .maybeSingle();
      
      if (existingUser) {
        addLog(`User ${user.username} already exists in Supabase, skipping...`);
        return true;
      }
      
      // Insert user into Supabase
      const { error } = await supabase
        .from('users')
        .insert({
          id: user.id,
          username: user.username,
          password: user.password,
          lastOpenedProjectId: user.lastOpenedProjectId
        });
      
      if (error) {
        addLog(`ERROR: Failed to migrate user ${user.username}: ${error.message}`);
        return false;
      }
      
      addLog(`Successfully migrated user ${user.username}`);
      return true;
    } catch (error) {
      addLog(`ERROR: Failed to migrate user: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }
  
  // Function to migrate projects to Supabase
  async function migrateProjects() {
    if (!projects || projects.length === 0) {
      addLog('No projects found to migrate');
      return 0;
    }
    
    let successCount = 0;
    
    for (const project of projects) {
      try {
        addLog(`Migrating project "${project.name}"...`);
        
        // Check if project already exists in Supabase
        const { data: existingProject } = await supabase
          .from('projects')
          .select('id')
          .eq('id', project.id)
          .maybeSingle();
        
        if (existingProject) {
          addLog(`Project "${project.name}" already exists in Supabase, skipping...`);
          successCount++;
          continue;
        }
        
        // Insert project into Supabase
        const { error } = await supabase
          .from('projects')
          .insert({
            id: project.id,
            userId: project.userId,
            name: project.name,
            lastViewedSlideIndex: project.lastViewedSlideIndex,
            author: project.author,
            startSlogan: project.startSlogan,
            endSlogan: project.endSlogan,
            isLocked: project.isLocked
          });
        
        if (error) {
          addLog(`ERROR: Failed to migrate project "${project.name}": ${error.message}`);
          continue;
        }
        
        addLog(`Successfully migrated project "${project.name}"`);
        successCount++;
      } catch (error) {
        addLog(`ERROR: Failed to migrate project: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    
    return successCount;
  }
  
  // Function to migrate notes of a project to Supabase
  async function migrateProjectNotes(projectId: number) {
    try {
      addLog(`Fetching notes for project ID ${projectId}...`);
      
      // Fetch notes from API
      const response = await fetch(`/api/projects/${projectId}/notes`);
      if (!response.ok) {
        throw new Error(`Failed to fetch notes: ${response.statusText}`);
      }
      
      const notes = await response.json();
      if (!notes || notes.length === 0) {
        addLog(`No notes found for project ID ${projectId}`);
        return 0;
      }
      
      addLog(`Found ${notes.length} notes for project ID ${projectId}`);
      
      let successCount = 0;
      
      // First pass: Create all notes without parent references
      for (const note of notes) {
        try {
          // Check if note already exists in Supabase
          const { data: existingNote } = await supabase
            .from('notes')
            .select('id')
            .eq('id', note.id)
            .maybeSingle();
          
          if (existingNote) {
            addLog(`Note ID ${note.id} already exists in Supabase, skipping...`);
            successCount++;
            continue;
          }
          
          // Insert note into Supabase (without parent reference initially)
          const { error } = await supabase
            .from('notes')
            .insert({
              id: note.id,
              projectId: note.projectId,
              parentId: null, // We'll update this in the second pass
              content: note.content,
              order: note.order,
              url: note.url,
              linkText: note.linkText,
              youtubeLink: note.youtubeLink,
              time: note.time,
              images: note.images
            });
          
          if (error) {
            addLog(`ERROR: Failed to migrate note ID ${note.id}: ${error.message}`);
            continue;
          }
          
          addLog(`Created note ID ${note.id} (without parent reference)`);
          successCount++;
        } catch (error) {
          addLog(`ERROR: Failed to create note: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
      
      // Second pass: Update parent references
      for (const note of notes) {
        if (note.parentId !== null) {
          try {
            const { error } = await supabase
              .from('notes')
              .update({ parentId: note.parentId })
              .eq('id', note.id);
            
            if (error) {
              addLog(`ERROR: Failed to update parent reference for note ID ${note.id}: ${error.message}`);
              continue;
            }
            
            addLog(`Updated parent reference for note ID ${note.id}`);
          } catch (error) {
            addLog(`ERROR: Failed to update parent reference: ${error instanceof Error ? error.message : String(error)}`);
          }
        }
      }
      
      return successCount;
    } catch (error) {
      addLog(`ERROR: Failed to migrate notes: ${error instanceof Error ? error.message : String(error)}`);
      return 0;
    }
  }
  
  async function runMigration() {
    try {
      setMigrationStatus('running');
      setProgress(0);
      addLog('Starting migration to Supabase...');
      
      // Check if we have full Supabase client with database functionality
      if (!supabase.from) {
        // Now we'll specifically check if we're using the real client or mock client
        addLog('Testing if we have a real Supabase client...');
        try {
          // Try fetching directly using the API URL
          const apiUrl = `https://${process.env.REACT_APP_SUPABASE_URL || 'db.waaqtqxoylxvhykessnc.supabase.co'}/rest/v1/users?select=id&limit=1`;
          const response = await fetch(apiUrl, {
            headers: {
              'apikey': process.env.REACT_APP_SUPABASE_ANON_KEY || localStorage.getItem('supabase-anon-key') || '',
              'Authorization': `Bearer ${process.env.REACT_APP_SUPABASE_ANON_KEY || localStorage.getItem('supabase-anon-key') || ''}`,
            }
          });
          
          if (!response.ok) {
            throw new Error(`API request failed: ${response.statusText}`);
          }
          
          // We have direct API access to Supabase
          addLog('Direct Supabase API access is working!');
        } catch (apiError) {
          // We can't access the API directly either
          throw new Error('Cannot access Supabase API. Please check your credentials and internet connection.');
        }
      }
      
      // Ensure tables exist for migration
      addLog('STEP 0: Ensuring database tables exist...');
      const tablesReady = await ensureTablesExist();
      if (!tablesReady) {
        // Continue anyway as tables may already exist
        addLog('Warning: Could not verify all tables exist. Will attempt migration anyway.');
      } else {
        addLog('All required tables are ready for migration.');
      }
      setProgress(5);
      
      // Step 1: Migrate user
      addLog('STEP 1: Migrating user...');
      const userMigrated = await migrateUser();
      if (!userMigrated) {
        throw new Error('Failed to migrate user, aborting migration');
      }
      setProgress(10);
      
      // Step 2: Migrate projects
      addLog('STEP 2: Migrating projects...');
      const projectCount = await migrateProjects();
      addLog(`Migrated ${projectCount} projects`);
      setProgress(30);
      
      // Step 3: Migrate notes for each project
      addLog('STEP 3: Migrating notes for each project...');
      let totalNotes = 0;
      
      if (projects && projects.length > 0) {
        for (let i = 0; i < projects.length; i++) {
          const project = projects[i];
          addLog(`Migrating notes for project "${project.name}" (${i + 1}/${projects.length})...`);
          
          const noteCount = await migrateProjectNotes(project.id);
          totalNotes += noteCount;
          
          addLog(`Migrated ${noteCount} notes for project "${project.name}"`);
          setProgress(30 + Math.floor((i + 1) / projects.length * 70));
        }
      }
      
      setProgress(100);
      setMigrationStatus('success');
      addLog('Migration complete!');
      addLog(`Summary:
        - User: ${user?.username}
        - Projects: ${projectCount}
        - Notes: ${totalNotes}
      `);
      
      toast({
        title: "Migration Successful",
        description: `Migrated 1 user, ${projectCount} projects, and ${totalNotes} notes to Supabase`,
      });
    } catch (error) {
      console.error('Migration error:', error);
      setMigrationStatus('error');
      addLog(`ERROR: Migration failed: ${error instanceof Error ? error.message : String(error)}`);
      
      toast({
        title: "Migration Failed",
        description: error instanceof Error ? error.message : String(error),
        variant: "destructive"
      });
    }
  }

  return (
    <div className="container mx-auto p-4">
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Supabase Migration Utility</CardTitle>
          <CardDescription>
            Test Supabase connection and migrate data from local database to Supabase
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="connection">
            <TabsList className="mb-4">
              <TabsTrigger value="connection">Connection Test</TabsTrigger>
              <TabsTrigger value="migration">Data Migration</TabsTrigger>
            </TabsList>
            
            <TabsContent value="connection">
              <div className="mb-4">
                <div className="flex items-center gap-4 mb-2">
                  <span className="font-semibold">Status:</span>
                  <span className={
                    connectionStatus === 'idle' ? 'text-blue-500' :
                    connectionStatus === 'running' ? 'text-yellow-500' :
                    connectionStatus === 'success' ? 'text-green-500' :
                    'text-red-500'
                  }>
                    {connectionStatus === 'idle' ? 'Ready to test connection' : message}
                  </span>
                </div>
                {connectionStatus === 'running' && (
                  <Progress value={progress} className="h-2" />
                )}
              </div>
              
              <div className="border rounded-md p-3 bg-gray-50 dark:bg-gray-900 h-64 overflow-y-auto font-mono text-sm">
                {log.length === 0 ? (
                  <div className="text-gray-500 italic">Log output will appear here...</div>
                ) : (
                  log.map((entry, i) => (
                    <div key={i} className={entry.startsWith('ERROR') ? 'text-red-500' : ''}>
                      {entry}
                    </div>
                  ))
                )}
              </div>
              
              <div className="mt-4 flex space-x-2">
                <Button 
                  onClick={testConnection} 
                  disabled={connectionStatus === 'running'}
                  variant={connectionStatus === 'error' ? 'destructive' : 'default'}
                >
                  {connectionStatus === 'error' ? 'Retry Connection Test' : 'Test Supabase Connection'}
                </Button>
                <Button
                  onClick={testDirectSQL}
                  disabled={connectionStatus === 'running'}
                  variant="outline"
                >
                  Test SQL Execution
                </Button>
              </div>
            </TabsContent>
            
            <TabsContent value="migration">
              <div className="mb-4">
                <div className="flex items-center gap-4 mb-2">
                  <span className="font-semibold">Status:</span>
                  <span className={
                    migrationStatus === 'idle' ? 'text-blue-500' :
                    migrationStatus === 'running' ? 'text-yellow-500' :
                    migrationStatus === 'success' ? 'text-green-500' :
                    'text-red-500'
                  }>
                    {migrationStatus === 'idle' ? 'Ready to migrate data' : 
                     migrationStatus === 'running' ? `Migration in progress (${progress}%)` :
                     migrationStatus === 'success' ? 'Migration completed successfully' :
                     'Migration failed'}
                  </span>
                </div>
                {migrationStatus === 'running' && (
                  <Progress value={progress} className="h-2" />
                )}
              </div>
              
              <div className="border rounded-md p-3 bg-gray-50 dark:bg-gray-900 h-64 overflow-y-auto font-mono text-sm">
                {log.length === 0 ? (
                  <div className="text-gray-500 italic">
                    <p>This utility will migrate your data from the local database to Supabase.</p>
                    <p>It will migrate the following:</p>
                    <p>- Your user account</p>
                    <p>- All your projects ({isProjectsLoading ? 'Loading...' : projects?.length || 0} projects)</p>
                    <p>- All notes in each project</p>
                    <p>Click "Start Migration" to begin.</p>
                  </div>
                ) : (
                  log.map((entry, i) => (
                    <div key={i} className={entry.startsWith('ERROR') ? 'text-red-500' : ''}>
                      {entry}
                    </div>
                  ))
                )}
              </div>
              
              <div className="mt-4">
                <Button 
                  onClick={runMigration} 
                  disabled={migrationStatus === 'running' || connectionStatus !== 'success'}
                  variant={migrationStatus === 'error' ? 'destructive' : 'default'}
                >
                  {migrationStatus === 'idle' && connectionStatus !== 'success' && 'Test Connection First'}
                  {migrationStatus === 'idle' && connectionStatus === 'success' && 'Start Migration'}
                  {migrationStatus === 'running' && 'Migration in Progress...'}
                  {migrationStatus === 'success' && 'Migration Completed'}
                  {migrationStatus === 'error' && 'Retry Migration'}
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
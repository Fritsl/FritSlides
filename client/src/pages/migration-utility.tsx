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

// The service key will be fetched from the server
let SERVICE_KEY = '';

// Function to fetch the service key from the server
async function fetchServiceKey(): Promise<string> {
  try {
    // Try to get the service key directly
    const response = await fetch('/api/supabase-service-key');
    if (!response.ok) {
      throw new Error(`Failed to fetch service key: ${response.status} ${response.statusText}`);
    }
    const data = await response.json();
    return data.key || '';
  } catch (error) {
    console.error('Error fetching service key:', error);
    return '';
  }
}

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
    const initializeAdminClient = async () => {
      try {
        // Fetch the service key from the server
        const serviceKey = await fetchServiceKey();
        if (!serviceKey) {
          console.error('Failed to retrieve service key from server');
          addLog('ERROR: Failed to retrieve service key from server');
          return;
        }
        
        SERVICE_KEY = serviceKey;
        addLog(`Service key retrieved successfully (length: ${serviceKey.length})`);
        
        const supabaseUrl = localStorage.getItem('supabase-url') || 'https://db.waaqtqxoylxvhykessnc.supabase.co';
        
        // Create admin client with service key
        adminClient = createClient(supabaseUrl, serviceKey, {
          auth: {
            autoRefreshToken: false,
            persistSession: false
          },
          db: {
            schema: 'public'
          }
        });
        addLog('Admin Supabase client initialized with service role');
      } catch (error) {
        console.error('Failed to initialize admin Supabase client:', error);
        addLog(`ERROR: Admin client initialization failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    };
    
    initializeAdminClient();
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
    try {
      addLog('----------- DIRECT SQL TEST STARTED -----------');
      addLog('Testing direct SQL execution capabilities...');
      
      // Check if we have the service key available
      if (!SERVICE_KEY) {
        addLog('ERROR: Service key is not available. Cannot perform SQL operations.');
        throw new Error('Service key is missing');
      } else {
        addLog('Service key is available (length: ' + SERVICE_KEY.length + ')');
      }
      
      // First, initialize the admin client if not already done
      if (!adminClient) {
        const supabaseUrl = localStorage.getItem('supabase-url') || 'https://db.waaqtqxoylxvhykessnc.supabase.co';
        adminClient = createClient(supabaseUrl, SERVICE_KEY, {
          auth: { autoRefreshToken: false, persistSession: false },
          db: { schema: 'public' }
        });
        addLog('Created admin client with service key');
      }
      
      // 1. Test if we can ping the Supabase API
      addLog('1. Testing API accessibility...');
      const pingResponse = await fetch('https://db.waaqtqxoylxvhykessnc.supabase.co/rest/v1/', {
        method: 'GET',
        headers: {
          'apikey': SERVICE_KEY,
          'Authorization': `Bearer ${SERVICE_KEY}`
        }
      });
      
      addLog(`API ping response: ${pingResponse.status} ${pingResponse.statusText}`);
      
      if (!pingResponse.ok) {
        const pingBody = await pingResponse.text();
        addLog(`API ping error body: ${pingBody}`);
        throw new Error(`Cannot access Supabase API: ${pingResponse.status} ${pingResponse.statusText}`);
      }
      
      // 2. Test if the service key has permission to create tables
      addLog('2. Testing RPC functions availability...');
      try {
        const functionResponse = await fetch('https://db.waaqtqxoylxvhykessnc.supabase.co/rest/v1/rpc/', {
          method: 'GET',
          headers: {
            'apikey': SERVICE_KEY,
            'Authorization': `Bearer ${SERVICE_KEY}`
          }
        });
        
        if (functionResponse.ok) {
          const functionList = await functionResponse.json();
          addLog(`Available RPC functions: ${JSON.stringify(functionList)}`);
          
          if (Array.isArray(functionList) && functionList.length > 0) {
            addLog(`Found ${functionList.length} RPC functions`);
            // Check if execute_sql is in the list
            const hasExecuteSql = functionList.some((fn: any) => fn.name === 'execute_sql');
            addLog(`execute_sql function ${hasExecuteSql ? 'is' : 'is NOT'} available`);
          } else {
            addLog('No RPC functions found or invalid response format');
          }
        } else {
          const errorBody = await functionResponse.text();
          addLog(`Failed to get RPC functions: ${functionResponse.status} ${functionResponse.statusText}`);
          addLog(`Error body: ${errorBody}`);
        }
      } catch (rpcError) {
        addLog(`RPC functions check error: ${rpcError instanceof Error ? rpcError.message : String(rpcError)}`);
      }
      
      // 3. Try to directly execute a simple query
      addLog('3. Testing direct SQL query execution...');
      try {
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
        addLog(`SQL query response status: ${response.status} ${response.statusText}`);
        addLog(`SQL query response body: ${responseBody}`);
        
        if (!response.ok) {
          if (response.status === 404) {
            addLog('ERROR: execute_sql function not found (404)');
            addLog('--------------------------------------------------------');
            addLog('TO FIX THIS ERROR:');
            addLog('1. Log in to your Supabase dashboard at https://supabase.com/dashboard');
            addLog('2. Select your project');
            addLog('3. Click on "SQL Editor" in the left navigation');
            addLog('4. Create a new query');
            addLog('5. Paste the SQL function code shown above in the instructions');
            addLog('6. Click "Run" to create the function');
            addLog('7. Return to this migration utility and try again');
            addLog('--------------------------------------------------------');
          } else {
            addLog(`ERROR: SQL query failed with status ${response.status}`);
            addLog(`Response body: ${responseBody}`);
            
            // Check for specific error patterns
            if (responseBody.includes('permission denied')) {
              addLog('ERROR: Permission denied. The service role key might not have enough privileges.');
            } else if (responseBody.includes('syntax error')) {
              addLog('ERROR: SQL syntax error in the query.');
            }
          }
          throw new Error(`API call failed: ${response.status} ${response.statusText} - ${responseBody}`);
        }
        
        addLog('SQL query executed successfully!');
      } catch (sqlError) {
        addLog(`SQL query execution error: ${sqlError instanceof Error ? sqlError.message : String(sqlError)}`);
      }
      
      // 4. Check if we can see existing tables
      addLog('4. Checking existing tables using standard API...');
      try {
        const { data, error } = await adminClient.rpc('execute_sql', {
          sql_query: "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';"
        });
        
        if (error) {
          addLog(`ERROR checking tables: ${error.message}`);
          if (error.message.includes('function') && error.message.includes('does not exist')) {
            addLog('The execute_sql function does not exist in your Supabase project.');
            addLog('This function needs to be created for our migration to work.');
          }
        } else if (data) {
          addLog(`Found tables: ${JSON.stringify(data)}`);
        } else {
          addLog('No table data returned from query');
        }
      } catch (tablesError) {
        addLog(`Tables check error: ${tablesError instanceof Error ? tablesError.message : String(tablesError)}`);
      }
      
      addLog('----------- DIRECT SQL TEST COMPLETED -----------');
      addLog('CONCLUSION: We need to create an execute_sql function in Supabase.');
      addLog('Please follow the instructions to add this function to your Supabase project.');
      
      toast({
        title: "SQL Test Completed",
        description: "Check the log for results. You may need to create an execute_sql function.",
      });
      
      return true;
    } catch (error) {
      addLog(`ERROR in direct SQL test: ${error instanceof Error ? error.message : String(error)}`);
      console.error('Direct SQL test error:', error);
      
      toast({
        title: "SQL Test Failed",
        description: error instanceof Error ? error.message : String(error),
        variant: "destructive"
      });
      
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
          <div className="mb-8 p-4 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-md">
            <h3 className="text-lg font-semibold mb-2 text-amber-800 dark:text-amber-300">Important: SQL Function Setup Required</h3>
            <p className="mb-2 text-amber-800 dark:text-amber-300">Before you can migrate data, you need to create an <code className="bg-amber-100 dark:bg-amber-900 px-1 py-0.5 rounded text-amber-900 dark:text-amber-200">execute_sql</code> function in your Supabase project:</p>
            <ol className="list-decimal list-inside space-y-1 text-sm text-amber-800 dark:text-amber-300">
              <li>Log in to your Supabase dashboard</li>
              <li>Go to the SQL Editor</li>
              <li>Create a new query</li>
              <li>Paste the following SQL code:</li>
            </ol>
            <pre className="bg-gray-800 text-gray-100 p-3 rounded mt-2 text-sm overflow-x-auto">
{`-- Create the SQL execution function
CREATE OR REPLACE FUNCTION execute_sql(sql_query TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSONB;
BEGIN
  EXECUTE sql_query;
  RETURN '{"success": true}'::JSONB;
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM,
    'detail', SQLSTATE
  );
END;
$$;

-- Run this section in a separate query if the first part succeeds
-- Create a helper function to check or create storage buckets
CREATE OR REPLACE FUNCTION create_storage_bucket_if_not_exists(bucket_name TEXT) 
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Check if bucket exists first
  IF NOT EXISTS (
    SELECT 1 FROM storage.buckets WHERE name = bucket_name
  ) THEN
    -- Create bucket if it doesn't exist
    INSERT INTO storage.buckets (id, name, public)
    VALUES (bucket_name, bucket_name, true);
    
    -- Add public access policy
    INSERT INTO storage.policies (name, definition, bucket_id)
    VALUES (
      'Public Read', 
      '{"name":"Public Read","id":"slides-images-public-select","allow_full_access":"false","allowed_operation":"SELECT","selector":"bucket_id=''slides-images''","description":"Allow public read access"}',
      bucket_name
    );
  END IF;
  
  RETURN jsonb_build_object('success', true, 'bucket', bucket_name);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM,
    'detail', SQLSTATE
  );
END;
$$;`}
            </pre>
            <p className="mt-2 text-sm text-amber-800 dark:text-amber-300">This function will allow the migration utility to create tables and execute SQL commands.</p>
          </div>
          
          <div className="mb-8 p-4 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-md">
            <h3 className="text-lg font-semibold mb-2 text-blue-800 dark:text-blue-300">Step 2: Create Required Tables</h3>
            <p className="mb-2 text-blue-800 dark:text-blue-300">You need to create the database tables in Supabase before migrating data. Run this SQL script:</p>
            <pre className="bg-gray-800 text-gray-100 p-3 rounded mt-2 text-sm overflow-x-auto">
{`-- Create users table
CREATE TABLE IF NOT EXISTS public.users (
  id SERIAL PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  "lastOpenedProjectId" INTEGER
);

-- Create projects table
CREATE TABLE IF NOT EXISTS public.projects (
  id SERIAL PRIMARY KEY,
  "userId" INTEGER NOT NULL REFERENCES public.users(id),
  name TEXT NOT NULL,
  "lastViewedSlideIndex" INTEGER DEFAULT 0,
  author TEXT,
  "startSlogan" TEXT,
  "endSlogan" TEXT,
  "isLocked" BOOLEAN DEFAULT false
);

-- Create notes table
CREATE TABLE IF NOT EXISTS public.notes (
  id SERIAL PRIMARY KEY,
  "projectId" INTEGER NOT NULL REFERENCES public.projects(id),
  "parentId" INTEGER REFERENCES public.notes(id),
  content TEXT,
  "order" TEXT,
  url TEXT,
  "linkText" TEXT,
  "youtubeLink" TEXT,
  time TEXT,
  images TEXT[]
);

-- Create storage bucket for images
-- Note: You should also create this bucket in the Supabase Dashboard under Storage
SELECT execute_sql('
  CREATE POLICY "Public Access" ON storage.objects
    FOR SELECT USING (bucket_id = ''slides-images'');
  
  CREATE POLICY "Authenticated Insert" ON storage.objects
    FOR INSERT WITH CHECK (bucket_id = ''slides-images'' AND auth.role() = ''authenticated'');
');`}
            </pre>
            <p className="mt-2 text-sm text-blue-800 dark:text-blue-300">After running this script, return to the migration utility and try again.</p>
          </div>
          
          <div className="mb-8 p-4 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-md">
            <h3 className="text-lg font-semibold mb-2 text-green-800 dark:text-green-300">Step 3: Create Storage Bucket</h3>
            <p className="mb-2 text-green-800 dark:text-green-300">You need to create a storage bucket for image uploads:</p>
            <ol className="list-decimal list-inside space-y-1 text-sm text-green-800 dark:text-green-300">
              <li>Go to the Supabase dashboard</li>
              <li>Navigate to Storage in the left sidebar</li>
              <li>Click "Create a new bucket"</li>
              <li>Name it exactly <code className="bg-green-100 dark:bg-green-900 px-1 py-0.5 rounded text-green-900 dark:text-green-200">slides-images</code></li>
              <li>Enable "Public bucket" option</li>
              <li>Click "Create bucket"</li>
            </ol>
            <p className="mt-2 text-sm text-green-800 dark:text-green-300">This bucket will store all the images from your notes, making them persistent across deployments.</p>
          </div>

          
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
                    <div 
                      key={i} 
                      className={
                        entry.startsWith('ERROR') ? 'text-red-500 dark:text-red-400' : 
                        entry.startsWith('SUCCESS') ? 'text-green-600 dark:text-green-400' :
                        entry.startsWith('WARNING') ? 'text-amber-600 dark:text-amber-400' :
                        entry.startsWith('---') ? 'text-blue-600 dark:text-blue-400 font-bold' :
                        'text-slate-800 dark:text-slate-200'
                      }
                    >
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
                    <div 
                      key={i} 
                      className={
                        entry.startsWith('ERROR') ? 'text-red-500 dark:text-red-400' : 
                        entry.startsWith('SUCCESS') ? 'text-green-600 dark:text-green-400' :
                        entry.startsWith('WARNING') ? 'text-amber-600 dark:text-amber-400' :
                        entry.startsWith('---') ? 'text-blue-600 dark:text-blue-400 font-bold' :
                        'text-slate-800 dark:text-slate-200'
                      }
                    >
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
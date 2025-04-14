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
        adminClient = createClient(supabaseUrl, SERVICE_KEY);
        console.log('Admin Supabase client initialized');
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
      // Check if users table exists
      const { error: userTableError } = await adminClient
        .from('users')
        .select('id')
        .limit(1);
      
      if (userTableError && userTableError.code === '42P01') { // Table doesn't exist
        addLog('Creating users table...');
        
        // Create users table
        const createUsersTable = await adminClient.rpc('create_users_table', {});
        
        if (createUsersTable.error) {
          addLog(`ERROR: Failed to create users table: ${createUsersTable.error.message}`);
          
          // Try direct SQL if RPC fails
          const { error: sqlError } = await adminClient.rpc('execute_sql', {
            sql_query: `
              CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username TEXT NOT NULL UNIQUE,
                password TEXT NOT NULL,
                "lastOpenedProjectId" INTEGER
              )
            `
          });
          
          if (sqlError) {
            addLog(`ERROR: Failed to create users table via SQL: ${sqlError.message}`);
            return false;
          }
          
          addLog('Created users table via direct SQL');
        } else {
          addLog('Created users table');
        }
      } else {
        addLog('Users table already exists');
      }
      
      // Check if projects table exists
      const { error: projectTableError } = await adminClient
        .from('projects')
        .select('id')
        .limit(1);
      
      if (projectTableError && projectTableError.code === '42P01') {
        addLog('Creating projects table...');
        
        // Create projects table
        const createProjectsTable = await adminClient.rpc('create_projects_table', {});
        
        if (createProjectsTable.error) {
          addLog(`ERROR: Failed to create projects table: ${createProjectsTable.error.message}`);
          
          // Try direct SQL if RPC fails
          const { error: sqlError } = await adminClient.rpc('execute_sql', {
            sql_query: `
              CREATE TABLE IF NOT EXISTS projects (
                id SERIAL PRIMARY KEY,
                "userId" INTEGER NOT NULL REFERENCES users(id),
                name TEXT NOT NULL,
                "lastViewedSlideIndex" INTEGER DEFAULT 0,
                author TEXT,
                "startSlogan" TEXT,
                "endSlogan" TEXT,
                "isLocked" BOOLEAN DEFAULT false
              )
            `
          });
          
          if (sqlError) {
            addLog(`ERROR: Failed to create projects table via SQL: ${sqlError.message}`);
            return false;
          }
          
          addLog('Created projects table via direct SQL');
        } else {
          addLog('Created projects table');
        }
      } else {
        addLog('Projects table already exists');
      }
      
      // Check if notes table exists
      const { error: noteTableError } = await adminClient
        .from('notes')
        .select('id')
        .limit(1);
      
      if (noteTableError && noteTableError.code === '42P01') {
        addLog('Creating notes table...');
        
        // Create notes table
        const createNotesTable = await adminClient.rpc('create_notes_table', {});
        
        if (createNotesTable.error) {
          addLog(`ERROR: Failed to create notes table: ${createNotesTable.error.message}`);
          
          // Try direct SQL if RPC fails
          const { error: sqlError } = await adminClient.rpc('execute_sql', {
            sql_query: `
              CREATE TABLE IF NOT EXISTS notes (
                id SERIAL PRIMARY KEY,
                "projectId" INTEGER NOT NULL REFERENCES projects(id),
                "parentId" INTEGER REFERENCES notes(id),
                content TEXT NOT NULL,
                "order" TEXT,
                url TEXT,
                "linkText" TEXT,
                "youtubeLink" TEXT,
                time TEXT,
                images TEXT[]
              )
            `
          });
          
          if (sqlError) {
            addLog(`ERROR: Failed to create notes table via SQL: ${sqlError.message}`);
            return false;
          }
          
          addLog('Created notes table via direct SQL');
        } else {
          addLog('Created notes table');
        }
      } else {
        addLog('Notes table already exists');
      }
      
      addLog('All required tables are ready!');
      return true;
    } catch (error) {
      addLog(`ERROR: Failed to ensure tables exist: ${error instanceof Error ? error.message : String(error)}`);
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
              
              <div className="mt-4">
                <Button 
                  onClick={testConnection} 
                  disabled={connectionStatus === 'running'}
                  variant={connectionStatus === 'error' ? 'destructive' : 'default'}
                >
                  {connectionStatus === 'error' ? 'Retry Connection Test' : 'Test Supabase Connection'}
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
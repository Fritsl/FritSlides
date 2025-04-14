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

  function addLog(entry: string) {
    setLog(prev => [...prev, entry]);
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

      // Try to access the users table
      addLog('Testing database access...');
      const { data, error } = await supabase.from('users').select('id').limit(1);
      
      if (error) {
        throw new Error(`Database access error: ${error.message}`);
      }
      
      addLog(`Database access successful: ${data ? data.length : 0} users found`);

      // Test storage access
      addLog('Testing storage access...');
      try {
        // Try to get a specific bucket
        const { data, error } = await supabase.storage.from('slides-images').list();
        
        if (error) {
          throw new Error(`Storage access error: ${error.message}`);
        }
        
        addLog(`Storage access successful: accessed 'slides-images' bucket`);
      } catch (error) {
        if (error instanceof Error && error.message.includes('storage.from')) {
          throw new Error('Storage client not properly initialized');
        } else {
          throw error;
        }
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
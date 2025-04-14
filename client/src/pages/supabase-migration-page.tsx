import { useState } from "react";
import { useLocation } from "wouter";
import { Loader2, ServerCrash, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SupabaseNav } from "@/components/ui/supabase-nav";
import { useSupabaseAuth } from "@/hooks/use-supabase-auth";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { getSupabaseClient } from "@/lib/supabase";

export default function SupabaseMigrationPage() {
  const [_, setLocation] = useLocation();
  const { user, isLoading } = useSupabaseAuth();
  const [migrationStatus, setMigrationStatus] = useState<"idle" | "migrating" | "success" | "error">("idle");
  const [progressMessage, setProgressMessage] = useState("");

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    setLocation("/auth/supabase");
    return null;
  }

  const startMigration = async () => {
    try {
      setMigrationStatus("migrating");
      setProgressMessage("Starting migration...");

      // 1. Fetch all current projects and notes
      setProgressMessage("Fetching projects and notes from local database...");
      const projectsResponse = await fetch("/api/projects");
      
      if (!projectsResponse.ok) {
        throw new Error("Failed to fetch projects from local database");
      }
      
      const projects = await projectsResponse.json();
      
      if (!projects.length) {
        setProgressMessage("No projects found in local database to migrate.");
        setMigrationStatus("success");
        return;
      }
      
      setProgressMessage(`Found ${projects.length} projects to migrate.`);
      
      // 2. Get Supabase client
      const supabase = await getSupabaseClient();
      
      // 3. Migrate projects and notes
      let migratedProjects = 0;
      let migratedNotes = 0;
      
      for (const project of projects) {
        setProgressMessage(`Migrating project ${project.name}...`);
        
        // Get notes for this project
        const notesResponse = await fetch(`/api/projects/${project.id}/notes`);
        
        if (!notesResponse.ok) {
          console.error(`Failed to fetch notes for project ${project.id}`);
          continue;
        }
        
        const notes = await notesResponse.json();
        
        // Insert project to Supabase
        const { data: projectData, error: projectError } = await supabase
          .from("projects")
          .insert({
            name: project.name,
            user_id: user.id,
            start_slogan: project.startSlogan || null,
            end_slogan: project.endSlogan || null,
            author: project.author || null,
            last_viewed_slide_index: project.lastViewedSlideIndex || 0,
            is_locked: project.isLocked || false,
            created_at: project.createdAt || new Date().toISOString()
          })
          .select()
          .single();
        
        if (projectError) {
          console.error(`Failed to migrate project ${project.id}:`, projectError);
          continue;
        }
        
        migratedProjects++;
        
        // Now insert all notes for this project
        if (notes.length > 0) {
          setProgressMessage(`Migrating ${notes.length} notes for project ${project.name}...`);
          
          for (const note of notes) {
            const { error: noteError } = await supabase
              .from("notes")
              .insert({
                project_id: projectData.id,
                parent_id: note.parentId,
                content: note.content,
                url: note.url || null,
                link_text: note.linkText || null,
                youtube_link: note.youtubeLink || null,
                time: note.time || null,
                is_discussion: note.isDiscussion || false,
                images: note.images || [],
                order: note.order || 0,
                created_at: note.createdAt || new Date().toISOString(),
                updated_at: note.updatedAt || new Date().toISOString()
              });
            
            if (noteError) {
              console.error(`Failed to migrate note ${note.id}:`, noteError);
              continue;
            }
            
            migratedNotes++;
          }
        }
      }
      
      setProgressMessage(`Migration complete! Migrated ${migratedProjects} projects and ${migratedNotes} notes.`);
      setMigrationStatus("success");
    } catch (error) {
      console.error("Migration error:", error);
      setProgressMessage(`Migration failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setMigrationStatus("error");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <SupabaseNav />
      
      <div className="max-w-3xl mx-auto p-6">
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Data Migration</CardTitle>
            <CardDescription>
              Migrate your data from the local database to Supabase
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="mb-4">
              This will copy all your projects and notes from the local database to your Supabase account.
              Your original data will remain untouched.
            </p>
            
            {migrationStatus === "idle" && (
              <Button onClick={startMigration}>
                Start Migration
              </Button>
            )}
            
            {migrationStatus === "migrating" && (
              <div className="flex items-center space-x-4">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                <p>{progressMessage}</p>
              </div>
            )}
            
            {migrationStatus === "success" && (
              <Alert variant="default" className="bg-green-50 border-green-200">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <AlertTitle className="text-green-800">Migration Successful</AlertTitle>
                <AlertDescription className="text-green-700">
                  {progressMessage}
                </AlertDescription>
              </Alert>
            )}
            
            {migrationStatus === "error" && (
              <Alert variant="destructive">
                <ServerCrash className="h-5 w-5" />
                <AlertTitle>Migration Failed</AlertTitle>
                <AlertDescription>
                  {progressMessage}
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
        
        {migrationStatus === "success" && (
          <div className="text-center">
            <Button onClick={() => setLocation("/")}>
              Go to Dashboard
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
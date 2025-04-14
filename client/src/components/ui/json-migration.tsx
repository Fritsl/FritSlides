import { useState } from "react";
import { Loader2, UploadCloud, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useSupabaseAuth } from "@/hooks/use-supabase-auth";
import { getSupabaseClient } from "@/lib/supabase";

export default function JsonMigration() {
  const { user } = useSupabaseAuth();
  const [jsonContent, setJsonContent] = useState("");
  const [status, setStatus] = useState<"idle" | "processing" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  const handleJsonImport = async () => {
    if (!jsonContent.trim() || !user) {
      setStatus("error");
      setMessage("Please enter valid JSON content and ensure you're logged in");
      return;
    }

    try {
      setStatus("processing");
      setMessage("Parsing JSON data...");

      // Parse the JSON
      let data;
      try {
        data = JSON.parse(jsonContent);
      } catch (error) {
        throw new Error("Invalid JSON format. Please check your input.");
      }

      if (!data.projects || !Array.isArray(data.projects)) {
        throw new Error("JSON must contain an array of projects");
      }

      // Get Supabase client
      const supabase = await getSupabaseClient();
      
      setMessage("Importing projects and notes...");
      
      let importedProjects = 0;
      let importedNotes = 0;
      
      // Import each project
      for (const project of data.projects) {
        if (!project.name) {
          console.warn("Skipping project without a name");
          continue;
        }
        
        // Insert project
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
          console.error(`Failed to import project ${project.name}:`, projectError);
          continue;
        }
        
        importedProjects++;
        
        // Import notes if present
        if (project.notes && Array.isArray(project.notes)) {
          for (const note of project.notes) {
            if (!note.content) {
              console.warn("Skipping note without content");
              continue;
            }
            
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
              console.error(`Failed to import note:`, noteError);
              continue;
            }
            
            importedNotes++;
          }
        }
      }
      
      setStatus("success");
      setMessage(`Successfully imported ${importedProjects} projects and ${importedNotes} notes`);
    } catch (error) {
      console.error("Import error:", error);
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Unknown error occurred during import");
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Import from JSON</CardTitle>
        <CardDescription>
          Import projects and notes from a JSON file
        </CardDescription>
      </CardHeader>
      <CardContent>
        {status === "success" ? (
          <Alert variant="default" className="bg-green-50 border-green-200 mb-4">
            <CheckCircle className="h-5 w-5 text-green-600" />
            <AlertTitle className="text-green-800">Import Successful</AlertTitle>
            <AlertDescription className="text-green-700">
              {message}
            </AlertDescription>
          </Alert>
        ) : status === "error" ? (
          <Alert variant="destructive" className="mb-4">
            <AlertTitle>Import Failed</AlertTitle>
            <AlertDescription>
              {message}
            </AlertDescription>
          </Alert>
        ) : null}
        
        <div className="space-y-4">
          <Textarea
            placeholder="Paste your JSON data here..."
            className="min-h-[200px]"
            value={jsonContent}
            onChange={(e) => setJsonContent(e.target.value)}
            disabled={status === "processing"}
          />
          
          <Button 
            onClick={handleJsonImport} 
            disabled={status === "processing" || !jsonContent.trim() || !user}
          >
            {status === "processing" ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Importing...
              </>
            ) : (
              <>
                <UploadCloud className="mr-2 h-4 w-4" />
                Import
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { useSupabaseAuth } from "@/hooks/use-supabase-auth";
import { Progress } from "@/components/ui/progress";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { AlertCircle, ArrowUp, ArrowDown, FileJson } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

// Define types for our JSON data
interface JsonNote {
  id: number;
  content: string;
  parentId?: number | null;
  position?: number;
  order?: string | number;
  url?: string | null;
  linkText?: string | null;
  youtubeLink?: string | null;
  time?: string | null;
  images?: string[];
  children?: JsonNote[];
}

interface JsonProject {
  name: string;
  notes: JsonNote[];
}

export function JsonMigration() {
  const { user } = useSupabaseAuth();
  const { toast } = useToast();
  const [jsonInput, setJsonInput] = useState("");
  const [progress, setProgress] = useState(0);
  const [isImporting, setIsImporting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Add to log function
  const addLog = (message: string) => {
    setLog(prev => [...prev, message]);
  };

  // Handle import from JSON
  const handleImport = async () => {
    if (!user) {
      setError("You must be logged in to import data");
      return;
    }

    try {
      setIsImporting(true);
      setError(null);
      setProgress(0);
      setLog([]);
      addLog("Starting import process...");

      // Parse JSON input
      let importData: JsonProject;
      try {
        importData = JSON.parse(jsonInput);
        addLog("Successfully parsed JSON data");
      } catch (error) {
        throw new Error("Invalid JSON format. Please check your input.");
      }

      if (!importData.name || !importData.notes || !Array.isArray(importData.notes)) {
        throw new Error("Invalid data structure. JSON must contain 'name' and 'notes' array.");
      }

      addLog(`Project name: ${importData.name}`);
      addLog(`Found ${importData.notes.length} top-level notes`);
      setProgress(10);

      // Create project in Supabase
      const { data: projectData, error: projectError } = await supabase
        .from("projects")
        .insert({
          name: importData.name,
          user_id: user.id,
          last_viewed_slide_index: 0,
        })
        .select()
        .single();

      if (projectError) {
        throw new Error(`Failed to create project: ${projectError.message}`);
      }

      const projectId = projectData.id;
      addLog(`Created project with ID: ${projectId}`);
      setProgress(20);

      // Process notes (first pass - create all notes without parent references)
      const noteMap = new Map<number, number>(); // Map old IDs to new IDs
      const allNotes = flattenNotes(importData.notes);
      addLog(`Total notes to import: ${allNotes.length}`);

      for (let i = 0; i < allNotes.length; i++) {
        const note = allNotes[i];
        setProgress(20 + Math.floor((i / allNotes.length) * 40)); // Progress from 20% to 60%

        // Create note in Supabase without parent reference
        const { data: noteData, error: noteError } = await supabase
          .from("notes")
          .insert({
            content: note.content,
            project_id: projectId,
            parent_id: null, // Will update in second pass
            order: note.order || (i + 1).toString(),
            url: note.url || null,
            link_text: note.linkText || null,
            youtube_link: note.youtubeLink || null,
            time: note.time || null,
            images: note.images || []
          })
          .select()
          .single();

        if (noteError) {
          addLog(`Error creating note: ${noteError.message}`);
          continue;
        }

        // Store mapping of old ID to new ID
        noteMap.set(note.id, noteData.id);
        addLog(`Created note ${i + 1}/${allNotes.length}: ID ${noteData.id}`);
      }
      
      setProgress(60);
      addLog("All notes created, updating parent references...");

      // Second pass - update parent references
      let updateCount = 0;
      for (const note of allNotes) {
        if (note.parentId !== undefined && note.parentId !== null) {
          const newNoteId = noteMap.get(note.id);
          const newParentId = noteMap.get(note.parentId);

          if (newNoteId && newParentId) {
            const { error: updateError } = await supabase
              .from("notes")
              .update({ parent_id: newParentId })
              .eq("id", newNoteId);

            if (updateError) {
              addLog(`Error updating parent reference: ${updateError.message}`);
            } else {
              updateCount++;
            }
          }
        }
        
        setProgress(60 + Math.floor((updateCount / allNotes.length) * 30)); // Progress from 60% to 90%
      }

      addLog(`Updated ${updateCount} parent references`);
      setProgress(100);
      addLog("Import completed successfully!");

      toast({
        title: "Import Successful",
        description: `Imported project "${importData.name}" with ${allNotes.length} notes`,
      });

    } catch (error: any) {
      setError(error.message || "An unexpected error occurred during import");
      toast({
        title: "Import Failed",
        description: error.message || "Failed to import data",
        variant: "destructive",
      });
    } finally {
      setIsImporting(false);
    }
  };

  // Handle export to JSON
  const handleExport = async () => {
    if (!user) {
      setError("You must be logged in to export data");
      return;
    }

    try {
      setIsExporting(true);
      setError(null);
      setLog([]);
      addLog("Starting export process...");

      // Get all projects for the user
      const { data: projects, error: projectsError } = await supabase
        .from("projects")
        .select("id, name")
        .eq("user_id", user.id);

      if (projectsError) {
        throw new Error(`Failed to retrieve projects: ${projectsError.message}`);
      }

      if (!projects || projects.length === 0) {
        throw new Error("No projects found to export");
      }

      addLog(`Found ${projects.length} projects`);
      
      // For simplicity, we'll export the first project
      // In a complete implementation, you might want to add a project selection UI
      const projectId = projects[0].id;
      const projectName = projects[0].name;
      
      addLog(`Exporting project: ${projectName} (ID: ${projectId})`);

      // Get all notes for the project
      const { data: notes, error: notesError } = await supabase
        .from("notes")
        .select("*")
        .eq("project_id", projectId);

      if (notesError) {
        throw new Error(`Failed to retrieve notes: ${notesError.message}`);
      }

      addLog(`Found ${notes.length} notes to export`);

      // Transform notes to our export format
      const transformedNotes = notes.map(note => ({
        id: note.id,
        content: note.content,
        parentId: note.parent_id,
        order: note.order,
        url: note.url,
        linkText: note.link_text,
        youtubeLink: note.youtube_link,
        time: note.time,
        images: note.images || []
      }));

      // Create the export object
      const exportData: JsonProject = {
        name: projectName,
        notes: buildNoteTree(transformedNotes)
      };

      // Convert to JSON
      const jsonOutput = JSON.stringify(exportData, null, 2);
      setJsonInput(jsonOutput);
      
      addLog("Export completed successfully!");
      
      toast({
        title: "Export Successful",
        description: `Exported project "${projectName}" with ${notes.length} notes`,
      });

    } catch (error: any) {
      setError(error.message || "An unexpected error occurred during export");
      toast({
        title: "Export Failed",
        description: error.message || "Failed to export data",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  // Handle file selection
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      setJsonInput(content);
      toast({
        title: "File Loaded",
        description: "JSON file has been loaded. Click Import to begin the import process."
      });
    };
    reader.readAsText(file);
  };

  // Helper function to flatten nested notes
  function flattenNotes(notes: JsonNote[], result: JsonNote[] = []): JsonNote[] {
    for (const note of notes) {
      const { children, ...noteWithoutChildren } = note;
      result.push(noteWithoutChildren);
      
      if (children && Array.isArray(children) && children.length > 0) {
        flattenNotes(children, result);
      }
    }
    return result;
  }

  // Helper function to build a hierarchical note tree
  function buildNoteTree(notes: JsonNote[]): JsonNote[] {
    const noteMap = new Map<number, JsonNote>();
    const rootNotes: JsonNote[] = [];
    
    // First pass: create map of all notes
    notes.forEach(note => {
      noteMap.set(note.id, { ...note, children: [] });
    });
    
    // Second pass: build tree structure
    notes.forEach(note => {
      const noteWithChildren = noteMap.get(note.id)!;
      
      if (note.parentId === null || note.parentId === undefined) {
        rootNotes.push(noteWithChildren);
      } else {
        const parent = noteMap.get(note.parentId);
        if (parent) {
          if (!parent.children) {
            parent.children = [];
          }
          parent.children.push(noteWithChildren);
        } else {
          // If parent doesn't exist, treat as root note
          rootNotes.push(noteWithChildren);
        }
      }
    });
    
    return rootNotes;
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>JSON Data Migration</CardTitle>
        <CardDescription>
          Import or export your data as JSON to migrate between systems or create backups.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!user && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Authentication Required</AlertTitle>
            <AlertDescription>
              You must be logged in with Supabase to use this feature.
              Please sign in or create an account.
            </AlertDescription>
          </Alert>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-2">
          <Label htmlFor="json-input">JSON Data</Label>
          <Textarea
            id="json-input"
            value={jsonInput}
            onChange={(e) => setJsonInput(e.target.value)}
            placeholder="Paste your JSON data here or upload a file..."
            className="min-h-[200px] font-mono text-sm"
            disabled={isImporting || isExporting}
          />
        </div>

        {(isImporting || isExporting) && (
          <div className="space-y-2">
            <Label>Progress</Label>
            <Progress value={progress} />
            <div className="text-sm text-gray-500">
              {isImporting ? "Importing" : "Exporting"}: {progress}% complete
            </div>
          </div>
        )}

        {log.length > 0 && (
          <div className="space-y-2 mt-4">
            <Label>Log</Label>
            <div className="bg-gray-100 p-3 rounded-md text-sm font-mono h-[150px] overflow-y-auto">
              {log.map((entry, index) => (
                <div key={index} className="pb-1">
                  {entry}
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
      <CardFooter className="flex justify-between flex-wrap gap-2">
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={isImporting || isExporting || !user}
          >
            <FileJson className="mr-2 h-4 w-4" /> Load File
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            className="hidden"
            onChange={handleFileSelect}
            disabled={isImporting || isExporting || !user}
          />
          
          <Button 
            variant="outline" 
            onClick={handleExport} 
            disabled={isImporting || isExporting || !user}
          >
            <ArrowUp className="mr-2 h-4 w-4" /> Export
          </Button>
        </div>
        
        <Button 
          onClick={handleImport} 
          disabled={!jsonInput || isImporting || isExporting || !user}
        >
          <ArrowDown className="mr-2 h-4 w-4" /> Import
        </Button>
      </CardFooter>
    </Card>
  );
}
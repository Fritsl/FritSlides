import { useState, useRef, useEffect } from "react";
import { useSupabaseAuth } from "@/hooks/use-supabase-auth";
import { useProjects } from "@/hooks/use-projects";
import { useNotes, useNoteEditing } from "@/hooks/use-notes";
import { useLastOpenedProject } from "@/hooks/use-last-project";
import { useLocation } from "wouter";
import Header from "@/components/ui/header";
import NoteTree from "@/components/ui/note-tree";
import { Button } from "@/components/ui/button";
import { Loader2, FolderPlus, FileText, FileJson } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger, 
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ImportDialog } from "@/components/ui/import-dialog";
import { SearchDialog } from "@/components/ui/search-dialog";
import { TimeDistributionDialog } from "@/components/ui/time-distribution-dialog";
import { useToast } from "@/hooks/use-toast";
import { Project } from "@shared/schema";
import { User } from "@supabase/supabase-js";

const projectSchema = z.object({
  name: z.string().min(1, "Project name is required").max(50, "Project name is too long"),
  startSlogan: z.string().nullable().optional(),
  endSlogan: z.string().nullable().optional(),
  author: z.string().nullable().optional(),
});

export default function HomePage() {
  const { user } = useSupabaseAuth();
  const { projects, isLoading: isLoadingProjects, createProject, updateProject } = useProjects();
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const { notes, isLoading: isLoadingNotes } = useNotes(selectedProjectId);
  const { editingNoteId } = useNoteEditing();
  const { lastOpenedProject, isLoading: isLoadingLastProject } = useLastOpenedProject();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  
  const [isNewProjectDialogOpen, setIsNewProjectDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [expandLevel, setExpandLevel] = useState<number>(-1); // Default to -1 (no specific level expansion)
  const [maxNoteDepth, setMaxNoteDepth] = useState<number>(0);
  
  // State for project settings dialog
  const [isProjectSettingsOpen, setIsProjectSettingsOpen] = useState(false);
  
  // State for search dialog
  const [isSearchDialogOpen, setIsSearchDialogOpen] = useState(false);
  
  // State to track if we're showing only notes with time markers
  const [showOnlyTimedNotes, setShowOnlyTimedNotes] = useState(false);
  
  // State to track which note should be focused in the tree
  const [focusedNoteId, setFocusedNoteId] = useState<number | null>(null);
  
  // Create a hidden anchor element for downloads
  const downloadLinkRef = useRef<HTMLAnchorElement | null>(null);

  // Load project from URL parameters or use last opened project
  useEffect(() => {
    if (isLoadingProjects || isLoadingLastProject) return;
    
    // Check if we have URL query parameters for project and note
    const params = new URLSearchParams(window.location.search);
    const projectIdParam = params.get('projectId');
    const noteIdParam = params.get('noteId');
    const fromPresentParam = params.get('fromPresent');
    
    // Debug logging
    console.log("URL Parameters:", { 
      projectIdParam, 
      noteIdParam, 
      fromPresentParam,
      fullUrl: window.location.href,
      search: window.location.search
    });
    
    if (projectIdParam && projects && projects.length > 0) {
      // If there's a projectId in the URL, validate and use it
      const projectId = parseInt(projectIdParam, 10);
      const projectExists = projects.some(p => p.id === projectId);
      
      if (projectExists) {
        setSelectedProjectId(projectId);
        
        // If there's also a noteId, focus that specific note
        if (noteIdParam) {
          try {
            const noteId = parseInt(noteIdParam, 10);
            if (!isNaN(noteId)) {
              console.log(`Setting focused note ID to ${noteId}`);
              setFocusedNoteId(noteId);
              
              // If we're coming from presentation mode or search, explicitly set expand level to show all
              // This ensures the note and its ancestors are visible
              if (fromPresentParam === 'true') {
                console.log("Coming from presentation mode, expanding all notes");
                setExpandLevel(-1); // Expand all
              }
            }
          } catch (e) {
            console.error("Error parsing note ID:", e);
          }
        }
        
        // Clear URL parameters to avoid reloading on refresh
        window.history.replaceState({}, document.title, window.location.pathname);
        return;
      }
    }
    
    // If no project ID in URL, or it wasn't valid, use the last opened project
    if (!selectedProjectId && projects && projects.length > 0) {
      // Try to use the last opened project first
      if (lastOpenedProject && lastOpenedProject.lastOpenedProjectId) {
        // Check if the project still exists in the list
        const projectExists = projects.some(p => p.id === lastOpenedProject.lastOpenedProjectId);
        if (projectExists) {
          setSelectedProjectId(lastOpenedProject.lastOpenedProjectId);
          return;
        }
      }
      
      // Fallback to the first project if no last project is found or it doesn't exist anymore
      setSelectedProjectId(projects[0].id);
    }
  }, [projects, lastOpenedProject, selectedProjectId, isLoadingProjects, isLoadingLastProject]);
  
  // Get selected project
  const selectedProject = projects?.find(p => p.id === selectedProjectId);

  // Form for creating a new project
  const form = useForm<z.infer<typeof projectSchema>>({
    resolver: zodResolver(projectSchema),
    defaultValues: {
      name: "",
      startSlogan: "",
      endSlogan: "",
      author: "",
    },
  });
  
  // Form for editing an existing project
  const projectEditForm = useForm<z.infer<typeof projectSchema>>({
    resolver: zodResolver(projectSchema),
    defaultValues: {
      name: selectedProject?.name || "",
      startSlogan: selectedProject?.startSlogan || "",
      endSlogan: selectedProject?.endSlogan || "",
      author: selectedProject?.author || "",
    },
  });
  
  // Update edit form when selected project changes
  useEffect(() => {
    if (selectedProject) {
      projectEditForm.reset({
        name: selectedProject.name,
        startSlogan: selectedProject.startSlogan || "",
        endSlogan: selectedProject.endSlogan || "",
        author: selectedProject.author || "",
      });
    }
  }, [selectedProject, projectEditForm]);
  
  // Listen for the custom events from Header component
  useEffect(() => {
    const handleOpenProjectSettings = (event: any) => {
      if (event.detail.projectId === selectedProjectId) {
        setIsProjectSettingsOpen(true);
      }
    };
    
    const handleOpenSearchDialog = (event: any) => {
      if (event.detail.projectId === selectedProjectId) {
        setIsSearchDialogOpen(true);
      }
    };
    
    window.addEventListener('openProjectSettings', handleOpenProjectSettings);
    window.addEventListener('openSearchDialog', handleOpenSearchDialog);
    
    return () => {
      window.removeEventListener('openProjectSettings', handleOpenProjectSettings);
      window.removeEventListener('openSearchDialog', handleOpenSearchDialog);
    };
  }, [selectedProjectId]);

  const onCreateProject = (values: z.infer<typeof projectSchema>) => {
    createProject.mutate(values, {
      onSuccess: (newProject) => {
        setIsNewProjectDialogOpen(false);
        setSelectedProjectId(newProject.id);
        form.reset();
        
        // Update the last opened project in Supabase
        console.log("Project created successfully, ID:", newProject.id);
      },
    });
  };
  
  const onUpdateProject = (id: number, name: string) => {
    updateProject.mutate({ id, name });
  };
  
  const onUpdateProjectSettings = (values: z.infer<typeof projectSchema>) => {
    if (!selectedProjectId) return;
    
    updateProject.mutate({
      id: selectedProjectId,
      name: values.name,
      startSlogan: values.startSlogan,
      endSlogan: values.endSlogan,
      author: values.author
    }, {
      onSuccess: () => {
        setIsProjectSettingsOpen(false);
        toast({
          title: "Project updated",
          description: "Project settings have been updated successfully",
        });
      }
    });
  };
  
  // Handle exporting notes
  // Function to handle JSON export
  const handleExportNotesJson = () => {
    if (!selectedProjectId || !selectedProject) {
      toast({
        title: "No project selected",
        description: "Please select a project to export notes from",
        variant: "destructive",
      });
      return;
    }
    
    // Create an anchor element if it doesn't exist
    if (!downloadLinkRef.current) {
      const link = document.createElement('a');
      link.style.display = 'none';
      document.body.appendChild(link);
      downloadLinkRef.current = link;
    }
    
    // Fetch the export data with authentication
    apiRequest("GET", `/api/projects/${selectedProjectId}/export`)
      .then(response => {
        if (!response.ok) {
          throw new Error("Failed to export notes");
        }
        return response.json();
      })
      .then(data => {
        // Create a Blob from the data
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        // Set up the download link
        if (downloadLinkRef.current) {
          downloadLinkRef.current.href = url;
          downloadLinkRef.current.download = `${selectedProject.name.replace(/\s+/g, '_')}_export_${new Date().toISOString().split('T')[0]}.json`;
          downloadLinkRef.current.click();
          
          // Clean up
          URL.revokeObjectURL(url);
        }
        
        toast({
          title: "Export successful",
          description: "Your notes have been exported to a JSON file",
        });
      })
      .catch(error => {
        toast({
          title: "Export failed",
          description: error.message,
          variant: "destructive",
        });
      });
  };

  // Function to handle Text export
  const handleExportNotesText = () => {
    if (!selectedProjectId || !selectedProject) {
      toast({
        title: "No project selected",
        description: "Please select a project to export notes from",
        variant: "destructive",
      });
      return;
    }
    
    // Create an anchor element if it doesn't exist
    if (!downloadLinkRef.current) {
      const link = document.createElement('a');
      link.style.display = 'none';
      document.body.appendChild(link);
      downloadLinkRef.current = link;
    }
    
    // Show loading toast
    toast({
      title: "Preparing text export",
      description: "Please wait while we format your notes...",
    });
    
    // Fetch the export data as text with authentication
    apiRequest("GET", `/api/projects/${selectedProjectId}/export-text`)
      .then(response => {
        if (!response.ok) {
          throw new Error("Failed to export notes as text");
        }
        return response.text();
      })
      .then(data => {
        // Create a Blob from the text data
        const blob = new Blob([data], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        
        // Set up the download link
        if (downloadLinkRef.current) {
          downloadLinkRef.current.href = url;
          downloadLinkRef.current.download = `${selectedProject.name.replace(/\s+/g, '_')}_export_${new Date().toISOString().split('T')[0]}.txt`;
          downloadLinkRef.current.click();
          
          // Clean up
          URL.revokeObjectURL(url);
        }
        
        toast({
          title: "Export successful",
          description: "Your notes have been exported to a text file",
        });
      })
      .catch(error => {
        toast({
          title: "Export failed",
          description: error.message,
          variant: "destructive",
        });
      });
  };

  // State for export format dialog
  const [isExportFormatDialogOpen, setIsExportFormatDialogOpen] = useState(false);
  
  // Main export function that will show a dialog to choose format
  const handleExportNotes = () => {
    if (!selectedProjectId || !selectedProject) {
      toast({
        title: "No project selected",
        description: "Please select a project to export notes from",
        variant: "destructive",
      });
      return;
    }
    
    // Open the export format dialog
    setIsExportFormatDialogOpen(true);
  };
  
  // Handle opening the import dialog
  const handleImportNotes = () => {
    if (!selectedProjectId) {
      toast({
        title: "No project selected",
        description: "Please select a project to import notes into",
        variant: "destructive",
      });
      return;
    }
    
    setIsImportDialogOpen(true);
  };
  
  // Enter presentation mode
  const enterPresentationMode = () => {
    if (!selectedProjectId) {
      toast({
        title: "No project selected",
        description: "Please select a project before entering presentation mode",
        variant: "destructive",
      });
      return;
    }
    
    // Navigate to the presentation mode route with the selected project ID
    setLocation(`/present/${selectedProjectId}`);
  };

  // Display loading state
  if (isLoadingProjects) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header 
          user={user} 
          currentProject={null} 
          projects={[]} 
          notes={[]}
          onSelectProject={() => {}} 
          onNewProject={() => {}}
          onExportNotes={() => {}}
          onImportNotes={() => {}}
          onPresentMode={() => {}}
        />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-2">Loading projects...</span>
        </div>
      </div>
    );
  }

  // Display empty state when no projects exist
  if (!isLoadingProjects && (!projects || projects.length === 0)) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header 
          user={user} 
          currentProject={null} 
          projects={[]} 
          notes={[]}
          onSelectProject={() => {}} 
          onNewProject={() => setIsNewProjectDialogOpen(true)}
          onExportNotes={() => {}}
          onImportNotes={() => {}}
          onPresentMode={() => {}}
        />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center p-8 max-w-md">
            <FolderPlus className="h-12 w-12 text-primary mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">No Projects Yet</h2>
            <p className="text-neutral-muted mb-6">Create your first project to start organizing your notes</p>
            <Button onClick={() => setIsNewProjectDialogOpen(true)}>Create New Project</Button>
          </div>
        </div>
        
        <NewProjectDialog 
          isOpen={isNewProjectDialogOpen} 
          onOpenChange={setIsNewProjectDialogOpen}
          form={form}
          onSubmit={onCreateProject}
          isPending={createProject.isPending}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header 
        user={user} 
        currentProject={selectedProject || null} 
        projects={projects || []} 
        notes={notes || []}
        onSelectProject={(id) => {
          setSelectedProjectId(id);
          
          // Update the last opened project in Supabase
          console.log("Selected project ID:", id);
        }}
        onNewProject={() => setIsNewProjectDialogOpen(true)}
        onUpdateProject={onUpdateProject}
        onExpandToLevel={(level) => setExpandLevel(level)}
        currentExpandLevel={expandLevel}
        onExportNotes={handleExportNotes}
        onImportNotes={handleImportNotes}
        onPresentMode={enterPresentationMode}
        onToggleTimedNotes={() => {
          setShowOnlyTimedNotes(!showOnlyTimedNotes);
          // When showing only timed notes, expand all branches
          if (!showOnlyTimedNotes) {
            setExpandLevel(-1); // -1 expands all levels
          }
        }}
        showOnlyTimedNotes={showOnlyTimedNotes}
      />
      
      <div className="flex-1 flex overflow-hidden">
        {selectedProjectId ? (
          <NoteTree 
            projectId={selectedProjectId} 
            notes={notes || []} 
            isLoading={isLoadingNotes}
            expandLevel={expandLevel}
            onMaxDepthChange={setMaxNoteDepth}
            focusedNoteId={focusedNoteId}
            showOnlyTimedNotes={showOnlyTimedNotes}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-neutral-muted">Select a project to view notes</p>
          </div>
        )}
      </div>
      
      {/* Project creation dialog */}
      <NewProjectDialog 
        isOpen={isNewProjectDialogOpen} 
        onOpenChange={setIsNewProjectDialogOpen}
        form={form}
        onSubmit={onCreateProject}
        isPending={createProject.isPending}
      />
      
      {/* Import dialog */}
      {selectedProjectId && (
        <ImportDialog
          isOpen={isImportDialogOpen}
          onOpenChange={setIsImportDialogOpen}
          projectId={selectedProjectId}
        />
      )}
      
      {/* Project Settings dialog */}
      {selectedProject && (
        <ProjectSettingsDialog
          isOpen={isProjectSettingsOpen}
          onOpenChange={setIsProjectSettingsOpen}
          form={projectEditForm}
          onSubmit={onUpdateProjectSettings}
          isPending={updateProject.isPending}
          project={selectedProject}
        />
      )}
      
      {/* Search dialog */}
      {selectedProjectId && notes && (
        <SearchDialog 
          isOpen={isSearchDialogOpen}
          onOpenChange={setIsSearchDialogOpen}
          notes={notes}
          onSelectNote={(noteId) => {
            // Find the note in the tree and expand its parent if needed
            const note = notes.find(n => n.id === noteId);
            if (note) {
              // Temporarily expand to a higher level to ensure the note is visible
              setExpandLevel(-1); // Expand all
              
              // Set the focused note ID directly instead of using URL parameters
              setFocusedNoteId(noteId);
              
              // Show confirmation toast
              toast({
                title: "Note found",
                description: "Navigating to the selected note",
              });
              
              // Close the search dialog
              setIsSearchDialogOpen(false);
            }
          }}
        />
      )}
      
      {/* Export format dialog */}
      <Dialog open={isExportFormatDialogOpen} onOpenChange={setIsExportFormatDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Export Format</DialogTitle>
            <DialogDescription>
              Choose the format for exporting your notes
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-4">
            <Button 
              onClick={() => {
                setIsExportFormatDialogOpen(false);
                handleExportNotesJson();
              }}
              className="flex items-center"
            >
              <FileJson className="mr-2 h-5 w-5" />
              JSON Format
              <span className="ml-auto text-xs text-muted-foreground">For technical use</span>
            </Button>
            <Button 
              onClick={() => {
                setIsExportFormatDialogOpen(false);
                handleExportNotesText();
              }}
              className="flex items-center"
              variant="outline"
            >
              <FileText className="mr-2 h-5 w-5" />
              Text Format
              <span className="ml-auto text-xs text-muted-foreground">Plain text</span>
            </Button>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsExportFormatDialogOpen(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Hidden download anchor for exports */}
      <div style={{ display: 'none' }}>
        <a ref={downloadLinkRef} />
      </div>
    </div>
  );
}

interface NewProjectDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  form: any;
  onSubmit: (values: z.infer<typeof projectSchema>) => void;
  isPending: boolean;
}

function NewProjectDialog({ isOpen, onOpenChange, form, onSubmit, isPending }: NewProjectDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create New Project</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Project Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter project name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex justify-end space-x-2">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={isPending}
              >
                {isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  "Create Project"
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

interface ProjectSettingsDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  form: any;
  onSubmit: (values: z.infer<typeof projectSchema>) => void;
  isPending: boolean;
  project: Project | null;
}

function ProjectSettingsDialog({ isOpen, onOpenChange, form, onSubmit, isPending, project }: ProjectSettingsDialogProps) {
  useEffect(() => {
    if (isOpen && project) {
      // Reset form with current project values when dialog opens
      form.reset({
        name: project.name,
        startSlogan: project.startSlogan || "",
        endSlogan: project.endSlogan || "",
        author: project.author || "",
      });
    }
  }, [isOpen, project, form]);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Project Settings</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Project Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter project name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="startSlogan"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>START SLOGAN (First Presentation Slide)</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter start slogan" {...field} value={field.value || ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="endSlogan"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>END SLOGAN (Last Presentation Slide)</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter end slogan" {...field} value={field.value || ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="author"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>AUTHOR (Shown in presentation mode for navigation and on End Slide)</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter author name" {...field} value={field.value || ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <div className="flex justify-end space-x-2">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={isPending}
              >
                {isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save Settings"
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useProjects } from "@/hooks/use-projects";
import { useNotes } from "@/hooks/use-notes";
import Header from "@/components/ui/header";
import NoteTree from "@/components/ui/note-tree";
import { Button } from "@/components/ui/button";
import { Loader2, FolderPlus } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

const projectSchema = z.object({
  name: z.string().min(1, "Project name is required").max(50, "Project name is too long"),
});

export default function HomePage() {
  const { user } = useAuth();
  const { projects, isLoading: isLoadingProjects, createProject } = useProjects();
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const { notes, isLoading: isLoadingNotes } = useNotes(selectedProjectId);
  
  const [isNewProjectDialogOpen, setIsNewProjectDialogOpen] = useState(false);

  const form = useForm<z.infer<typeof projectSchema>>({
    resolver: zodResolver(projectSchema),
    defaultValues: {
      name: "",
    },
  });

  const onCreateProject = (values: z.infer<typeof projectSchema>) => {
    createProject.mutate(values, {
      onSuccess: (newProject) => {
        setIsNewProjectDialogOpen(false);
        setSelectedProjectId(newProject.id);
        form.reset();
      },
    });
  };

  // Select the first project by default when projects load
  if (projects?.length && !selectedProjectId && !isLoadingProjects) {
    setSelectedProjectId(projects[0].id);
  }

  const selectedProject = projects?.find(p => p.id === selectedProjectId);

  // Display loading state
  if (isLoadingProjects) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header 
          user={user} 
          currentProject={null} 
          projects={[]} 
          onSelectProject={() => {}} 
          onNewProject={() => {}}
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
          onSelectProject={() => {}} 
          onNewProject={() => setIsNewProjectDialogOpen(true)}
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
        currentProject={selectedProject} 
        projects={projects || []} 
        onSelectProject={(id) => setSelectedProjectId(id)}
        onNewProject={() => setIsNewProjectDialogOpen(true)}
      />
      
      <div className="flex-1 flex overflow-hidden">
        {selectedProjectId ? (
          <NoteTree 
            projectId={selectedProjectId} 
            notes={notes || []} 
            isLoading={isLoadingNotes} 
          />
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-neutral-muted">Select a project to view notes</p>
          </div>
        )}
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

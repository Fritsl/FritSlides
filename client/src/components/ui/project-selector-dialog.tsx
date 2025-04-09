import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Project } from "@shared/schema";
import { 
  FolderPlus, 
  Search, 
  Check, 
  Copy, 
  Trash2, 
  MoreHorizontal,
  Settings
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { useProjects } from "@/hooks/use-projects";
import { useToast } from "@/hooks/use-toast";
import { ConfirmationDialog } from "./confirmation-dialog";

interface ProjectSelectorDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  projects: Project[];
  currentProject: Project | null;
  onSelectProject: (id: number) => void;
  onNewProject: () => void;
}

export function ProjectSelectorDialog({
  isOpen,
  onOpenChange,
  projects,
  currentProject,
  onSelectProject,
  onNewProject
}: ProjectSelectorDialogProps) {
  const { duplicateProject, deleteProject } = useProjects();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [projectToDuplicate, setProjectToDuplicate] = useState<Project | null>(null);
  const [duplicateName, setDuplicateName] = useState("");
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);
  const [isDuplicateDialogOpen, setIsDuplicateDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  
  // Filter projects based on search query
  const filteredProjects = searchQuery 
    ? projects.filter(project => 
        project.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : projects;
  
  // Handle project selection
  const handleSelectProject = (id: number) => {
    onSelectProject(id);
    onOpenChange(false);
  };
  
  // Open duplicate dialog
  const openDuplicateDialog = (project: Project, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent project selection
    setProjectToDuplicate(project);
    setDuplicateName(`${project.name} (Copy)`);
    setIsDuplicateDialogOpen(true);
  };
  
  // Open delete dialog
  const openDeleteDialog = (project: Project, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent project selection
    setProjectToDelete(project);
    setIsDeleteDialogOpen(true);
  };
  
  // Handle duplicate project
  const handleDuplicateProject = () => {
    if (!projectToDuplicate || !duplicateName.trim()) {
      toast({
        title: "Error",
        description: "Please enter a valid name for the duplicated project",
        variant: "destructive",
      });
      return;
    }
    
    // Close the duplicate dialog right away to avoid hanging UI
    setIsDuplicateDialogOpen(false);
    // Close the project selector dialog to prepare for duplication
    onOpenChange(false);
    
    // Show loading toast to inform user this might take some time
    toast({
      title: "Duplicating project...",
      description: "Please wait while notes are being copied with their hierarchy. This may take a moment.",
      duration: 15000, // Longer duration since duplication can take time
    });
    
    duplicateProject.mutate({
      id: projectToDuplicate.id,
      newName: duplicateName.trim()
    }, {
      onSuccess: (newProject) => {
        setProjectToDuplicate(null);
        
        // Show success toast
        toast({
          title: "Project duplicated successfully",
          description: "All notes have been copied with their correct hierarchy.",
          variant: "default",
        });
        
        // Make sure we're passing just the ID, not the whole project object
        const projectId = typeof newProject === 'object' && newProject !== null ? newProject.id : newProject;
        onSelectProject(projectId);
      },
      onError: (error) => {
        // Re-open project selector on error
        toast({
          title: "Duplication failed",
          description: error.message || "There was an error duplicating the project. Please try again.",
          variant: "destructive",
        });
        
        setTimeout(() => onOpenChange(true), 500);
      }
    });
  };
  
  // Handle delete project
  const handleDeleteProject = () => {
    if (!projectToDelete) return;
    
    deleteProject.mutate(projectToDelete.id, {
      onSuccess: () => {
        setIsDeleteDialogOpen(false);
        setProjectToDelete(null);
        
        // If we deleted the current project, select another one if available
        if (projectToDelete.id === currentProject?.id && projects.length > 1) {
          const nextProject = projects.find(p => p.id !== projectToDelete.id);
          if (nextProject) {
            setTimeout(() => onSelectProject(nextProject.id), 500);
          }
        }
      }
    });
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Projects</DialogTitle>
          </DialogHeader>
          
          <div className="relative mb-4">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-neutral-muted" />
            <Input
              placeholder="Search projects..."
              className="pl-8"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          
          {filteredProjects.length > 0 ? (
            <ScrollArea className="h-[300px] rounded-md border">
              <div className="p-1">
                {filteredProjects.map(project => (
                  <div
                    key={project.id}
                    className={`flex items-center justify-between p-2 rounded-md cursor-pointer ${
                      project.id === currentProject?.id 
                        ? "bg-primary/10 text-primary" 
                        : "hover:bg-neutral-subtle"
                    }`}
                    onClick={() => handleSelectProject(project.id)}
                  >
                    <div className="flex items-center">
                      <div className="mr-2 h-8 w-8 flex items-center justify-center rounded-md border bg-background">
                        {project.id === currentProject?.id ? (
                          <Check className="h-4 w-4 text-primary" />
                        ) : (
                          <span className="text-xs text-neutral-muted">
                            {project.name.slice(0, 2).toUpperCase()}
                          </span>
                        )}
                      </div>
                      <div>
                        <p className="font-medium">{project.name}</p>
                        <p className="text-xs text-neutral-muted">
                          Created: {new Date(project.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    
                    {/* Project actions dropdown */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSelectProject(project.id);
                          }}
                        >
                          <Check className="mr-2 h-4 w-4" />
                          <span>Select</span>
                        </DropdownMenuItem>
                        
                        <DropdownMenuSeparator />
                        
                        <DropdownMenuItem onClick={(e) => openDuplicateDialog(project, e)}>
                          <Copy className="mr-2 h-4 w-4" />
                          <span>Duplicate</span>
                        </DropdownMenuItem>
                        
                        <DropdownMenuItem 
                          onClick={(e) => openDeleteDialog(project, e)}
                          className="text-red-500 focus:text-red-500"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          <span>Delete</span>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                ))}
              </div>
            </ScrollArea>
          ) : (
            <div className="py-6 text-center text-neutral-muted">
              {searchQuery ? "No projects match your search" : "No projects available"}
            </div>
          )}
          
          <div className="flex justify-between mt-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button 
              variant="default" 
              size="sm" 
              onClick={() => {
                onNewProject();
                onOpenChange(false);
              }}
            >
              <FolderPlus className="h-4 w-4 mr-2" />
              New Project
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Duplicate Project Dialog */}
      <Dialog open={isDuplicateDialogOpen} onOpenChange={setIsDuplicateDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Duplicate Project</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <p className="text-sm text-neutral-muted">
              Enter a name for the duplicated project. All notes and their hierarchy will be copied.
              <br /><br />
              <strong>Note:</strong> The duplication process may take a few moments depending on the number of notes. 
              Please be patient while the system accurately maintains all parent-child relationships.
            </p>
            
            <Input
              placeholder="Project name"
              value={duplicateName}
              onChange={(e) => setDuplicateName(e.target.value)}
              autoFocus
            />
            
            <div className="flex justify-end space-x-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setIsDuplicateDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button 
                variant="default" 
                size="sm"
                onClick={handleDuplicateProject}
                disabled={duplicateProject.isPending || !duplicateName.trim()}
              >
                {duplicateProject.isPending ? (
                  <>
                    <span className="mr-2">Duplicating...</span>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"></span>
                  </>
                ) : "Duplicate"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Delete Project Confirmation */}
      <ConfirmationDialog
        isOpen={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        title="Delete Project"
        description={`Are you sure you want to delete "${projectToDelete?.name}"? This will permanently delete all notes in this project.`}
        confirmText="Delete Project"
        confirmVariant="destructive"
        onConfirm={handleDeleteProject}
        isPending={deleteProject.isPending}
      />
    </>
  );
}
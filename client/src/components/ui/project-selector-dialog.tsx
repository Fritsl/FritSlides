import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Project } from "@shared/schema";
import { FolderPlus, Search, Check } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

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
  const [searchQuery, setSearchQuery] = useState("");
  
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

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Select Project</DialogTitle>
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
  );
}
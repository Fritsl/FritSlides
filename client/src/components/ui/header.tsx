import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Project, User } from "@shared/schema";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuGroup,
} from "@/components/ui/dropdown-menu";
import { Loader2, ChevronDown, Plus, LogOut, Menu, User as UserIcon, Settings, FolderPlus, FileBox, Check, X, Edit } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ConfirmationDialog } from "./confirmation-dialog";
import { ProjectSelectorDialog } from "./project-selector-dialog";
import { Input } from "@/components/ui/input";

interface HeaderProps {
  user: User | null;
  currentProject: Project | null;
  projects: Project[];
  onSelectProject: (id: number) => void;
  onNewProject: () => void;
  onUpdateProject?: (id: number, name: string) => void;
}

export default function Header({ 
  user, 
  currentProject, 
  projects, 
  onSelectProject, 
  onNewProject,
  onUpdateProject
}: HeaderProps) {
  const { logoutMutation } = useAuth();
  const { toast } = useToast();
  const [isLogoutDialogOpen, setIsLogoutDialogOpen] = useState(false);
  const [isProjectSelectorOpen, setIsProjectSelectorOpen] = useState(false);
  const [isEditingProjectName, setIsEditingProjectName] = useState(false);
  const [projectName, setProjectName] = useState("");
  const projectNameInputRef = useRef<HTMLInputElement>(null);
  
  // Update the project name state when the current project changes
  useEffect(() => {
    if (currentProject) {
      setProjectName(currentProject.name);
    }
  }, [currentProject]);
  
  // Function to handle project name editing
  const startEditing = () => {
    if (currentProject) {
      setIsEditingProjectName(true);
      // Focus the input field after rendering
      setTimeout(() => {
        if (projectNameInputRef.current) {
          projectNameInputRef.current.focus();
          projectNameInputRef.current.select();
        }
      }, 10);
    }
  };
  
  const saveProjectName = () => {
    if (currentProject && onUpdateProject && projectName.trim()) {
      onUpdateProject(currentProject.id, projectName.trim());
      setIsEditingProjectName(false);
    } else if (!projectName.trim()) {
      // Reset to the original name if empty
      setProjectName(currentProject?.name || "");
      setIsEditingProjectName(false);
    }
  };
  
  const cancelEditing = () => {
    // Reset to the original name
    if (currentProject) {
      setProjectName(currentProject.name);
    }
    setIsEditingProjectName(false);
  };
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      saveProjectName();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cancelEditing();
    }
  };

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  if (!user) {
    return (
      <header className="bg-background border-b border-neutral-subtle shadow-sm">
        <div className="flex items-center justify-between px-4 py-3">
          <h1 className="text-lg font-semibold text-primary">NoteDrop</h1>
          <div className="flex items-center">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        </div>
      </header>
    );
  }

  return (
    <header className="bg-background border-b border-neutral-subtle shadow-sm">
      <div className="flex items-center justify-between px-4 py-2">
        <div className="flex items-center">
          {currentProject ? (
            isEditingProjectName ? (
              <div className="flex items-center">
                <Input
                  ref={projectNameInputRef}
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onBlur={saveProjectName}
                  className="max-w-[200px] font-semibold text-lg"
                />
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={saveProjectName} 
                  className="ml-1 h-8 w-8"
                >
                  <Check className="h-4 w-4" />
                </Button>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={cancelEditing} 
                  className="ml-1 h-8 w-8"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div 
                className="flex items-center cursor-pointer text-lg font-semibold text-foreground"
                onClick={startEditing}
              >
                <span>{currentProject.name}</span>
                <Edit className="ml-2 h-4 w-4 text-muted-foreground" />
              </div>
            )
          ) : (
            <h1 className="text-lg font-semibold text-primary">NoteDrop</h1>
          )}
        </div>
        <div className="flex items-center">
          {/* Hamburger Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="ml-auto">
                <Menu className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Menu</DropdownMenuLabel>
              <DropdownMenuSeparator />
              
              {/* User section */}
              <DropdownMenuGroup>
                <DropdownMenuItem>
                  <UserIcon className="h-4 w-4 mr-2" />
                  <span>Logged in as <span className="font-semibold">{user.username}</span></span>
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Settings className="h-4 w-4 mr-2" />
                  <span>Account Settings</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setIsLogoutDialogOpen(true)}>
                  <LogOut className="h-4 w-4 mr-2" />
                  <span>Logout</span>
                </DropdownMenuItem>
              </DropdownMenuGroup>
              
              <DropdownMenuSeparator />
              
              {/* Project section */}
              <DropdownMenuGroup>
                <DropdownMenuItem onClick={onNewProject}>
                  <FolderPlus className="h-4 w-4 mr-2" />
                  <span>New Project</span>
                </DropdownMenuItem>
                
                <DropdownMenuItem onClick={() => setIsProjectSelectorOpen(true)}>
                  <FileBox className="h-4 w-4 mr-2" />
                  <span>Select Project</span>
                </DropdownMenuItem>
              </DropdownMenuGroup>
              
              <DropdownMenuSeparator />
              
              {/* Create note option */}
              <DropdownMenuItem 
                onClick={() => {
                  if (currentProject) {
                    toast({
                      title: "Create a new note",
                      description: "Click the '+ Add a new note' button below to create a note",
                    });
                  } else {
                    toast({
                      title: "Select a project first",
                      description: "You need to select or create a project before adding notes",
                      variant: "destructive",
                    });
                  }
                }}
              >
                <Plus className="h-4 w-4 mr-2" />
                <span>New Note</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <ConfirmationDialog
        isOpen={isLogoutDialogOpen}
        onOpenChange={setIsLogoutDialogOpen}
        title="Log Out"
        description="Are you sure you want to log out of your account?"
        confirmText="Log Out"
        onConfirm={handleLogout}
        isPending={logoutMutation.isPending}
      />
      
      <ProjectSelectorDialog
        isOpen={isProjectSelectorOpen}
        onOpenChange={setIsProjectSelectorOpen}
        projects={projects}
        currentProject={currentProject}
        onSelectProject={onSelectProject}
        onNewProject={onNewProject}
      />
    </header>
  );
}

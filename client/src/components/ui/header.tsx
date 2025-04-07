import { useState } from "react";
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
import { Loader2, ChevronDown, Plus, LogOut, Menu, User as UserIcon, Settings, FolderPlus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ConfirmationDialog } from "./confirmation-dialog";

interface HeaderProps {
  user: User | null;
  currentProject: Project | null;
  projects: Project[];
  onSelectProject: (id: number) => void;
  onNewProject: () => void;
}

export default function Header({ 
  user, 
  currentProject, 
  projects, 
  onSelectProject, 
  onNewProject 
}: HeaderProps) {
  const { logoutMutation } = useAuth();
  const { toast } = useToast();
  const [isLogoutDialogOpen, setIsLogoutDialogOpen] = useState(false);

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  if (!user) {
    return (
      <header className="bg-white border-b border-neutral-subtle shadow-sm">
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
    <header className="bg-white border-b border-neutral-subtle shadow-sm">
      <div className="flex items-center justify-between px-4 py-2">
        <div className="flex items-center">
          <h1 className="text-lg font-semibold text-primary">NoteDrop</h1>
          {currentProject && (
            <span className="ml-4 text-sm text-neutral-muted hidden md:block">
              Current Project: <span className="font-medium text-foreground">{currentProject.name}</span>
            </span>
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
                
                {projects.length > 0 && (
                  <>
                    <DropdownMenuLabel className="pt-2">Select Project</DropdownMenuLabel>
                    {projects.map(project => (
                      <DropdownMenuItem 
                        key={project.id}
                        onClick={() => onSelectProject(project.id)}
                        className={project.id === currentProject?.id ? "bg-neutral-subtle font-medium" : ""}
                      >
                        <div className="w-4 h-4 mr-2 flex items-center justify-center">
                          {project.id === currentProject?.id && (
                            <div className="w-2 h-2 rounded-full bg-primary"></div>
                          )}
                        </div>
                        {project.name}
                      </DropdownMenuItem>
                    ))}
                  </>
                )}
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
    </header>
  );
}

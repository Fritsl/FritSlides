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
} from "@/components/ui/dropdown-menu";
import { Loader2, ChevronDown, Plus, LogOut } from "lucide-react";
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
          <h1 className="text-lg font-semibold text-primary mr-6">NoteDrop</h1>
          <div className="hidden md:flex items-center space-x-4">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={onNewProject}
            >
              New Project
            </Button>
            {projects.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="flex items-center">
                    <span>Project: {currentProject?.name || 'Select Project'}</span>
                    <ChevronDown className="h-4 w-4 ml-1" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuLabel>Your Projects</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {projects.map(project => (
                    <DropdownMenuItem 
                      key={project.id}
                      onClick={() => onSelectProject(project.id)}
                      className={project.id === currentProject?.id ? "bg-neutral-subtle" : ""}
                    >
                      {project.name}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <Button 
            variant="ghost" 
            size="sm" 
            className="hidden md:flex"
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
            <Plus className="h-5 w-5 mr-1" />
            New Note
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <div className="flex items-center cursor-pointer">
                <span className="text-sm font-medium mr-2 hidden md:inline">{user.username}</span>
                <div className="h-8 w-8 bg-primary text-white rounded-full flex items-center justify-center text-sm font-semibold">
                  {user.username.slice(0, 2).toUpperCase()}
                </div>
              </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>My Account</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setIsLogoutDialogOpen(true)}>
                <LogOut className="h-4 w-4 mr-2" />
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <div className="md:hidden flex items-center px-4 py-2 space-x-3">
        {projects.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm">
                <span>{currentProject?.name || 'Select Project'}</span>
                <ChevronDown className="h-4 w-4 ml-1" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              {projects.map(project => (
                <DropdownMenuItem 
                  key={project.id}
                  onClick={() => onSelectProject(project.id)}
                >
                  {project.name}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onNewProject}>
                <Plus className="h-4 w-4 mr-2" />
                New Project
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        <Button 
          variant="ghost" 
          size="sm" 
          className="flex items-center"
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
          <Plus className="h-4 w-4 mr-1" />
          New Note
        </Button>
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

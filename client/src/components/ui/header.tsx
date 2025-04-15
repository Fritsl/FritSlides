import { useState, useRef, useEffect } from "react";
import { useSupabaseAuth } from "@/hooks/use-supabase-auth";
import { useNoteEditing } from "@/hooks/use-notes";
import { Button } from "@/components/ui/button";
import { Project, Note } from "@shared/schema";
import { User } from "@supabase/supabase-js";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuGroup,
} from "@/components/ui/dropdown-menu";
import { 
  Loader2, 
  ChevronDown, 
  Plus, 
  LogOut, 
  Menu, 
  User as UserIcon, 
  Settings, 
  FolderPlus, 
  FileBox, 
  Check, 
  X, 
  Download, 
  Upload,
  PlayCircle,
  BarChart,
  Presentation,
  Search,
  Clock,
  RotateCcw,
  Lock,
  Unlock,
  Database,
  PieChart
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ConfirmationDialog } from "./confirmation-dialog";
import { ProjectSelectorDialog } from "./project-selector-dialog";
import { Input } from "@/components/ui/input";
import { getLevelColor } from "@/lib/colors";
import { cn } from "@/lib/utils";

interface HeaderProps {
  user: User | null;
  currentProject: Project | null;
  projects: Project[];
  notes?: Note[];
  onSelectProject: (id: number) => void;
  onNewProject: () => void;
  onUpdateProject?: (id: number, name: string) => void;
  onExpandToLevel?: (level: number) => void; // New prop for level expansion
  currentExpandLevel?: number; // Currently selected expansion level
  onExportNotes?: () => void; // For exporting notes
  onImportNotes?: () => void; // For importing notes
  onPresentMode?: () => void; // For entering presentation mode
  onToggleTimedNotes?: () => void; // For toggling timed notes filter
  showOnlyTimedNotes?: boolean; // Current state of timed notes filter
  onShowTimeDistribution?: () => void; // For showing time distribution chart
  onShowTimeGantt?: () => void; // For showing time gantt chart
}

export default function Header({ 
  user, 
  currentProject, 
  projects, 
  notes = [],
  onSelectProject, 
  onNewProject,
  onUpdateProject,
  onExpandToLevel,
  currentExpandLevel = -1,
  onExportNotes,
  onImportNotes,
  onPresentMode,
  onToggleTimedNotes,
  showOnlyTimedNotes = false,
  onShowTimeDistribution,
  onShowTimeGantt
}: HeaderProps) {
  const { user: supabaseUser, signOut: supabaseSignOut } = useSupabaseAuth();
  const { toast } = useToast();
  const { editingNoteId, setEditingNoteId, isEditing } = useNoteEditing();
  const [isLogoutDialogOpen, setIsLogoutDialogOpen] = useState(false);
  const [isProjectSelectorOpen, setIsProjectSelectorOpen] = useState(false);
  // Function to open project settings
  const openProjectSettings = () => {
    if (currentProject) {
      // Dispatch a custom event that can be caught by parent components
      const event = new CustomEvent('openProjectSettings', {
        detail: { projectId: currentProject.id }
      });
      window.dispatchEvent(event);
    }
  };

  const handleLogout = () => {
    supabaseSignOut();
    toast({
      title: "Logged out",
      description: "You have been logged out of your Supabase account"
    });
    // Redirect to auth page
    window.location.href = "/auth";
  };

  if (!user) {
    return (
      <header className="bg-background border-b border-neutral-subtle shadow-sm sticky top-0 z-50">
        <div className="flex items-center justify-between px-4 py-3">
          <h1 className="text-lg font-semibold text-primary">FritSlides</h1>
          <div className="flex items-center">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        </div>
      </header>
    );
  }

  // Function to calculate the max depth of notes in the current project
  const calculateMaxDepth = () => {
    if (!notes || notes.length === 0) return 0;
    
    // First, create a map from parentId to child notes
    const notesByParent: Map<number | null, Note[]> = new Map();
    
    // Group notes by their parent
    notes.forEach(note => {
      const parentId = note.parentId;
      if (!notesByParent.has(parentId)) {
        notesByParent.set(parentId, []);
      }
      notesByParent.get(parentId)!.push(note);
    });
    
    // Function to recursively calculate depth
    const calculateDepth = (parentId: number | null, currentDepth: number): number => {
      const children = notesByParent.get(parentId) || [];
      if (children.length === 0) return currentDepth;
      
      // Get the max depth among all children
      let maxChildDepth = currentDepth;
      children.forEach(child => {
        const childDepth = calculateDepth(child.id, currentDepth + 1);
        maxChildDepth = Math.max(maxChildDepth, childDepth);
      });
      
      return maxChildDepth;
    };
    
    // Start at root level (parentId = null) with depth 0
    // Return max depth, but since we count from 0, the actual max level is the returned value
    return calculateDepth(null, 0);
  };
  
  // Calculate the max depth
  const maxDepth = calculateMaxDepth();
  
  // Create an array of level buttons (0 to maxDepth-1, inclusive)
  // Simply display one less level button as requested
  const levelButtons = Array.from({ length: Math.max(0, maxDepth) }, (_, level) => {
    const colorPair = getLevelColor(level);
    const isActive = currentExpandLevel === level;
    
    return (
      <Button 
        key={level}
        size="sm"
        variant="ghost"
        className={cn(
          "min-w-8 h-8 mx-0.5 p-0 rounded-md text-white font-medium border border-transparent",
          isActive ? "border-white/30 shadow-sm" : "hover:border-white/10"
        )}
        style={{ 
          backgroundColor: isActive ? colorPair.light : colorPair.regular,
          color: "white"
        }}
        onClick={() => onExpandToLevel?.(level)}
      >
        {level}
      </Button>
    );
  });

  return (
    <header className="bg-slate-900 text-white border-b border-slate-800 shadow-md sticky top-0 z-50">
      <div className="flex items-center justify-between px-4 py-2">
        <div className="flex items-center">
          {currentProject ? (
            <div className="flex items-center">
              <div 
                className="cursor-pointer text-lg font-semibold text-white"
                onClick={openProjectSettings}
                title="Click to open Project Settings"
              >
                {currentProject.name}
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="ml-1 h-8 w-8 text-white hover:bg-slate-800"
                onClick={openProjectSettings}
                title="Project Settings"
              >
                <Settings className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <h1 className="text-lg font-semibold bg-gradient-to-r from-blue-400 to-purple-500 text-transparent bg-clip-text">FritSlides</h1>
          )}
        </div>
        
        {/* Level buttons */}
        {currentProject && maxDepth > 0 && onExpandToLevel && (
          <div className="flex items-center mx-4 overflow-x-auto">
            <div className="flex items-center px-2 py-1 rounded-md bg-slate-800 border border-slate-700 shadow-sm">
              {levelButtons}
            </div>
          </div>
        )}
        
        <div className="flex items-center">
          {/* Editing status indicator */}
          {isEditing && (
            <div className="mr-2 px-2 py-1 bg-red-500/20 rounded text-xs flex items-center border border-red-500/30">
              <Lock className="h-3 w-3 mr-1" />
              <span>Editing note #{editingNoteId}</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5 ml-1 hover:bg-red-500/20"
                onClick={() => {
                  setEditingNoteId(null);
                  localStorage.removeItem('newNoteCreated');
                  localStorage.removeItem('lastCreatedNoteId');
                  toast({
                    title: "Edit mode cleared",
                    description: `Released edit lock for note #${editingNoteId}`,
                  });
                }}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          )}
          
          {/* Present mode button - only show when project has notes */}
          {currentProject && onPresentMode && notes && notes.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                if (currentProject) {
                  onPresentMode();
                } else {
                  toast({
                    title: "Select a project first",
                    description: "You need to select a project before entering presentation mode",
                    variant: "destructive",
                  });
                }
              }}
              className="mr-2 text-white hover:bg-slate-800"
            >
              <Presentation className="h-4 w-4 mr-2" />
              <span>Present</span>
            </Button>
          )}
          
          {/* Hamburger Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="ml-auto text-white hover:bg-slate-800">
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
                  <span>Logged in as <span className="font-semibold">
                    {supabaseUser?.email || "User"}
                  </span></span>
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
                  <span>Projects</span>
                </DropdownMenuItem>
                
                {/* Search notes option */}
                {currentProject && notes.length > 0 && (
                  <DropdownMenuItem 
                    onClick={() => {
                      if (currentProject) {
                        // Dispatch a custom event that can be caught by parent components
                        const event = new CustomEvent('openSearchDialog', {
                          detail: { projectId: currentProject.id }
                        });
                        window.dispatchEvent(event);
                      } else {
                        toast({
                          title: "Select a project first",
                          description: "You need to select a project before searching notes",
                          variant: "destructive",
                        });
                      }
                    }}
                  >
                    <Search className="h-4 w-4 mr-2" />
                    <span>Search Notes</span>
                  </DropdownMenuItem>
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
              
              <DropdownMenuSeparator />
              
              {/* Import/Export section */}
              <DropdownMenuGroup>
                <DropdownMenuItem 
                  onClick={() => {
                    if (currentProject && onExportNotes) {
                      onExportNotes();
                    } else if (!currentProject) {
                      toast({
                        title: "Select a project first",
                        description: "You need to select a project before exporting notes",
                        variant: "destructive",
                      });
                    }
                  }}
                >
                  <Download className="h-4 w-4 mr-2" />
                  <span>Export Notes</span>
                </DropdownMenuItem>
                
                <DropdownMenuItem 
                  onClick={() => {
                    if (currentProject && onImportNotes) {
                      onImportNotes();
                    } else if (!currentProject) {
                      toast({
                        title: "Select a project first",
                        description: "You need to select a project before importing notes",
                        variant: "destructive",
                      });
                    }
                  }}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  <span>Import Notes</span>
                </DropdownMenuItem>
              </DropdownMenuGroup>
              
              <DropdownMenuSeparator />
              
              {/* View options - only shown when project has notes */}
              {notes && notes.length > 0 && (
                <>
                  {/* Filter to show only timed notes */}
                  <DropdownMenuItem 
                    onClick={() => {
                      if (currentProject && onToggleTimedNotes) {
                        onToggleTimedNotes();
                      } else if (!currentProject) {
                        toast({
                          title: "Select a project first",
                          description: "You need to select a project before filtering notes",
                          variant: "destructive",
                        });
                      }
                    }}
                  >
                    <Clock className="h-4 w-4 mr-2" />
                    <span>{showOnlyTimedNotes ? "Show All Notes" : "Show Only Timed Notes"}</span>
                    {showOnlyTimedNotes && <Check className="h-4 w-4 ml-auto" />}
                  </DropdownMenuItem>
                  
                  {/* Presentation mode */}
                  <DropdownMenuItem 
                    onClick={() => {
                      if (currentProject && onPresentMode) {
                        onPresentMode();
                      } else if (!currentProject) {
                        toast({
                          title: "Select a project first",
                          description: "You need to select a project before entering presentation mode",
                          variant: "destructive",
                        });
                      }
                    }}
                  >
                    <Presentation className="h-4 w-4 mr-2" />
                    <span>Presentation Mode</span>
                  </DropdownMenuItem>
                  
                  {/* Show Time Distribution */}
                  {currentProject && notes && notes.length > 0 && notes.some(note => note.time) && (
                    <DropdownMenuItem
                      onClick={() => {
                        if (currentProject && onShowTimeDistribution) {
                          onShowTimeDistribution();
                        } else if (!currentProject) {
                          toast({
                            title: "Select a project first",
                            description: "You need to select a project before viewing time distribution",
                            variant: "destructive",
                          });
                        }
                      }}
                    >
                      <PieChart className="h-4 w-4 mr-2" />
                      <span>Show Time as Cake Diagram</span>
                    </DropdownMenuItem>
                  )}
                  
                  {/* Show Time Gantt Chart */}
                  {currentProject && notes && notes.length > 0 && notes.some(note => note.time) && (
                    <DropdownMenuItem
                      onClick={() => {
                        if (currentProject && onShowTimeGantt) {
                          onShowTimeGantt();
                        } else if (!currentProject) {
                          toast({
                            title: "Select a project first",
                            description: "You need to select a project before viewing timeline",
                            variant: "destructive",
                          });
                        }
                      }}
                    >
                      <BarChart className="h-4 w-4 mr-2" />
                      <span>Show Timeline View</span>
                    </DropdownMenuItem>
                  )}
                  
                  {/* Reset Editing State */}
                  <DropdownMenuItem 
                    onClick={() => {
                      // Clear editing state
                      setEditingNoteId(null);
                      // Also clear localStorage edit flags
                      localStorage.removeItem('newNoteCreated');
                      localStorage.removeItem('lastCreatedNoteId');
                      
                      toast({
                        title: isEditing ? "Edit mode cleared" : "Editing state reset",
                        description: isEditing 
                          ? `Cleared edit lock for note #${editingNoteId}`
                          : "Editing state has been reset. You can now edit any note.",
                        variant: "default",
                      });
                    }}
                  >
                    <RotateCcw className="h-4 w-4 mr-2" />
                    <span>Reset Edit Lock</span>
                    {isEditing && <Lock className="h-4 w-4 ml-auto text-red-500" />}
                  </DropdownMenuItem>
                </>
              )}
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
        isPending={false}
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

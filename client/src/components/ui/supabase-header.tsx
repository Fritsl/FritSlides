import { Link } from "wouter";
import { 
  Menu,
  User as UserIcon,
  LogOut,
  FolderPlus,
  FileUp,
  Database
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSupabaseAuth } from "@/hooks/use-supabase-auth";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuGroup,
} from "@/components/ui/dropdown-menu";
import { useState } from "react";
import { ConfirmationDialog } from "./confirmation-dialog";

export default function SupabaseHeader() {
  const { user, signOut } = useSupabaseAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isLogoutDialogOpen, setIsLogoutDialogOpen] = useState(false);

  const handleLogout = async () => {
    try {
      setIsLoggingOut(true);
      await signOut();
      setIsLogoutDialogOpen(false);
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <header className="bg-slate-900 text-white border-b border-slate-800 shadow-md sticky top-0 z-50">
      <div className="flex items-center justify-between px-4 py-2">
        <Link href="/" className="text-lg font-semibold bg-gradient-to-r from-blue-400 to-purple-500 text-transparent bg-clip-text">
          FritSlides
        </Link>

        <div className="flex items-center">
          {user && (
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
                    <span>Logged in as <span className="font-semibold">{user.email}</span></span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setIsLogoutDialogOpen(true)}>
                    <LogOut className="h-4 w-4 mr-2" />
                    <span>Logout</span>
                  </DropdownMenuItem>
                </DropdownMenuGroup>
                
                <DropdownMenuSeparator />
                
                {/* Project section */}
                <DropdownMenuGroup>
                  <DropdownMenuItem onClick={() => window.location.href = "/"}>
                    <FolderPlus className="h-4 w-4 mr-2" />
                    <span>Go to Projects</span>
                  </DropdownMenuItem>
                </DropdownMenuGroup>
                
                <DropdownMenuSeparator />
                
                {/* Migration section */}
                <DropdownMenuGroup>
                  <DropdownMenuItem onClick={() => window.location.href = "/migrate"}>
                    <FileImport className="h-4 w-4 mr-2" />
                    <span>Migration Utility</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => window.location.href = "/auth"}>
                    <Database className="h-4 w-4 mr-2" />
                    <span>Switch to Local Auth</span>
                  </DropdownMenuItem>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {/* Logout confirmation dialog */}
      <ConfirmationDialog
        open={isLogoutDialogOpen}
        onOpenChange={setIsLogoutDialogOpen}
        title="Logout"
        description="Are you sure you want to logout? Any unsaved changes will be lost."
        action="Logout"
        actionVariant="destructive"
        onAction={handleLogout}
        isActionLoading={isLoggingOut}
      />
    </header>
  );
}
import { Link } from "wouter";
import { useSupabaseAuth } from "@/hooks/use-supabase-auth";
import { Button } from "@/components/ui/button";
import { Database, LogIn, CloudUpload } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";

export function SupabaseNav() {
  const { user, signOut } = useSupabaseAuth();

  return (
    <div className="flex items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="flex items-center gap-1">
            <Database className="h-4 w-4" />
            <span className="hidden md:inline">Supabase</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {user ? (
            <>
              <div className="px-2 py-1.5 text-xs text-muted-foreground">
                Signed in as:<br />
                <span className="font-medium text-foreground">{user.email}</span>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/supabase-migration">
                  <CloudUpload className="mr-2 h-4 w-4" />
                  Data Migration
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => signOut()}>
                Sign Out
              </DropdownMenuItem>
            </>
          ) : (
            <DropdownMenuItem asChild>
              <Link href="/supabase-auth">
                <LogIn className="mr-2 h-4 w-4" />
                Sign In with Supabase
              </Link>
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
import { Link } from "wouter";
import { LogOut, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSupabaseAuth } from "@/hooks/use-supabase-auth";
import { useState } from "react";

export function SupabaseNav() {
  const { user, signOut } = useSupabaseAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    try {
      setIsLoggingOut(true);
      await signOut();
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <div className="flex items-center justify-between px-4 h-16 border-b border-gray-200">
      <Link href="/" className="text-xl font-bold text-primary">
        FritSlides
      </Link>
      
      {user && (
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-500">
            {user.email}
          </span>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={handleLogout}
            disabled={isLoggingOut}
          >
            {isLoggingOut ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <LogOut className="h-4 w-4 mr-2" />
            )}
            {isLoggingOut ? "Logging out..." : "Logout"}
          </Button>
        </div>
      )}
    </div>
  );
}
import { useAuth } from "@/hooks/use-auth";
import { useSupabaseAuth } from "@/hooks/use-supabase-auth";
import { Loader2 } from "lucide-react";
import { Redirect, Route } from "wouter";
import { useEffect, useState } from "react";

export function ProtectedRoute({
  path,
  component: Component,
}: {
  path: string;
  component: () => React.JSX.Element;
}) {
  const { user: localUser, isLoading: localLoading } = useAuth();
  const { user: supabaseUser, isLoading: supabaseLoading } = useSupabaseAuth();
  const [authSource, setAuthSource] = useState<"local" | "supabase" | null>(null);
  
  useEffect(() => {
    // Check if user is authenticated with any method
    if (localUser) {
      setAuthSource("local");
    } else if (supabaseUser) {
      setAuthSource("supabase");
    } else if (!localLoading && !supabaseLoading) {
      setAuthSource(null);
    }
  }, [localUser, supabaseUser, localLoading, supabaseLoading]);
  
  if (localLoading || supabaseLoading) {
    return (
      <Route path={path}>
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Route>
    );
  }

  // If not authenticated with either method, redirect to auth
  if (!authSource) {
    return (
      <Route path={path}>
        <Redirect to="/auth" />
      </Route>
    );
  }
  
  // If authenticated with supabase, redirect to migration utility first time
  if (authSource === "supabase" && !localStorage.getItem("supabase_migration_seen")) {
    localStorage.setItem("supabase_migration_seen", "true");
    return (
      <Route path={path}>
        <Redirect to="/migrate" />
      </Route>
    );
  }

  return <Route path={path} component={Component} />;
}

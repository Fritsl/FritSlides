import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import NotFound from "@/pages/not-found";
import HomePage from "@/pages/home-page";
import AuthPage from "@/pages/auth-page";
import SupabaseAuthPage from "@/pages/supabase-auth-page";
import SupabaseMigrationPage from "@/pages/supabase-migration-page";
import MigrationUtility from "@/pages/migration-utility";
import PresentMode from "@/pages/present-mode";
import { AuthProvider } from "@/hooks/use-auth";
import { SupabaseAuthProvider } from "@/hooks/use-supabase-auth";
import { ProtectedRoute } from "@/lib/protected-route";
import { NoteEditingProvider } from "@/hooks/use-notes";

function Router() {
  return (
    <Switch>
      <ProtectedRoute path="/" component={HomePage} />
      <ProtectedRoute path="/present/:projectId" component={PresentMode} />
      <Route path="/auth" component={AuthPage} />
      <Route path="/auth/supabase" component={SupabaseAuthPage} />
      <Route path="/supabase-migration" component={SupabaseMigrationPage} />
      <Route path="/migrate" component={MigrationUtility} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <SupabaseAuthProvider>
        <AuthProvider>
          <NoteEditingProvider>
            <Router />
            <Toaster />
          </NoteEditingProvider>
        </AuthProvider>
      </SupabaseAuthProvider>
    </QueryClientProvider>
  );
}

export default App;

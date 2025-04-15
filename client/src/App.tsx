import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import NotFound from "@/pages/not-found";
import HomePage from "@/pages/home-page";
import SupabaseAuthPage from "@/pages/supabase-auth-page";
import PresentMode from "@/pages/present-mode";
import AccountSettingsPage from "@/pages/account-settings";
import { SupabaseAuthProvider } from "@/hooks/use-supabase-auth";
import { ProtectedRoute } from "@/lib/protected-route";
import { NoteEditingProvider } from "@/hooks/use-notes";

function Router() {
  return (
    <Switch>
      <ProtectedRoute path="/" component={HomePage} />
      <ProtectedRoute path="/present/:projectId" component={PresentMode} />
      <ProtectedRoute path="/account-settings" component={AccountSettingsPage} />
      <Route path="/auth" component={SupabaseAuthPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <SupabaseAuthProvider>
        <NoteEditingProvider>
          <Router />
          <Toaster />
        </NoteEditingProvider>
      </SupabaseAuthProvider>
    </QueryClientProvider>
  );
}

export default App;

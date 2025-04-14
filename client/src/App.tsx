import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import NotFound from "@/pages/not-found";
import HomePage from "@/pages/home-page";
import AuthPage from "@/pages/auth-page";
import PresentMode from "@/pages/present-mode";
import MigrationUtilityPage from "@/pages/migration-utility";
import { AuthProvider } from "@/hooks/use-auth";
import { ProtectedRoute } from "@/lib/protected-route";
import { NoteEditingProvider } from "@/hooks/use-notes";

function Router() {
  return (
    <Switch>
      <ProtectedRoute path="/" component={HomePage} />
      <ProtectedRoute path="/present/:projectId" component={PresentMode} />
      <ProtectedRoute path="/migration-utility" component={MigrationUtilityPage} />
      <Route path="/auth" component={AuthPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <NoteEditingProvider>
          <Router />
          <Toaster />
        </NoteEditingProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;

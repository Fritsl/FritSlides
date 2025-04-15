import { createContext, ReactNode, useContext, useEffect, useState } from "react";
import { User, Session } from "@supabase/supabase-js";
import { useToast } from "@/hooks/use-toast";
import { getSupabaseClient } from "@/lib/supabase";
import { queryClient } from "@/lib/queryClient";

type SupabaseAuthContextType = {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  error: Error | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  updatePassword: (currentPassword: string, newPassword: string) => Promise<void>;
};

export const SupabaseAuthContext = createContext<SupabaseAuthContextType>({
  user: null,
  session: null,
  isLoading: true,
  error: null,
  signIn: async () => {},
  signUp: async () => {},
  signOut: async () => {},
  updatePassword: async () => {},
});

export function SupabaseAuthProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        setIsLoading(true);
        const supabase = await getSupabaseClient();
        
        // Get current session
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          throw error;
        }
        
        if (session) {
          setSession(session);
          setUser(session.user);
          
          // Set user data for APIs that expect the user to be in the query cache
          // Note: We pass the UUID directly here, but the server will convert it to a numeric ID
          // This is only for client-side state management
          queryClient.setQueryData(["/api/user"], {
            id: session.user.id, // The ID conversion happens server-side
            username: session.user.email,
            lastOpenedProjectId: null // We'll update this later from Supabase
          });
        }
      } catch (error) {
        console.error("Error initializing auth:", error);
        setError(error instanceof Error ? error : new Error('Unknown authentication error'));
      } finally {
        setIsLoading(false);
      }
    };

    initializeAuth();
    
    // Setup auth state change listener
    const setupAuthListener = async () => {
      try {
        const supabase = await getSupabaseClient();
        
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
          async (event, session) => {
            setSession(session);
            setUser(session?.user ?? null);
            
            if (session) {
              // Update user in query cache
              // Note: We pass the UUID directly here, but the server will convert it to a numeric ID
              // This is only for client-side state management
              queryClient.setQueryData(["/api/user"], {
                id: session.user.id, // The ID conversion happens server-side
                username: session.user.email,
                lastOpenedProjectId: null
              });
            } else {
              // Clear user from query cache on signout
              queryClient.setQueryData(["/api/user"], null);
            }
          }
        );
        
        // Cleanup subscription on unmount
        return () => {
          subscription?.unsubscribe();
        };
      } catch (error) {
        console.error("Error setting up auth listener:", error);
      }
    };
    
    const cleanup = setupAuthListener();
    return () => {
      if (cleanup) {
        cleanup.then(unsubscribe => unsubscribe && unsubscribe());
      }
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      setIsLoading(true);
      const supabase = await getSupabaseClient();
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      if (error) {
        throw error;
      }
      
      setSession(data.session);
      setUser(data.user);
      
      toast({
        title: "Login successful",
        description: `Welcome back, ${data.user.email}!`,
      });
    } catch (error: any) {
      console.error("Login error:", error);
      setError(error);
      
      toast({
        title: "Login failed",
        description: error.message || "Invalid email or password",
        variant: "destructive",
      });
      
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const signUp = async (email: string, password: string) => {
    try {
      setIsLoading(true);
      const supabase = await getSupabaseClient();
      
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });
      
      if (error) {
        throw error;
      }
      
      setSession(data.session);
      setUser(data.user);
      
      toast({
        title: "Registration successful",
        description: `Welcome, ${data.user?.email}!`,
      });
    } catch (error: any) {
      console.error("Registration error:", error);
      setError(error);
      
      toast({
        title: "Registration failed",
        description: error.message || "Could not create account",
        variant: "destructive",
      });
      
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const signOut = async () => {
    try {
      setIsLoading(true);
      const supabase = await getSupabaseClient();
      
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        throw error;
      }
      
      setSession(null);
      setUser(null);
      
      // Clear user from query cache
      queryClient.setQueryData(["/api/user"], null);
      
      // Also invalidate any project or note data
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      
      toast({
        title: "Logged out",
        description: "You have been successfully logged out.",
      });
    } catch (error: any) {
      console.error("Logout error:", error);
      setError(error);
      
      toast({
        title: "Logout failed",
        description: error.message || "Could not log out",
        variant: "destructive",
      });
      
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const updatePassword = async (currentPassword: string, newPassword: string) => {
    try {
      setIsLoading(true);
      const supabase = await getSupabaseClient();
      
      if (!user || !user.email) {
        throw new Error("You must be logged in to update your password");
      }
      
      // First verify the current password is correct by attempting to sign in
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      });
      
      if (signInError) {
        throw new Error("Current password is incorrect");
      }
      
      // Update the password
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword
      });
      
      if (updateError) {
        throw updateError;
      }
      
      toast({
        title: "Password updated",
        description: "Your password has been successfully updated."
      });
      
      return;
    } catch (error: any) {
      console.error("Password update error:", error);
      setError(error);
      
      toast({
        title: "Password update failed",
        description: error.message || "Could not update password",
        variant: "destructive",
      });
      
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SupabaseAuthContext.Provider
      value={{
        user,
        session,
        isLoading,
        error,
        signIn,
        signUp,
        signOut,
        updatePassword,
      }}
    >
      {children}
    </SupabaseAuthContext.Provider>
  );
}

export function useSupabaseAuth() {
  const context = useContext(SupabaseAuthContext);
  if (!context) {
    throw new Error("useSupabaseAuth must be used within a SupabaseAuthProvider");
  }
  return context;
}
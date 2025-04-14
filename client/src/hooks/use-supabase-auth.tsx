import { createContext, ReactNode, useContext, useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { Session, User, UserResponse } from "@supabase/supabase-js";

// Define the context type for Supabase authentication
type SupabaseAuthContextType = {
  session: Session | null;
  user: User | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signUp: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signOut: () => Promise<void>;
};

// Create the context
export const SupabaseAuthContext = createContext<SupabaseAuthContextType | null>(null);

// Provider component that wraps the app
export function SupabaseAuthProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Initialize auth state on mount
  useEffect(() => {
    const initializeAuth = async () => {
      setIsLoading(true);
      
      // Check for existing session
      try {
        const { data, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Error getting session:', error);
          toast({
            title: "Authentication Error",
            description: "There was an error retrieving your authentication state.",
            variant: "destructive",
          });
        } else if (data?.session) {
          setSession(data.session);
          setUser(data.session.user);
        }
      } catch (err) {
        console.error('Error in getSession:', err);
      }
      
      setIsLoading(false);
      
      // Set up polling for auth state changes since onAuthStateChange is having issues
      // This is a fallback mechanism that regularly checks for session changes
      const intervalId = setInterval(async () => {
        try {
          if (supabase?.auth?.getSession) {
            const { data } = await supabase.auth.getSession();
            
            // Update session state based on new session data
            setSession(prev => {
              // Return early if no change to session ID
              if (
                (prev?.user?.id === data?.session?.user?.id) && 
                ((prev === null && data.session === null) || 
                (prev !== null && data.session !== null))
              ) {
                return prev;
              }
              
              // Session has changed, log and return new value
              if (data?.session !== prev) {
                console.log('Session state changed via polling');
              }
              return data?.session || null;
            });
            
            // Update user state based on new session data
            setUser(prev => {
              // Return early if no change to user ID
              if (prev?.id === data?.session?.user?.id) {
                return prev;
              }
              
              // User has changed, return new value
              return data?.session?.user || null;
            });
          }
        } catch (e) {
          console.error('Error polling for session:', e);
        }
      }, 3000); // Check every 3 seconds
      
      // Return cleanup function
      return () => clearInterval(intervalId);
    };
    
    initializeAuth();
  }, [toast]);

  // Sign in with email and password
  const signIn = async (email: string, password: string) => {
    try {
      setIsLoading(true);
      
      // Check if auth is available
      if (!supabase?.auth) {
        console.error('Supabase auth not properly initialized - auth object missing');
        toast({
          title: "Authentication Error",
          description: "The authentication system is not properly initialized. Please try again later.",
          variant: "destructive",
        });
        return { success: false, error: "Authentication system unavailable" };
      }
      
      // TypeScript safety check for signInWithPassword method
      if (typeof (supabase.auth as any).signInWithPassword !== 'function') {
        console.error('Supabase auth not properly initialized - signInWithPassword missing');
        toast({
          title: "Authentication Error",
          description: "The authentication system is not properly configured. Please try again later.",
          variant: "destructive",
        });
        return { success: false, error: "Authentication system unavailable" };
      }
      
      // Attempt sign in
      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        
        if (error) {
          console.error('Login error:', error);
          toast({
            title: "Login Failed",
            description: error.message,
            variant: "destructive",
          });
          return { success: false, error: error.message };
        }
        
        toast({
          title: "Login Successful",
          description: `Welcome back, ${data.user?.email || email}!`,
        });
        
        return { success: true };
      } catch (err) {
        console.error('Error during signInWithPassword:', err);
        throw err; // Re-throw to be caught by outer catch
      }
    } catch (error: any) {
      console.error('Outer login error:', error);
      toast({
        title: "Login Error",
        description: error.message || "An unexpected error occurred during login.",
        variant: "destructive",
      });
      return { success: false, error: error.message || "Unknown error" };
    } finally {
      setIsLoading(false);
    }
  };

  // Sign up with email and password
  const signUp = async (email: string, password: string) => {
    try {
      setIsLoading(true);
      
      // Check if auth is available
      if (!supabase?.auth) {
        console.error('Supabase auth not properly initialized - auth object missing');
        toast({
          title: "Authentication Error",
          description: "The registration system is not properly initialized. Please try again later.",
          variant: "destructive",
        });
        return { success: false, error: "Authentication system unavailable" };
      }
      
      // TypeScript safety check for signUp method
      if (typeof (supabase.auth as any).signUp !== 'function') {
        console.error('Supabase auth not properly initialized - signUp missing');
        toast({
          title: "Authentication Error",
          description: "The registration system is not properly configured. Please try again later.",
          variant: "destructive",
        });
        return { success: false, error: "Authentication system unavailable" };
      }
      
      // Attempt sign up
      try {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
        });
        
        if (error) {
          console.error('Registration error:', error);
          toast({
            title: "Registration Failed",
            description: error.message,
            variant: "destructive",
          });
          return { success: false, error: error.message };
        }
        
        toast({
          title: "Registration Successful",
          description: data.user 
            ? "Your account has been created! You may now sign in." 
            : "Please check your email to confirm your registration.",
        });
        
        return { success: true };
      } catch (err) {
        console.error('Error during signUp:', err);
        throw err; // Re-throw to be caught by outer catch
      }
    } catch (error: any) {
      console.error('Outer registration error:', error);
      toast({
        title: "Registration Error",
        description: error.message || "An unexpected error occurred during registration.",
        variant: "destructive",
      });
      return { success: false, error: error.message || "Unknown error" };
    } finally {
      setIsLoading(false);
    }
  };

  // Sign out
  const signOut = async () => {
    try {
      setIsLoading(true);
      
      // Check if auth is available
      if (!supabase?.auth) {
        console.error('Supabase auth not properly initialized - auth object missing');
        toast({
          title: "Authentication Error",
          description: "The sign out function is not properly initialized. Please try again later.",
          variant: "destructive",
        });
        return;
      }
      
      // TypeScript safety check for signOut method
      if (typeof (supabase.auth as any).signOut !== 'function') {
        console.error('Supabase auth not properly initialized - signOut missing');
        toast({
          title: "Authentication Error",
          description: "The sign out function is not properly configured. Please try again later.",
          variant: "destructive",
        });
        return;
      }
      
      // Attempt sign out
      try {
        const { error } = await supabase.auth.signOut();
        
        if (error) {
          console.error('Sign out error:', error);
          toast({
            title: "Sign Out Failed",
            description: error.message,
            variant: "destructive",
          });
        } else {
          // Clear local state
          setSession(null);
          setUser(null);
          
          toast({
            title: "Signed Out",
            description: "You have been signed out successfully.",
          });
        }
      } catch (err) {
        console.error('Error during signOut:', err);
        throw err; // Re-throw to be caught by outer catch
      }
    } catch (error: any) {
      console.error('Outer sign out error:', error);
      toast({
        title: "Sign Out Error",
        description: error.message || "An unexpected error occurred during sign out.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Context value
  const value = {
    session,
    user,
    isLoading,
    signIn,
    signUp,
    signOut,
  };

  // Provide the auth context to children
  return (
    <SupabaseAuthContext.Provider value={value}>
      {children}
    </SupabaseAuthContext.Provider>
  );
}

// Custom hook for using Supabase auth
export function useSupabaseAuth() {
  const context = useContext(SupabaseAuthContext);
  if (!context) {
    throw new Error('useSupabaseAuth must be used within a SupabaseAuthProvider');
  }
  return context;
}
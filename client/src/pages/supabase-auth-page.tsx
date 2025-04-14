import { useEffect } from "react";
import { useLocation } from "wouter";
import { SupabaseAuthForm } from "@/components/ui/supabase-auth-form";
import { useSupabaseAuth } from "@/hooks/use-supabase-auth";
import { Button } from "@/components/ui/button";

export default function SupabaseAuthPage() {
  const { user, isLoading, signOut } = useSupabaseAuth();
  const [location, navigate] = useLocation();

  // Redirect if already logged in
  useEffect(() => {
    if (user && !isLoading) {
      // Wait a moment to show the success state before redirecting
      const timer = setTimeout(() => {
        navigate("/");
      }, 1500);
      
      return () => clearTimeout(timer);
    }
  }, [user, isLoading, navigate]);

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="max-w-xl mx-auto">
        <h1 className="text-3xl font-bold text-center mb-8">FritSlides with Supabase</h1>
        
        {user ? (
          <div className="text-center space-y-4 p-6 bg-green-50 rounded-lg border border-green-200">
            <div className="text-xl font-medium text-green-800">✓ Successfully Authenticated</div>
            <p className="text-green-700">
              You are logged in as <span className="font-bold">{user.email}</span>
            </p>
            <p className="text-sm text-green-600">Redirecting to dashboard...</p>
            
            <div className="pt-4">
              <Button variant="outline" onClick={() => signOut()}>Sign Out</Button>
            </div>
          </div>
        ) : (
          <>
            <p className="text-center text-gray-600 mb-8">
              Sign in or create an account to use FritSlides with Supabase for persistent storage.
              Your notes and images will be securely stored and available across devices.
            </p>
            
            <SupabaseAuthForm />
            
            <div className="mt-8 text-center text-sm text-gray-500">
              <p>
                Using Supabase authentication provides a secure way to store your data.
                Your projects and notes will be safely stored in your Supabase account.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
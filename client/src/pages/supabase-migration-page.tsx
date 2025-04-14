import { useEffect } from "react";
import { useLocation } from "wouter";
import { useSupabaseAuth } from "@/hooks/use-supabase-auth";
import { JsonMigration } from "@/components/ui/json-migration";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { LogOut, Upload, Database, ArrowLeft } from "lucide-react";

export default function SupabaseMigrationPage() {
  const { user, isLoading, signOut } = useSupabaseAuth();
  const [location, navigate] = useLocation();

  // Redirect if not logged in
  useEffect(() => {
    if (!isLoading && !user) {
      navigate("/supabase-auth");
    }
  }, [user, isLoading, navigate]);

  // If still loading or not logged in, show loading state
  if (isLoading || !user) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="max-w-4xl mx-auto text-center py-12">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-200 rounded w-1/3 mx-auto"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2 mx-auto"></div>
            <div className="h-64 bg-gray-100 rounded-lg w-full mx-auto"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <header className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold">Supabase Data Migration</h1>
            <p className="text-gray-600">
              Logged in as {user.email}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate("/")}>
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to App
            </Button>
            <Button variant="outline" size="sm" onClick={() => signOut()}>
              <LogOut className="mr-2 h-4 w-4" /> Sign Out
            </Button>
          </div>
        </header>
        
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Database className="mr-2 h-5 w-5 text-primary" /> 
              Supabase Integration
            </CardTitle>
            <CardDescription>
              Your data is now securely stored in Supabase. You can import existing data or export your current data.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="bg-green-50 p-4 rounded-md border border-green-200">
                <h3 className="font-medium text-green-800 mb-2">✓ Successfully Connected</h3>
                <p className="text-sm text-green-700">
                  Your account is connected to Supabase. You can now import existing data from JSON or start creating new content.
                </p>
              </div>
              
              <div className="text-sm text-gray-600 space-y-2">
                <p>
                  <strong>What does this mean?</strong> Your data is now stored securely in the cloud with Supabase, making it accessible across devices and protected from local storage limitations.
                </p>
                <p>
                  <strong>Existing data:</strong> To bring your existing data from the local database to Supabase, use the JSON import/export tool below.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <div className="mb-8">
          <h2 className="text-xl font-bold mb-4 flex items-center">
            <Upload className="mr-2 h-5 w-5 text-primary" /> Data Import/Export
          </h2>
          <JsonMigration />
        </div>
        
        <div className="text-sm text-gray-500 mt-8">
          <h3 className="font-medium text-gray-700 mb-2">About Supabase Integration</h3>
          <p>
            Supabase provides a secure, scalable backend for your data. Your projects and notes are stored in PostgreSQL
            databases with automatic backups and high availability. Images are stored in Supabase Storage with fast content
            delivery networks.
          </p>
        </div>
      </div>
    </div>
  );
}
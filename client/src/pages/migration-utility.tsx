import { useEffect } from "react";
import { useLocation } from "wouter";
import { Loader2 } from "lucide-react";
import { SupabaseNav } from "@/components/ui/supabase-nav";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import JsonMigration from "@/components/ui/json-migration";
import { useSupabaseAuth } from "@/hooks/use-supabase-auth";

export default function MigrationUtility() {
  const [_, setLocation] = useLocation();
  const { user, isLoading } = useSupabaseAuth();

  useEffect(() => {
    if (!isLoading && !user) {
      setLocation("/auth/supabase");
    }
  }, [user, isLoading, setLocation]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return null; // Will redirect due to the effect
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <SupabaseNav />
      
      <div className="max-w-3xl mx-auto p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Data Migration Utilities</h1>
        <p className="text-gray-600 mb-6">
          Choose an option below to migrate your data to Supabase.
        </p>
        
        <Tabs defaultValue="db" className="w-full">
          <TabsList className="mb-6">
            <TabsTrigger value="db">Migrate from Database</TabsTrigger>
            <TabsTrigger value="json">Import from JSON</TabsTrigger>
          </TabsList>
          
          <TabsContent value="db">
            <iframe 
              src="/supabase-migration" 
              className="w-full min-h-[500px] border rounded-lg"
              title="Database Migration"
            />
          </TabsContent>
          
          <TabsContent value="json">
            <JsonMigration />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
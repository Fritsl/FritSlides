import { useQuery } from "@tanstack/react-query";
import { getQueryFn } from "@/lib/queryClient";
import { useSupabaseAuth } from "@/hooks/use-supabase-auth";

interface LastOpenedProjectResponse {
  lastOpenedProjectId: number | null;
}

export function useLastOpenedProject() {
  // Get the current authentication status
  const { user } = useSupabaseAuth();
  
  const result = useQuery({
    queryKey: ['/api/user/lastProject'],
    queryFn: getQueryFn<LastOpenedProjectResponse>({ on401: "returnNull" }),
    staleTime: 60 * 1000, // 1 minute
    retry: false,
    // Only run this query if we have an authenticated user
    enabled: !!user,
  });

  return {
    ...result,
    lastOpenedProject: result.data,
    isLoading: result.isLoading && !!user, // Only consider loading if we have a user
  };
}
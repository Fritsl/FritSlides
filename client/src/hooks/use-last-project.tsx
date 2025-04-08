import { useQuery } from "@tanstack/react-query";
import { getQueryFn } from "@/lib/queryClient";

interface LastOpenedProjectResponse {
  lastOpenedProjectId: number | null;
}

export function useLastOpenedProject() {
  const result = useQuery({
    queryKey: ['/api/user/lastProject'],
    queryFn: getQueryFn<LastOpenedProjectResponse>({ on401: "returnNull" }),
    staleTime: 60 * 1000, // 1 minute
    retry: false,
  });

  return {
    ...result,
    lastOpenedProject: result.data,
    isLoading: result.isLoading,
  };
}
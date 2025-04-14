import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { getSupabaseClient } from "./supabase";

// Function to get Supabase auth headers
async function getSupabaseAuthHeaders(): Promise<Record<string, string>> {
  try {
    const supabase = await getSupabaseClient();
    const { data } = await supabase.auth.getSession();
    
    if (data.session) {
      // Create a headers object with guaranteed string values
      const headers: Record<string, string> = {
        'x-supabase-user-id': data.session.user.id
      };
      
      // Only include email if it exists
      if (data.session.user.email) {
        headers['x-supabase-user-email'] = data.session.user.email;
      }
      
      return headers;
    }
    return {};
  } catch (error) {
    console.error("Failed to get Supabase auth headers:", error);
    return {};
  }
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
  options?: {
    signal?: AbortSignal;
    timeout?: number;
  }
): Promise<Response> {
  // Get Supabase authentication headers
  const supabaseHeaders = await getSupabaseAuthHeaders();
  
  // Create default fetch options with combined headers
  const headers: Record<string, string> = {
    ...(data ? { "Content-Type": "application/json" } : {}),
    ...supabaseHeaders
  };
  
  const fetchOptions: RequestInit = {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
    signal: options?.signal,
  };
  
  // Set a default timeout if none was provided
  const timeoutDuration = options?.timeout || 90000; // 90 second default timeout
  
  try {
    // Create a timeout promise that rejects after timeoutDuration
    const timeoutPromise = new Promise<Response>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Request timeout: Operation took longer than ${timeoutDuration/1000} seconds`));
      }, timeoutDuration);
    });
    
    // Log headers for debugging purposes
    console.log(`Making ${method} request to ${url} with Supabase auth:`, 
      supabaseHeaders['x-supabase-user-id'] ? 'User ID present' : 'No user ID');
    
    // Race between the fetch and the timeout
    const res = await Promise.race([
      fetch(url, fetchOptions),
      timeoutPromise
    ]);
    
    await throwIfResNotOk(res);
    return res;
  } catch (error: any) {
    console.error(`API Request failed for ${method} ${url}:`, error);
    
    // Enhance error message for timeouts
    if (error.name === 'AbortError') {
      throw new Error(`Operation was aborted or timed out. Try again with a smaller project.`);
    }
    
    throw error;
  }
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    // Get Supabase authentication headers
    const supabaseHeaders = await getSupabaseAuthHeaders();
    
    // Log headers for debugging purposes
    console.log(`Making GET request to ${queryKey[0]} with Supabase auth:`, 
      supabaseHeaders['x-supabase-user-id'] ? 'User ID present' : 'No user ID');
    
    const res = await fetch(queryKey[0] as string, {
      credentials: "include",
      headers: supabaseHeaders
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});

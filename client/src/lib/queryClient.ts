import { QueryClient, QueryFunction } from "@tanstack/react-query";

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
  // Create default fetch options
  const fetchOptions: RequestInit = {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
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
    const res = await fetch(queryKey[0] as string, {
      credentials: "include",
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

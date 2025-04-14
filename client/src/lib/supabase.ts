import { createClient } from '@supabase/supabase-js';

// Create a single Supabase client for the frontend
// Fetch credentials from either environment variables or try to get them from the server
// Note: In production, we should use environment variables directly
let supabaseUrl = '';
let supabaseAnonKey = '';

// Function to fetch Supabase credentials from the server
async function fetchSupabaseCredentials() {
  try {
    console.log('Fetching Supabase credentials from server...');
    const response = await fetch('/api/supabase-credentials');
    if (response.ok) {
      const data = await response.json();
      console.log('Got credentials response:', { url: data.url ? 'present' : 'missing', anonKey: data.anonKey ? 'present' : 'missing' });
      
      if (data.url && data.anonKey) {
        supabaseUrl = data.url;
        supabaseAnonKey = data.anonKey;
        
        // Make sure URL has proper protocol
        if (supabaseUrl && !supabaseUrl.startsWith('http')) {
          supabaseUrl = `https://${supabaseUrl}`;
        }
        
        console.log('Supabase credentials fetched successfully, URL:', supabaseUrl);
        // Re-initialize the client with the new credentials
        initializeSupabaseClient();
        return true;
      }
    } else {
      console.error('Error fetching Supabase credentials, status:', response.status);
    }
  } catch (error) {
    console.error('Failed to fetch Supabase credentials:', error);
  }
  return false;
}

// Try to get credentials from environment variables first
supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Make sure URL has proper protocol
if (supabaseUrl && !supabaseUrl.startsWith('http')) {
  supabaseUrl = `https://${supabaseUrl}`;
}

// If environment variables are missing, try to fetch from server
if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Missing Supabase environment variables. Trying to fetch from server...');
  fetchSupabaseCredentials();
}

// Create and export the Supabase client for browser usage
let supabaseClient;
try {
  if (supabaseUrl && supabaseAnonKey) {
    supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,      // Keep the session active between page refreshes
        autoRefreshToken: true,    // Automatically refresh the token if it expires
        storage: localStorage,     // Use localStorage to persist the session
      }
    });
  } else {
    // Create a mock client if credentials are missing
    supabaseClient = {
      auth: {
        signUp: () => Promise.resolve({ data: null, error: new Error('Supabase not configured') }),
        signIn: () => Promise.resolve({ data: null, error: new Error('Supabase not configured') }),
        signOut: () => Promise.resolve({ error: null }),
        getSession: () => Promise.resolve({ data: { session: null }, error: null }),
        getUser: () => Promise.resolve({ data: { user: null }, error: null })
      },
      from: (table) => ({
        select: () => ({
          limit: () => Promise.resolve({ data: [], error: null }),
          eq: () => ({
            maybeSingle: () => Promise.resolve({ data: null, error: null })
          })
        }),
        insert: () => Promise.resolve({ data: null, error: null }),
        update: () => Promise.resolve({ data: null, error: null })
      }),
      storage: {
        from: () => ({
          upload: () => Promise.resolve({ error: new Error('Supabase not configured') }),
          getPublicUrl: () => ({ data: { publicUrl: '' } }),
          list: () => Promise.resolve({ data: [], error: null })
        })
      }
    };
  }
} catch (error) {
  console.error('Error initializing Supabase client:', error);
  // Create a mock client if initialization fails
  supabaseClient = {
    from: (table) => ({
      select: () => ({
        limit: () => Promise.resolve({ data: [], error: null }),
        eq: () => ({
          maybeSingle: () => Promise.resolve({ data: null, error: null })
        })
      }),
      insert: () => Promise.resolve({ data: null, error: null }),
      update: () => Promise.resolve({ data: null, error: null })
    }),
    storage: {
      from: () => ({
        upload: () => Promise.resolve({ error: new Error('Supabase initialization failed') }),
        getPublicUrl: () => ({ data: { publicUrl: '' } }),
        list: () => Promise.resolve({ data: [], error: null })
      })
    }
  };
}

// Function to initialize/reinitialize the Supabase client
function initializeSupabaseClient() {
  try {
    if (supabaseUrl && supabaseAnonKey) {
      supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          persistSession: true,      // Keep the session active between page refreshes
          autoRefreshToken: true,    // Automatically refresh the token if it expires
          storage: localStorage,     // Use localStorage to persist the session
        }
      });
      console.log('Supabase client initialized with URL:', supabaseUrl);
    } else {
      console.warn('Cannot initialize Supabase client: missing credentials');
    }
  } catch (error) {
    console.error('Error reinitializing Supabase client:', error);
  }
}

export const supabase = supabaseClient;

/**
 * Utility function to get a direct URL to the image in Supabase Storage
 */
export function getImageUrl(path: string): string {
  if (!path) return '';
  
  // If it's already a full URL, return it
  if (path.startsWith('http')) {
    return path;
  }
  
  // If it's a local path (/api/images/...), keep using it
  if (path.startsWith('/api/')) {
    return path;
  }
  
  try {
    // Otherwise, try to construct a Supabase URL
    if (supabase && supabase.storage && typeof supabase.storage.from === 'function') {
      const bucket = supabase.storage.from('slides-images');
      if (bucket && typeof bucket.getPublicUrl === 'function') {
        const result = bucket.getPublicUrl(path);
        if (result && result.data && result.data.publicUrl) {
          return result.data.publicUrl;
        }
      }
    }
    
    // If any part of the process fails, fall back to the original path
    console.warn(`Could not get Supabase URL for ${path}, using original path`);
    return path;
  } catch (error) {
    console.error('Error getting Supabase URL:', error);
    return path;
  }
}

/**
 * Upload an image to Supabase storage
 */
export async function uploadImageToSupabase(file: File): Promise<string | null> {
  try {
    // Check if Supabase client is properly configured
    if (!supabase?.storage?.from) {
      console.warn('Supabase storage not available, skipping upload');
      return null;
    }
  
    // Create a unique filename
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 15);
    const fileExt = file.name.split('.').pop();
    const filename = `${timestamp}-${randomString}.${fileExt}`;
    
    // Upload the file
    const { data, error } = await supabase
      .storage
      .from('slides-images')
      .upload(filename, file);
    
    if (error) {
      console.error('Supabase storage upload error:', error);
      return null;
    }
    
    if (!data || !data.path) {
      console.error('Supabase upload successful but no path returned');
      return null;
    }
    
    // Get the public URL
    try {
      const { data: urlData } = supabase
        .storage
        .from('slides-images')
        .getPublicUrl(data.path);
      
      if (urlData && urlData.publicUrl) {
        return urlData.publicUrl;
      } else {
        console.error('No publicUrl returned from Supabase');
        return null;
      }
    } catch (urlError) {
      console.error('Error getting public URL:', urlError);
      return null;
    }
  } catch (error) {
    console.error('Error uploading to Supabase:', error);
    return null;
  }
}
import { createClient } from '@supabase/supabase-js';

// Try to get credentials from Vite environment variables first, fallback to API
let supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
let supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Function to fetch Supabase credentials from the server (as fallback)
async function fetchSupabaseCredentials() {
  // If we already have credentials from environment variables, no need to fetch
  if (supabaseUrl && supabaseAnonKey) {
    console.log('Using Supabase credentials from environment variables');
    
    // Log the URL with some asterisks for partial privacy
    const urlParts = supabaseUrl.split('.');
    if (urlParts.length >= 3) {
      const maskedUrl = `https://${urlParts[0].substring(0, 4)}*****.${urlParts[1]}.${urlParts[2]}`;
      console.log('Supabase credentials available from env vars, URL format:', maskedUrl);
    }
    
    return;
  }
  
  try {
    console.log('Fetching Supabase credentials from server...');
    const response = await fetch('/api/supabase-credentials');
    const data = await response.json();
    
    // More detailed logging
    console.log('Got credentials response:', {
      url: data.url ? 'present' : 'missing',
      anonKey: data.anonKey ? 'present' : 'missing'
    });
    
    if (!data.url || !data.anonKey) {
      throw new Error('Invalid Supabase credentials');
    }
    
    supabaseUrl = data.url;
    supabaseAnonKey = data.anonKey;
    
    // Check that supabaseUrl ends with .supabase.co
    if (!supabaseUrl.includes('supabase.co')) {
      console.warn('Warning: Supabase URL may be incorrect, it does not contain "supabase.co"');
    }
    
    // Log the URL with some asterisks for partial privacy
    const urlParts = supabaseUrl.split('.');
    if (urlParts.length >= 3) {
      const maskedUrl = `https://${urlParts[0].substring(0, 4)}*****.${urlParts[1]}.${urlParts[2]}`;
      console.log('Supabase credentials fetched successfully, URL format:', maskedUrl);
    } else {
      console.warn('Supabase URL format unexpected:', supabaseUrl.substring(0, 10) + '...');
    }
  } catch (error) {
    console.error('Failed to fetch Supabase credentials:', error);
    throw error;
  }
}

// Create a Supabase client
export const createSupabaseClient = async () => {
  if (!supabaseUrl || !supabaseAnonKey) {
    try {
      await fetchSupabaseCredentials();
    } catch (error) {
      console.error('Unable to initialize Supabase client:', error);
      throw error;
    }
  }
  
  // Start with a clean URL implementation
  // Extract project ID from the URL
  const urlMatch = supabaseUrl.match(/https:\/\/([^.]+)/);
  let finalUrl = supabaseUrl;
  
  if (urlMatch && urlMatch[1]) {
    // Always rebuild the URL to ensure proper formatting
    const projectId = urlMatch[1];
    finalUrl = `https://${projectId}.supabase.co`;
    console.log(`Ensuring correct Supabase URL format with project ID: ${projectId}`);
  } else {
    console.warn('Could not extract project ID from Supabase URL, using as-is');
  }
  
  // Create client with the corrected URL
  return createClient(finalUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  });
};

// Get the Supabase client (initializes it if needed)
let supabaseClient: ReturnType<typeof createClient> | null = null;

export const getSupabaseClient = async () => {
  if (!supabaseClient) {
    supabaseClient = await createSupabaseClient();
  }
  return supabaseClient;
};
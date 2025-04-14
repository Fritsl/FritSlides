import { createClient } from '@supabase/supabase-js';
import type { Database } from '../../types/supabase';

// Initialize with empty values, will be updated later
let supabaseUrl = '';
let supabaseAnonKey = '';

// Function to fetch Supabase credentials from the server
async function fetchSupabaseCredentials() {
  try {
    console.log('Fetching Supabase credentials from server...');
    const response = await fetch('/api/supabase-credentials');
    const data = await response.json();
    console.log('Got credentials response:', {
      url: data.url ? 'present' : 'missing',
      anonKey: data.anonKey ? 'present' : 'missing'
    });
    
    if (!data.url || !data.anonKey) {
      throw new Error('Invalid Supabase credentials');
    }
    
    supabaseUrl = data.url;
    supabaseAnonKey = data.anonKey;
    console.log('Supabase credentials fetched successfully, URL:', supabaseUrl);
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
  
  console.log('Supabase client initialized with URL:', supabaseUrl);
  return createClient<Database>(supabaseUrl, supabaseAnonKey, {
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
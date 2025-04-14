import { createClient } from '@supabase/supabase-js';

// Initialize with empty values, will be updated later
let supabaseUrl = '';
let supabaseAnonKey = '';

// Function to fetch Supabase credentials from the server
async function fetchSupabaseCredentials() {
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
  
  // Fix for URL truncation issue - if URL ends with .supaba, fix it to .supabase.co
  let correctedUrl = supabaseUrl;
  if (supabaseUrl.includes('.supaba')) {
    correctedUrl = supabaseUrl.replace('.supaba', '.supabase.co');
    console.log('Fixed truncated Supabase URL from .supaba to .supabase.co');
  }
  
  // Additional validation for URL format before creating client
  if (!correctedUrl.includes('supabase.co')) {
    console.warn('Supabase URL might be invalid, should contain "supabase.co":', 
                 correctedUrl.substring(0, 15) + '...');
  }
  
  // Log a masked version of the URL for privacy in console logs
  const urlParts = correctedUrl.split('.');
  const maskedUrl = urlParts.length >= 3 
    ? `https://${urlParts[0].substring(0, 4)}*****.${urlParts[1]}.${urlParts[2]}` 
    : `${correctedUrl.substring(0, 10)}...`;
  console.log('Supabase client initialized with URL format:', maskedUrl);
  
  return createClient(correctedUrl, supabaseAnonKey, {
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
import { createClient } from '@supabase/supabase-js';

// Create a single Supabase client for the frontend
let supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Make sure URL has proper protocol
if (supabaseUrl && !supabaseUrl.startsWith('http')) {
  supabaseUrl = `https://${supabaseUrl}`;
}

// Check that we have the required environment variables
if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Missing Supabase credentials. Image uploads might not work properly.');
}

// Create and export the Supabase client for browser usage
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

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
  
  // Otherwise, construct a Supabase URL
  return supabase.storage.from('slides-images').getPublicUrl(path).data.publicUrl;
}

/**
 * Upload an image to Supabase storage
 */
export async function uploadImageToSupabase(file: File): Promise<string | null> {
  try {
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
    
    // Get the public URL
    const { data: urlData } = supabase
      .storage
      .from('slides-images')
      .getPublicUrl(data.path);
    
    return urlData.publicUrl;
  } catch (error) {
    console.error('Error uploading to Supabase:', error);
    return null;
  }
}
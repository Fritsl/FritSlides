import { getSupabaseClient } from './supabase';

// The name of the bucket where we'll store images
export const IMAGES_BUCKET = 'images';

// Initialize Supabase storage bucket for images
export async function ensureStorageBucket() {
  try {
    const supabase = await getSupabaseClient();
    
    if (!supabase) {
      throw new Error('Failed to get Supabase client');
    }
    
    // Check if bucket exists
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();
    
    if (listError) {
      console.error('Error listing storage buckets:', listError);
      throw listError;
    }
    
    const bucketExists = buckets?.some(bucket => bucket.name === IMAGES_BUCKET);
    
    if (!bucketExists) {
      // Create the bucket if it doesn't exist
      const { data, error } = await supabase.storage.createBucket(IMAGES_BUCKET, {
        public: true, // Make it publicly accessible
        fileSizeLimit: 5 * 1024 * 1024, // 5MB limit
      });
      
      if (error) {
        console.error('Error creating storage bucket:', error);
        throw error;
      }
      
      console.log('Created Supabase storage bucket:', data);
    } else {
      console.log('Supabase storage bucket already exists');
    }
    
    // Update bucket to be public if needed
    // Note: setPublic method might not be available in newer Supabase versions
    // The bucket is already set to public during creation
    
    return true;
  } catch (error) {
    console.error('Error initializing storage bucket:', error);
    return false;
  }
}

// Upload a file to Supabase storage
export async function uploadToSupabaseStorage(file: File): Promise<string> {
  try {
    // Ensure storage bucket is ready
    await ensureStorageBucket();
    
    const supabase = await getSupabaseClient();
    
    if (!supabase) {
      throw new Error('Failed to get Supabase client');
    }
    
    // Generate a unique file name
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 8);
    const fileExt = file.name.split('.').pop() || 'jpg'; // Default to jpg if no extension
    const fileName = `${timestamp}-${randomString}.${fileExt}`;
    
    // Upload file to Supabase
    const { data, error } = await supabase.storage
      .from(IMAGES_BUCKET)
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: true,
      });
    
    if (error) {
      console.error('Error uploading file to Supabase storage:', error);
      throw error;
    }
    
    if (!data || !data.path) {
      throw new Error('No path returned from storage upload');
    }
    
    // Get public URL
    const { data: urlData } = supabase.storage
      .from(IMAGES_BUCKET)
      .getPublicUrl(data.path);
    
    if (!urlData || !urlData.publicUrl) {
      throw new Error('Failed to get public URL for uploaded file');
    }
    
    return urlData.publicUrl;
  } catch (error) {
    console.error('Error in uploadToSupabaseStorage:', error);
    throw error;
  }
}
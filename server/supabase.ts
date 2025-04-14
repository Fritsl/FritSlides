import { createClient } from '@supabase/supabase-js';

// Create Supabase client with service role key for server-side operations
let supabaseUrl = process.env.SUPABASE_URL as string;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY as string;

// Make sure URL has proper protocol
if (supabaseUrl && !supabaseUrl.startsWith('http')) {
  supabaseUrl = `https://${supabaseUrl}`;
}

if (!supabaseUrl || !supabaseKey) {
  throw new Error('SUPABASE_URL and SUPABASE_SERVICE_KEY must be defined in environment variables');
}

// Create and export the Supabase client with the service role key
export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Create a bucket for image storage if it doesn't exist
async function initializeStorage() {
  try {
    const bucketName = 'slides-images';
    
    // First check if we can list buckets (to verify permissions)
    try {
      const { data: buckets, error: listError } = await supabase.storage.listBuckets();
      
      if (listError) {
        console.warn(`Cannot list Supabase buckets: ${listError.message}`);
        // Continue anyway, we'll try to create the bucket
      } else {
        // Check if our bucket already exists
        const bucketExists = buckets?.some(bucket => bucket.name === bucketName);
        
        if (bucketExists) {
          console.log(`Bucket '${bucketName}' already exists in Supabase storage.`);
          return;
        }
      }
    } catch (listError) {
      console.warn(`Error listing Supabase buckets: ${listError}`);
      // Continue anyway, we'll try to create the bucket
    }
    
    // Try to create the bucket
    try {
      const { data, error } = await supabase.storage.createBucket(bucketName, {
        public: true, // Make files publicly accessible
        fileSizeLimit: 5 * 1024 * 1024, // 5MB limit
      });
      
      if (error) {
        if (error.message.includes('already exists')) {
          console.log(`Bucket '${bucketName}' already exists in Supabase storage.`);
        } else {
          console.error(`Failed to create storage bucket: ${error.message}`);
        }
      } else {
        console.log(`Created storage bucket: ${bucketName}`);
      }
    } catch (createError) {
      console.error(`Failed to create bucket: ${createError}`);
    }
    
    // Try to update bucket policy to public even if creation failed
    // (in case bucket exists but isn't public)
    try {
      await supabase.storage.updateBucket(bucketName, {
        public: true,
        fileSizeLimit: 5 * 1024 * 1024,
      });
      console.log(`Updated bucket '${bucketName}' policy to public.`);
    } catch (updateError) {
      console.warn(`Could not update bucket policy: ${updateError}`);
    }
  } catch (error) {
    console.error('Error initializing Supabase storage:', error);
  }
}

// Export a function to initialize Supabase resources
export async function initializeSupabase() {
  await initializeStorage();
  console.log('Supabase client initialized');
}
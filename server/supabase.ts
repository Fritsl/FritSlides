import { createClient } from '@supabase/supabase-js';

// Create Supabase client with service role key for server-side operations
const supabaseUrl = process.env.SUPABASE_URL as string;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY as string;

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
    const { data: buckets } = await supabase.storage.listBuckets();
    
    // Check if our bucket already exists
    const bucketName = 'slides-images';
    const bucketExists = buckets?.some(bucket => bucket.name === bucketName);
    
    if (!bucketExists) {
      // Create the bucket if it doesn't exist
      const { data, error } = await supabase.storage.createBucket(bucketName, {
        public: true, // Make files publicly accessible
        fileSizeLimit: 5 * 1024 * 1024, // 5MB limit
      });
      
      if (error) {
        console.error(`Failed to create storage bucket: ${error.message}`);
      } else {
        console.log(`Created storage bucket: ${bucketName}`);
      }
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
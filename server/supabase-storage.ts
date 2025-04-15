import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import type { User } from '@shared/schema';

// The name of the bucket where we'll store images
export const IMAGES_BUCKET = 'images';

// Create a Supabase client for the server
let supabaseClient: ReturnType<typeof createClient> | null = null;

export async function getSupabaseClient() {
  if (supabaseClient) return supabaseClient;
  
  // Get Supabase configuration from environment variables
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
  
  // Check if we have the required configuration
  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase configuration');
    return null;
  }
  
  try {
    // Create the Supabase client with the service role key for admin privileges
    supabaseClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
    
    console.log('Supabase admin client initialized with service role key');
    return supabaseClient;
  } catch (error) {
    console.error('Error creating Supabase client:', error);
    return null;
  }
}

// Helper function: Convert UUID string to integer
function hashStringToInteger(str: string): number {
  // Simple hash function to convert UUID to a numeric ID
  // Same implementation as in auth-supabase.ts and SupabaseStorage
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  // Ensure positive number with reasonable range (0 to 2^31-1)
  return Math.abs(hash) % 2147483647;
}

// Direct user operations with Supabase (bypassing RLS)
export async function getSupabaseUser(userId: string): Promise<User | null> {
  try {
    const supabase = await getSupabaseClient();
    
    if (!supabase) {
      console.error('Cannot access Supabase client to fetch user');
      return null;
    }
    
    // Convert UUID string to numeric ID for database lookup
    const numericUserId = hashStringToInteger(userId);
    console.log(`Fetching user with numeric ID: ${numericUserId} (from UUID: ${userId}) using admin client`);
    
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', numericUserId)
      .single();
    
    if (error) {
      console.error('Error fetching user from Supabase:', error);
      return null;
    }
    
    if (!data) {
      console.log(`User ${numericUserId} not found in Supabase`);
      return null;
    }
    
    console.log(`User ${numericUserId} found in Supabase:`, JSON.stringify(data));
    
    // Convert data to our User type
    return {
      id: numericUserId,
      username: data.username || `user_${userId.substring(0, 8)}`,
      password: null,
      lastOpenedProjectId: data.lastopenedprojectid || null
    } as User;
  } catch (error) {
    console.error('Exception in getSupabaseUser:', error);
    return null;
  }
}

// Create user directly in Supabase
export async function createSupabaseUser(userId: string, email: string | null, lastProjectId: number | null = null): Promise<User | null> {
  try {
    const supabase = await getSupabaseClient();
    
    if (!supabase) {
      console.error('Cannot access Supabase client to create user');
      return null;
    }
    
    // Convert UUID string to numeric ID 
    const numericUserId = hashStringToInteger(userId);
    console.log(`Creating user with numeric ID: ${numericUserId} (from UUID: ${userId}) in Supabase using admin client`);
    
    const { data, error } = await supabase
      .from('users')
      .insert({
        id: numericUserId, // Using the numeric ID for database consistency
        username: email || `user_${userId.substring(0, 8)}`,
        lastopenedprojectid: lastProjectId
      })
      .select()
      .single();
    
    if (error) {
      console.error('Error creating user in Supabase:', error);
      return null;
    }
    
    if (!data) {
      console.log(`Failed to create user ${numericUserId} in Supabase`);
      return null;
    }
    
    console.log(`User ${numericUserId} created in Supabase:`, JSON.stringify(data));
    
    // Convert data to our User type with numeric ID
    return {
      id: numericUserId,
      username: data.username || `user_${userId.substring(0, 8)}`,
      password: null,
      lastOpenedProjectId: data.lastopenedprojectid || null
    } as User;
  } catch (error) {
    console.error('Exception in createSupabaseUser:', error);
    return null;
  }
}

// Update lastOpenedProject for user
export async function updateSupabaseUserLastProject(userId: string, projectId: number | null): Promise<boolean> {
  try {
    const supabase = await getSupabaseClient();
    
    if (!supabase) {
      console.error('Cannot access Supabase client to update user');
      return false;
    }
    
    console.log(`Updating lastOpenedProject for user ${userId} to ${projectId} in Supabase using admin client`);
    
    const { error } = await supabase
      .from('users')
      .update({
        lastopenedprojectid: projectId
      })
      .eq('id', userId);
    
    if (error) {
      console.error('Error updating user in Supabase:', error);
      return false;
    }
    
    console.log(`Successfully updated lastOpenedProject for user ${userId} to ${projectId}`);
    return true;
  } catch (error) {
    console.error('Exception in updateSupabaseUserLastProject:', error);
    return false;
  }
}

// Ensure the images bucket exists
export async function ensureImagesBucket() {
  try {
    const supabase = await getSupabaseClient();
    if (!supabase) {
      throw new Error('Failed to initialize Supabase client');
    }
    
    // Check if the bucket already exists
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();
    if (listError) {
      console.error('Error listing buckets:', listError);
      throw listError;
    }
    
    const bucketExists = buckets.some(bucket => bucket.name === IMAGES_BUCKET);
    
    if (!bucketExists) {
      // Create the bucket if it doesn't exist
      const { data, error } = await supabase.storage.createBucket(IMAGES_BUCKET, {
        public: true, // Make it publicly accessible
        fileSizeLimit: 5 * 1024 * 1024, // 5MB limit
      });
      
      if (error) {
        console.error('Error creating bucket:', error);
        throw error;
      }
      
      console.log('Created images bucket');
    } else {
      console.log('Images bucket already exists');
    }
    
    return true;
  } catch (error) {
    console.error('Error ensuring images bucket:', error);
    return false;
  }
}

// Upload a file to Supabase storage
export async function uploadToSupabaseStorage(filePath: string): Promise<string | null> {
  try {
    // Make sure the bucket exists
    const bucketReady = await ensureImagesBucket();
    if (!bucketReady) {
      throw new Error('Failed to ensure images bucket exists');
    }
    
    const supabase = await getSupabaseClient();
    if (!supabase) {
      throw new Error('Failed to initialize Supabase client');
    }
    
    // Read the file
    const fileContent = fs.readFileSync(filePath);
    const fileName = path.basename(filePath);
    
    // Upload to Supabase
    const { data, error } = await supabase.storage
      .from(IMAGES_BUCKET)
      .upload(fileName, fileContent, {
        cacheControl: '3600',
        upsert: true,
      });
    
    if (error) {
      console.error('Error uploading to Supabase storage:', error);
      throw error;
    }
    
    // Get the public URL
    const { data: urlData } = supabase.storage
      .from(IMAGES_BUCKET)
      .getPublicUrl(data.path);
    
    console.log('File uploaded to Supabase storage:', urlData.publicUrl);
    return urlData.publicUrl;
  } catch (error) {
    console.error('Error in uploadToSupabaseStorage:', error);
    return null;
  }
}
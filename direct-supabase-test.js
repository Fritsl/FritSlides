// Direct test script to verify Supabase connection and write capabilities
import { createClient } from '@supabase/supabase-js';

async function runDirectSupabaseTest() {
  console.log('Starting direct Supabase test...');
  
  // Get Supabase credentials from environment variables
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    console.error('Missing Supabase credentials in environment variables');
    return;
  }
  
  console.log(`Connecting to Supabase at: ${supabaseUrl}`);
  
  // Create Supabase client with service role key (admin privileges)
  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
  
  // Test with integer ID since UUID is failing
  const testUserId = 12345678;
  const testUsername = 'direct_test_user';
  
  try {
    console.log('Attempting to insert user directly to Supabase...');
    
    // Insert a test user record
    const { data: userData, error: userError } = await supabase
      .from('users')
      .upsert({
        id: testUserId,
        username: testUsername,
        password: 'test_password', // Adding a password since null is not allowed
        lastOpenedProjectId: null
      })
      .select();
    
    if (userError) {
      console.error('Failed to insert user:', userError);
      return;
    }
    
    console.log('Successfully inserted/updated user:', userData);
    
    // Try to insert a project
    console.log('Attempting to insert project directly to Supabase...');
    
    const { data: projectData, error: projectError } = await supabase
      .from('projects')
      .insert({
        userId: testUserId,
        name: 'Direct Test Project',
        startSlogan: 'Test Start',
        endSlogan: 'Test End',
        author: 'Direct Test',
        lastViewedSlideIndex: 0,
        isLocked: false,
        createdAt: new Date().toISOString()
      })
      .select();
    
    if (projectError) {
      console.error('Failed to insert project:', projectError);
      return;
    }
    
    console.log('Successfully inserted project:', projectData);
    
    // Try to insert a note
    console.log('Attempting to insert note directly to Supabase...');
    
    const projectId = projectData[0].id;
    
    const { data: noteData, error: noteError } = await supabase
      .from('notes')
      .insert({
        projectId: projectId,
        parentId: null,
        content: 'Direct test note content',
        url: null,
        linkText: null,
        youtubeLink: null,
        time: null,
        isDiscussion: false,
        images: [],
        order: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      })
      .select();
    
    if (noteError) {
      console.error('Failed to insert note:', noteError);
      return;
    }
    
    console.log('Successfully inserted note:', noteData);
    
    console.log('Direct Supabase test completed successfully!');
  } catch (error) {
    console.error('Unexpected error during direct Supabase test:', error);
  }
}

// Run the test
runDirectSupabaseTest();
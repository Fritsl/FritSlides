// Direct test script to verify we can write to Supabase
import { createClient } from '@supabase/supabase-js';

// We'll just hardcode the values we've seen in .env
const SUPABASE_URL = "https://waaqtqxoylxvhykessnc.supabase.co";

async function runTest() {
  console.log('Starting direct Supabase write test...');
  
  // Use the hardcoded URL and get the service key from process.env
  const supabaseUrl = SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  console.log('Supabase URL:', supabaseUrl);
  console.log('Service key present:', !!supabaseServiceKey);
  
  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('ERROR: Missing Supabase credentials');
    console.error('Please ensure SUPABASE_SERVICE_ROLE_KEY is set in Replit Secrets');
    process.exit(1);
  }
  
  try {
    // Create a direct Supabase client using the service role key
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    console.log('Supabase client created');
    
    // FIRST: Let's check the actual schema to see what columns exist
    console.log('\n--- CHECKING DATABASE SCHEMA ---');
    console.log('\nFetching users table information...');
    const { data: usersData, error: usersError } = await supabase
      .from('users')
      .select('*')
      .limit(1);
    
    if (usersError) {
      console.error('ERROR fetching users table:', usersError);
    } else {
      console.log('Users table schema sample:', usersData);
      // Look at column names in first row or use introspection endpoint
      console.log('Available columns:', Object.keys(usersData[0] || {}));
    }
    
    // Simple write test without creating actual entities
    console.log('\n--- TESTING WRITE CAPABILITY ---');
    console.log('\nCreating a test table entry to verify write access...');
    
    // Simplest possible test - no complex schemas
    // Create a test user with minimal required fields
    const testUser = {
      id: 'test-' + Date.now(),
      username: 'testuser-' + Date.now()
      // No other fields until we know exactly what the schema is
    };
    
    console.log('Attempting to create test user with minimal fields:', testUser);
    
    const { data: userData, error: userError } = await supabase
      .from('users')
      .insert(testUser)
      .select();
    
    if (userError) {
      console.error('ERROR creating test user:', userError);
    } else {
      console.log('SUCCESS! Test user created:', userData);
      
      // 2. Second test: Create a test project
      const testProject = {
        userid: testUser.id,
        name: 'Test Project ' + Date.now(),
        createdat: new Date().toISOString()
      };
      
      console.log('Attempting to create test project:', testProject);
      
      const { data: projectData, error: projectError } = await supabase
        .from('projects')
        .insert(testProject)
        .select();
      
      if (projectError) {
        console.error('ERROR creating test project:', projectError);
      } else {
        console.log('SUCCESS! Test project created:', projectData);
        
        // 3. Third test: Create a test note
        const testNote = {
          projectid: projectData[0].id,
          content: 'Test note content ' + Date.now(),
          createdat: new Date().toISOString(),
          updatedat: new Date().toISOString(),
          order: 0
        };
        
        console.log('Attempting to create test note:', testNote);
        
        const { data: noteData, error: noteError } = await supabase
          .from('notes')
          .insert(testNote)
          .select();
        
        if (noteError) {
          console.error('ERROR creating test note:', noteError);
        } else {
          console.log('SUCCESS! Test note created:', noteData);
          console.log('FULL TEST SUCCESSFUL! We can write to Supabase!');
        }
      }
    }
  } catch (error) {
    console.error('CRITICAL ERROR:', error);
  }
}

// Run the test
runTest();
// Direct test to write data to existing Supabase tables
import { createClient } from '@supabase/supabase-js';

async function runWriteTest() {
  console.log('=== DIRECT SUPABASE WRITE TEST ===');
  
  // Check environment variables
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    console.error('ERROR: Missing Supabase credentials');
    return;
  }
  
  // Create client
  const supabase = createClient(supabaseUrl, supabaseKey);
  console.log('Supabase client created successfully');
  
  // Get the existing user ID
  console.log('Fetching existing user:');
  const { data: existingUser, error: userError } = await supabase
    .from('users')
    .select('id, username')
    .eq('username', 'fritslyneborg@gmail.com')
    .single();
  
  if (userError) {
    console.log('Error fetching user:', userError.message);
    return;
  }
  
  console.log('Found existing user:', existingUser);
  const userId = existingUser.id;
  
  // First check the structure of the projects table
  console.log('\nChecking projects table structure:');
  const { data: projectColumns, error: columnError } = await supabase
    .from('information_schema.columns')
    .select('column_name, data_type')
    .eq('table_name', 'projects');
    
  if (columnError) {
    console.error('Error fetching project columns:', columnError.message);
  } else {
    console.log('Project table columns:', projectColumns?.map(col => `${col.column_name} (${col.data_type})`));
  }
  
  // Create a test project with minimal fields
  console.log('\nCreating test project for user ID:', userId);
  const { data: projectData, error: projectError } = await supabase
    .from('projects')
    .insert({
      userId: userId,
      name: 'Test Project via Direct API'
    })
    .select();
  
  if (projectError) {
    console.error('Error creating project:', projectError.message);
    return;
  }
  
  console.log('Project created successfully:', projectData);
  const projectId = projectData[0].id;
  
  // Check notes table structure
  console.log('\nChecking notes table structure:');
  const { data: noteColumns, error: noteColumnError } = await supabase
    .from('information_schema.columns')
    .select('column_name, data_type')
    .eq('table_name', 'notes');
    
  if (noteColumnError) {
    console.error('Error fetching note columns:', noteColumnError.message);
  } else {
    console.log('Notes table columns:', noteColumns?.map(col => `${col.column_name} (${col.data_type})`));
  }
  
  // Create a test note with minimal fields
  console.log('\nCreating test note for project ID:', projectId);
  const { data: noteData, error: noteError } = await supabase
    .from('notes')
    .insert({
      projectId: projectId,
      content: 'Direct test note content'
    })
    .select();
  
  if (noteError) {
    console.error('Error creating note:', noteError.message);
    return;
  }
  
  console.log('Note created successfully:', noteData);
  
  console.log('\nSUCCESS: Test data written to Supabase!');
}

runWriteTest();
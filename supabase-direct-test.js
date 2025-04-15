// The most basic possible Supabase connection test
import { createClient } from '@supabase/supabase-js';

async function runTest() {
  console.log('=== DIRECT SUPABASE CONNECTION TEST ===');
  
  // Check environment variables
  console.log('SUPABASE_URL exists:', !!process.env.SUPABASE_URL);
  console.log('SUPABASE_SERVICE_ROLE_KEY exists:', !!process.env.SUPABASE_SERVICE_ROLE_KEY);
  
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    console.error('ERROR: Missing Supabase credentials');
    return;
  }
  
  console.log('Supabase URL:', supabaseUrl);
  console.log('Attempting to create Supabase client...');
  
  try {
    // Create client
    const supabase = createClient(supabaseUrl, supabaseKey);
    console.log('Supabase client created successfully');
    
    // Test the connection with a simple query
    console.log('Testing connection with a simple query...');
    const { data, error } = await supabase.from('_test_connection').select('*').limit(1);
    
    // Error is expected since the table doesn't exist, but we want to confirm the error is from Supabase
    console.log('Response received from Supabase:');
    console.log('Error:', error ? error.message : 'No error');
    console.log('Data:', data);
    
    if (error && error.code === '42P01') {
      console.log('SUCCESS: Connected to Supabase! (Got expected error for non-existent table)');
    } else {
      console.log('UNCERTAIN: Got a response but not the expected error code');
    }
    
    // Check for existing tables
    console.log('\nChecking for existing tables in Supabase...');
    console.log('Looking for users table:');
    const { data: usersTable, error: usersError } = await supabase
      .from('users')
      .select('*')
      .limit(1);
      
    if (usersError) {
      console.log('Users table error:', usersError.message);
    } else {
      console.log('Users table exists!', usersTable);
    }
    
    console.log('\nLooking for projects table:');
    const { data: projectsTable, error: projectsError } = await supabase
      .from('projects')
      .select('*')
      .limit(1);
      
    if (projectsError) {
      console.log('Projects table error:', projectsError.message);
    } else {
      console.log('Projects table exists!', projectsTable);
    }
    
    console.log('\nLooking for notes table:');
    const { data: notesTable, error: notesError } = await supabase
      .from('notes')
      .select('*')
      .limit(1);
      
    if (notesError) {
      console.log('Notes table error:', notesError.message);
    } else {
      console.log('Notes table exists!', notesTable);
    }
    
    // Create a test table if needed
    console.log('\nTrying to create a users table:');
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE,
        password TEXT,
        "lastOpenedProjectId" INTEGER
      )
    `;
    
    try {
      const { error: createError } = await supabase.rpc('exec_sql', { 
        sql: createTableSQL 
      });
      
      if (createError) {
        console.log('Error creating table:', createError.message);
      } else {
        console.log('Successfully created or verified users table');
      }
    } catch (sqlErr) {
      console.log('SQL execution error, likely the RPC does not exist:', sqlErr.message);
    }
  } catch (e) {
    console.error('CRITICAL ERROR connecting to Supabase:', e.message);
  }
}

runTest();
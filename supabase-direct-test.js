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
    
    // Try a more direct approach
    console.log('\nTesting with a system table query...');
    const { data: schemaTables, error: schemaError } = await supabase
      .from('pg_tables')
      .select('tablename')
      .limit(5);
    
    if (schemaError) {
      console.error('FAILED: Error querying system tables:', schemaError.message);
    } else {
      console.log('SUCCESS: Retrieved tables from Supabase:');
      console.log(schemaTables);
    }
  } catch (e) {
    console.error('CRITICAL ERROR connecting to Supabase:', e.message);
  }
}

runTest();
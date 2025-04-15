// Simple script to add missing isDiscussion column to Supabase notes table
import { createClient } from '@supabase/supabase-js';

async function addMissingColumn() {
  console.log('Adding missing isDiscussion column to notes table...');
  
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
  
  try {
    // Execute the SQL statement directly
    const sql = 'ALTER TABLE notes ADD COLUMN "isDiscussion" BOOLEAN DEFAULT FALSE;';
    
    console.log('Executing SQL statement:', sql);
    
    // Use the RPC method to execute SQL
    const { error } = await supabase.rpc('pg_execute_sql', { query: sql });
    
    if (error) {
      // Check if it's just because the column already exists
      if (error.message && error.message.includes('column "isDiscussion" of relation "notes" already exists')) {
        console.log('Column already exists, no changes needed.');
        return true;
      }
      
      console.error('Error executing SQL:', error);
      
      // Try direct SQL execution as fallback
      console.log('Trying direct SQL execution...');
      
      try {
        // Run direct SQL without going through the RPC interface
        const response = await fetch(`${supabaseUrl}/rest/v1/`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': supabaseServiceRoleKey,
            'Authorization': `Bearer ${supabaseServiceRoleKey}`,
            'X-Client-Info': 'supabase-js/2.0.0',
            'X-Direct-SQL': 'true'
          },
          body: JSON.stringify({ query: sql })
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error(`SQL execution failed: ${errorText}`);
          return false;
        } else {
          console.log('SQL executed via direct API');
          return true;
        }
      } catch (directError) {
        console.error('Direct SQL execution failed:', directError);
        return false;
      }
    } else {
      console.log('SQL statement executed successfully');
      return true;
    }
  } catch (error) {
    console.error('Unexpected error:', error);
    return false;
  }
}

// Run the function to add the missing column
addMissingColumn();
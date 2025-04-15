// Script to directly test and modify Supabase database
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function runTest() {
  console.log('Running Supabase direct test and modification...');
  
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
    // First check if isDiscussion column exists
    console.log('Checking if isDiscussion column exists in notes table...');
    
    // This will list all columns in the notes table
    const { data: columns, error: columnsError } = await supabase
      .from('notes')
      .select('isDiscussion')
      .limit(1);
      
    if (columnsError) {
      // If the error message contains "column" and "does not exist", then we know it's missing
      if (columnsError.message && columnsError.message.includes('does not exist')) {
        console.log('isDiscussion column does not exist. Adding it now...');
        
        // Use direct SQL to add the column
        const { error: alterError } = await supabase.rpc('exec', { 
          query: 'ALTER TABLE notes ADD COLUMN "isDiscussion" BOOLEAN DEFAULT FALSE;' 
        });
        
        if (alterError) {
          console.error('Error adding isDiscussion column:', alterError);
          
          // Try a different approach if the first one failed
          console.log('Trying alternative approach with REST API...');
          
          try {
            // Use PostgreSQL function to execute arbitrary SQL
            const { error: execError } = await supabase.rpc('pg_execute', { 
              statement: 'ALTER TABLE notes ADD COLUMN "isDiscussion" BOOLEAN DEFAULT FALSE;' 
            });
            
            if (execError) {
              console.error('Alternative approach also failed:', execError);
              
              // Try a third approach with direct SQL API
              console.log('Trying third approach with direct SQL...');
              const response = await fetch(`${supabaseUrl}/rest/v1/sql`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'apikey': supabaseServiceRoleKey,
                  'Authorization': `Bearer ${supabaseServiceRoleKey}`
                },
                body: JSON.stringify({
                  query: 'ALTER TABLE notes ADD COLUMN "isDiscussion" BOOLEAN DEFAULT FALSE;'
                })
              });
              
              if (!response.ok) {
                const errorData = await response.text();
                console.error('Third approach failed:', errorData);
                return false;
              }
              
              console.log('Successfully added isDiscussion column using direct SQL API');
              return true;
            } else {
              console.log('Successfully added isDiscussion column using PostgreSQL function');
              return true;
            }
          } catch (execErr) {
            console.error('Error executing alternative approach:', execErr);
            return false;
          }
        } else {
          console.log('Successfully added isDiscussion column');
          return true;
        }
      } else {
        console.error('Error checking for isDiscussion column:', columnsError);
        return false;
      }
    } else {
      // If we got data back, the column exists
      console.log('isDiscussion column already exists in the notes table');
      return true;
    }
  } catch (error) {
    console.error('Unexpected error:', error);
    return false;
  }
}

// Run the function and log the result
runTest()
  .then(result => {
    console.log(`Operation ${result ? 'succeeded' : 'failed'}`);
    process.exit(result ? 0 : 1);
  })
  .catch(err => {
    console.error('Error running test:', err);
    process.exit(1);
  });
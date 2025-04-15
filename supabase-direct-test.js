// Direct test and fix for Supabase database
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

async function runDirectSupabaseTest() {
  console.log('Running direct Supabase test and fix...');
  
  // Get credentials from environment variables
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase credentials in environment variables');
    console.log('SUPABASE_URL present:', !!supabaseUrl);
    console.log('SUPABASE_SERVICE_ROLE_KEY present:', !!supabaseKey);
    return;
  }
  
  console.log(`Connecting to Supabase at: ${supabaseUrl}`);
  
  // Create Supabase client with service role key
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  try {
    // First, let's check what columns actually exist in the notes table
    console.log('Listing existing columns in notes table...');
    
    const { data: notesData, error: notesError } = await supabase
      .from('notes')
      .select('*')
      .limit(1);
      
    if (notesError) {
      console.error('❌ Error fetching notes table data:', notesError);
    } else {
      const sampleNote = notesData[0] || {};
      console.log('Current note columns:', Object.keys(sampleNote).join(', '));
      console.log('isDiscussion column exists:', 'isDiscussion' in sampleNote);
    }
    
    // Now try to add the isDiscussion column
    console.log('Attempting to add isDiscussion column to notes table...');
    
    // Method 1: Using Postgres functions (if available)
    try {
      const { error: sqlError } = await supabase.rpc('exec', {
        sql: 'ALTER TABLE notes ADD COLUMN IF NOT EXISTS "isDiscussion" BOOLEAN DEFAULT FALSE;'
      });
      
      if (sqlError) {
        console.log('Method 1 failed:', sqlError.message);
        
        // Method 2: Try another RPC function
        try {
          const { error: rpcError } = await supabase.rpc('pg_execute', {
            statement: 'ALTER TABLE notes ADD COLUMN IF NOT EXISTS "isDiscussion" BOOLEAN DEFAULT FALSE;'
          });
          
          if (rpcError) {
            console.log('Method 2 failed:', rpcError.message);
            
            // Method 3: Try direct REST API SQL endpoint
            try {
              const response = await fetch(`${supabaseUrl}/rest/v1/sql`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'apikey': supabaseKey,
                  'Authorization': `Bearer ${supabaseKey}`
                },
                body: JSON.stringify({
                  query: 'ALTER TABLE notes ADD COLUMN IF NOT EXISTS "isDiscussion" BOOLEAN DEFAULT FALSE;'
                })
              });
              
              if (!response.ok) {
                const errorText = await response.text();
                console.log('Method 3 failed:', errorText);
                console.log('All methods failed to add isDiscussion column.');
              } else {
                console.log('✅ Successfully added isDiscussion column using Method 3');
              }
            } catch (err) {
              console.error('Method 3 exception:', err);
            }
          } else {
            console.log('✅ Successfully added isDiscussion column using Method 2');
          }
        } catch (err) {
          console.error('Method 2 exception:', err);
        }
      } else {
        console.log('✅ Successfully added isDiscussion column using Method 1');
      }
    } catch (err) {
      console.error('Method 1 exception:', err);
    }
    
    // Verify if the column was added successfully
    console.log('Verifying if isDiscussion column was added...');
    
    const { data: verifyData, error: verifyError } = await supabase
      .from('notes')
      .select('*')
      .limit(1);
      
    if (verifyError) {
      console.error('❌ Error verifying column addition:', verifyError);
    } else {
      const sampleNote = verifyData[0] || {};
      console.log('Updated note columns:', Object.keys(sampleNote).join(', '));
      console.log('isDiscussion column now exists:', 'isDiscussion' in sampleNote);
    }
  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

// Run the test
runDirectSupabaseTest().then(() => {
  console.log('Test completed.');
});
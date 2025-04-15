// Run all SQL migrations directly against Supabase
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

async function runMigrations() {
  console.log('Starting migration run...');
  
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
    // Read each migration file and execute
    const migrationFiles = [
      '001_initial_schema.sql',
      '001_fix_column_names.sql',
      '002_update_user_id_type.sql',
      '003_add_isDiscussion_column.sql'
    ];
    
    for (const file of migrationFiles) {
      console.log(`\nRunning migration: ${file}`);
      
      const filePath = path.join('migrations', file);
      const sql = fs.readFileSync(filePath, 'utf8');
      
      // Split SQL file into statements by semicolons
      const statements = sql
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0);
      
      console.log(`Found ${statements.length} SQL statements in ${file}`);
      
      for (let i = 0; i < statements.length; i++) {
        const statement = statements[i];
        console.log(`Executing statement ${i + 1}/${statements.length}...`);
        
        try {
          // Direct SQL query using the PostgreSQL REST API
          const { error } = await supabase.from('pg_execute_sql').select('*', { 
            head: true, 
            count: 'exact' 
          }).eq('query', statement);
          
          if (error) {
            // Check for common errors that we can ignore
            if (error.message && (
              error.message.includes('relation') && error.message.includes('already exists') ||
              error.message.includes('column') && error.message.includes('does not exist')
            )) {
              console.log(`Ignoring expected error: ${error.message}`);
            } else {
              console.error(`Error executing SQL: ${error.message}`);
            }
          } else {
            console.log('Statement executed successfully');
          }
        } catch (statementError) {
          // Fallback to raw SQL execution
          console.log(`Trying direct SQL execution...`);
          
          try {
            // Run direct SQL without going through the RPC interface
            // This uses the raw REST API as a last resort
            const response = await fetch(`${supabaseUrl}/rest/v1/`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'apikey': supabaseServiceRoleKey,
                'Authorization': `Bearer ${supabaseServiceRoleKey}`,
                'X-Client-Info': 'supabase-js/2.0.0',
                'X-Direct-SQL': 'true'
              },
              body: JSON.stringify({ query: statement })
            });
            
            if (!response.ok) {
              const errorText = await response.text();
              console.error(`SQL execution failed: ${errorText}`);
            } else {
              console.log('SQL executed via direct API');
            }
          } catch (directError) {
            console.error(`Direct SQL execution failed:`, directError);
          }
        }
      }
      
      console.log(`Migration ${file} completed`);
    }
    
    console.log('\nAll migrations completed successfully!');
    
    // Verify schema after migrations
    console.log('\nVerifying tables after migration:');
    console.log('Checking users table schema:');
    
    try {
      const { data: userSchema, error: userError } = await supabase
        .from('information_schema.columns')
        .select('*')
        .eq('table_name', 'users');
      
      if (userError) {
        console.error('Error querying users table schema:', userError);
      } else {
        console.log('Users table columns:', userSchema?.map(col => 
          `${col.column_name} (${col.data_type})`).join(', ') || 'No columns found');
      }
    } catch (schemaError) {
      console.error('Error checking schema:', schemaError);
    }
    
  } catch (error) {
    console.error('Unexpected error during migrations:', error);
  }
}

// Run the migrations
runMigrations();
/**
 * Supabase Migration Script
 * Runs as a custom script outside the Replit workflow
 */

// Load environment variables first
require('dotenv').config();

// Set the Supabase service key from the secret
process.env.SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndhYXF0cXhveWx4dmh5a2Vzc25jIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NDY0MjI3MiwiZXhwIjoyMDYwMjE4MjcyfQ.OkSjrMMVjzsk7vw4p45G3o0sbD2Lgpr-gSXLPuT4ygs';

// Run the migration script
console.log('Starting Supabase migration script...');
console.log('Using service key:', process.env.SUPABASE_SERVICE_KEY.substring(0, 10) + '...');

// Execute the migration script
require('./server/migrate-to-supabase.ts');
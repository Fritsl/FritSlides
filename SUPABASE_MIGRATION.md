# Migrating to Supabase for Persistent Storage

This document explains how to migrate your application data to Supabase for persistent storage.

## Why Migrate to Supabase?

The current application uses PostgreSQL for data storage, but Replit's file system is ephemeral, meaning files uploaded to the server (like images) will be lost when the application is redeployed. By migrating to Supabase, we gain:

1. **Persistent Storage**: All data, including images, will be stored in Supabase's cloud, surviving deployments
2. **Built-in Authentication**: Can leverage Supabase Auth in the future
3. **Scalability**: Better performance as your application grows
4. **Simplified Deployment**: No need to worry about database management

## Prerequisites

- Supabase Account (free tier is sufficient)
- Supabase Project created
- Supabase API Keys:
  - `SUPABASE_URL`: Your Supabase project URL
  - `SUPABASE_SERVICE_KEY`: The service role key (for server-side operations)
  - `SUPABASE_ANON_KEY`: The anon/public key (for client-side operations)

## Setup Environment Variables

1. Add your Supabase credentials to Replit's Secrets through the left sidebar:
   - `SUPABASE_URL` - Example: https://youprojectid.supabase.co
   - `SUPABASE_SERVICE_KEY` - Your service role key
   - `SUPABASE_ANON_KEY` - Your anon/public key

## Migration Process

The application has been updated to work with both local PostgreSQL and Supabase storage simultaneously. This allows for a gradual migration process:

1. **New images** will be uploaded to Supabase Storage automatically
2. **Existing images** will continue to be served from the local file system until they are migrated

### Running the Migration Script

To transfer existing data (users, projects, and notes) to Supabase:

```bash
npx tsx server/migrate-to-supabase.ts
```

The script will:
1. Create necessary tables in Supabase if they don't exist
2. Migrate all users
3. Migrate all projects
4. Migrate all notes (with proper parent-child relationships)

### Migrating Images

For images, there are two approaches:

1. **Automatic Migration**: The application will attempt to upload images to Supabase when they're first accessed
2. **Manual Migration**: For large datasets, you can export images and import them into Supabase Storage directly

## Verification

After migration:

1. Log in to your application
2. Verify that your projects and notes appear correctly
3. Check that images are loading properly 
4. Try uploading a new image to confirm it's stored in Supabase

## Troubleshooting

- If images aren't uploading to Supabase, check the browser console for errors
- If migration fails, the script can be re-run (it skips already migrated items)
- For permission issues, verify your Supabase service key has the necessary privileges

## Reverting

The application maintains backward compatibility with local storage. If needed, you can continue using the local database and file system by not setting Supabase environment variables.
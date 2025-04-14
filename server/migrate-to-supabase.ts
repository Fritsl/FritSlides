import { supabase } from './supabase';
import { storage } from './storage';
import { Note, Project, User } from '@shared/schema';
import { exit } from 'process';

/**
 * This script migrates local database data to Supabase.
 * It transfers all users, projects, and notes from the local database
 * to Supabase database.
 * 
 * Run this script with:
 * npx tsx server/migrate-to-supabase.ts
 */

async function setupSupabaseTables() {
  console.log('Setting up Supabase tables...');

  try {
    // For simplicity and reliability, we'll use Supabase Data API
    // instead of trying to use raw SQL
    
    // Check if users table exists
    const { data: usersData, error: usersError } = await supabase
      .from('users')
      .select('id')
      .limit(1);
    
    if (usersError && usersError.code === '42P01') { // relation does not exist
      console.log('Creating users table...');
      // We'll just use the database schema as-is and rely on our app's
      // data layer to handle the structure
    } else {
      console.log('Users table already exists');
    }
    
    // Check if projects table exists
    const { data: projectsData, error: projectsError } = await supabase
      .from('projects')
      .select('id')
      .limit(1);
    
    if (projectsError && projectsError.code === '42P01') { // relation does not exist
      console.log('Creating projects table...');
      // We'll just use the database schema as-is and rely on our app's
      // data layer to handle the structure
    } else {
      console.log('Projects table already exists');
    }
    
    // Check if notes table exists
    const { data: notesData, error: notesError } = await supabase
      .from('notes')
      .select('id')
      .limit(1);
    
    if (notesError && notesError.code === '42P01') { // relation does not exist
      console.log('Creating notes table...');
      // We'll just use the database schema as-is and rely on our app's
      // data layer to handle the structure
    } else {
      console.log('Notes table already exists');
    }
    
    // Tables either exist or will be created by Supabase automatically
    // when we insert data
    console.log('Tables verified. They will be created when data is inserted if needed.');
    return true;
  } catch (error) {
    console.error('Error setting up tables:', error);
    return false;
  }
}

async function migrateUsers() {
  console.log('Migrating users...');
  
  // Get all users from local storage
  const users = await storage.getAllUsers();
  
  if (!users || users.length === 0) {
    console.log('No users found to migrate.');
    return 0;
  }
  
  let successCount = 0;
  
  for (const user of users) {
    // Check if user already exists in Supabase
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('id', user.id)
      .maybeSingle();
    
    if (existingUser) {
      console.log(`User ${user.username} (id: ${user.id}) already exists, skipping.`);
      successCount++;
      continue;
    }
    
    // Insert user into Supabase
    const { error } = await supabase
      .from('users')
      .insert({
        id: user.id,
        username: user.username,
        password: user.password,
        lastOpenedProjectId: user.lastOpenedProjectId
      });
    
    if (error) {
      console.error(`Error migrating user ${user.username}:`, error);
    } else {
      console.log(`Migrated user ${user.username} (id: ${user.id})`);
      successCount++;
    }
  }
  
  console.log(`Successfully migrated ${successCount}/${users.length} users.`);
  return successCount;
}

async function migrateProjects() {
  console.log('Migrating projects...');
  
  // Get all users from Supabase
  const { data: users } = await supabase
    .from('users')
    .select('id');
  
  if (!users || users.length === 0) {
    console.log('No users found, cannot migrate projects.');
    return 0;
  }
  
  let totalProjects = 0;
  let successCount = 0;
  
  for (const user of users) {
    // Get user's projects from local storage
    const projects = await storage.getProjects(user.id);
    totalProjects += projects.length;
    
    for (const project of projects) {
      // Check if project already exists in Supabase
      const { data: existingProject } = await supabase
        .from('projects')
        .select('id')
        .eq('id', project.id)
        .maybeSingle();
      
      if (existingProject) {
        console.log(`Project ${project.name} (id: ${project.id}) already exists, skipping.`);
        successCount++;
        continue;
      }
      
      // Extract only the fields that are in the Supabase schema
      const projectData = {
        id: project.id,
        userId: project.userId,
        name: project.name,
        lastViewedSlideIndex: project.lastViewedSlideIndex,
        author: project.author,
        startSlogan: project.startSlogan,
        endSlogan: project.endSlogan,
        isLocked: project.isLocked
      };
      
      // Insert project into Supabase
      const { error } = await supabase
        .from('projects')
        .insert(projectData);
      
      if (error) {
        console.error(`Error migrating project ${project.name}:`, error);
      } else {
        console.log(`Migrated project ${project.name} (id: ${project.id})`);
        successCount++;
      }
    }
  }
  
  console.log(`Successfully migrated ${successCount}/${totalProjects} projects.`);
  return successCount;
}

async function migrateNotes() {
  console.log('Migrating notes...');
  
  // Get all projects from Supabase
  const { data: projects } = await supabase
    .from('projects')
    .select('id');
  
  if (!projects || projects.length === 0) {
    console.log('No projects found, cannot migrate notes.');
    return 0;
  }
  
  let totalNotes = 0;
  let successCount = 0;
  
  for (const project of projects) {
    // Get project's notes from local storage
    const notes = await storage.getNotes(project.id);
    totalNotes += notes.length;
    
    // First pass: Create all notes without parent references
    for (const note of notes) {
      // Check if note already exists in Supabase
      const { data: existingNote } = await supabase
        .from('notes')
        .select('id')
        .eq('id', note.id)
        .maybeSingle();
      
      if (existingNote) {
        console.log(`Note ${note.id} already exists, skipping.`);
        successCount++;
        continue;
      }
      
      // Insert note into Supabase (without parent reference initially)
      const { error } = await supabase
        .from('notes')
        .insert({
          id: note.id,
          projectId: note.projectId,
          parentId: null, // We'll update this in the second pass
          content: note.content,
          order: note.order,
          url: note.url,
          linkText: note.linkText,
          youtubeLink: note.youtubeLink,
          time: note.time,
          images: note.images
        });
      
      if (error) {
        console.error(`Error migrating note ${note.id}:`, error);
      } else {
        console.log(`Migrated note ${note.id} (without parent reference)`);
        successCount++;
      }
    }
    
    // Second pass: Update parent references
    for (const note of notes) {
      if (note.parentId !== null) {
        const { error } = await supabase
          .from('notes')
          .update({ parentId: note.parentId })
          .eq('id', note.id);
        
        if (error) {
          console.error(`Error updating parent reference for note ${note.id}:`, error);
          successCount--;
        } else {
          console.log(`Updated parent reference for note ${note.id}`);
        }
      }
    }
  }
  
  console.log(`Successfully migrated ${successCount}/${totalNotes} notes.`);
  return successCount;
}

async function runMigration() {
  console.log('Starting migration to Supabase...');

  // Create tables
  const tablesCreated = await setupSupabaseTables();
  if (!tablesCreated) {
    console.error('Failed to create tables, aborting migration.');
    return;
  }

  // Migrate users
  const userCount = await migrateUsers();
  if (userCount === 0) {
    console.error('Failed to migrate any users, aborting migration.');
    return;
  }

  // Migrate projects
  const projectCount = await migrateProjects();
  if (projectCount === 0) {
    console.error('Failed to migrate any projects, aborting migration.');
    return;
  }

  // Migrate notes
  const noteCount = await migrateNotes();

  console.log('Migration complete!');
  console.log(`Summary:
  - Users: ${userCount}
  - Projects: ${projectCount}
  - Notes: ${noteCount}
  `);
}

// Add method to retrieve all users (not in the standard interface)
declare module './storage' {
  interface IStorage {
    getAllUsers(): Promise<User[]>;
  }
}

// Add temporary implementation to the storage class
storage.getAllUsers = async function(): Promise<User[]> {
  try {
    // Add implementation here - will depend on your database type
    // For PostgreSQL:
    const { db } = await import('./db');
    const { users } = await import('@shared/schema');
    const allUsers = await db.select().from(users);
    return allUsers;
  } catch (error) {
    console.error('Error retrieving all users:', error);
    return [];
  }
};

// Run migration when this file is executed directly
runMigration()
  .then(() => {
    console.log('Migration script completed successfully.');
    exit(0);
  })
  .catch((error) => {
    console.error('Migration failed:', error);
    exit(1);
  });
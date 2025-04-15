-- Drop existing tables if they exist
DROP TABLE IF EXISTS notes;
DROP TABLE IF EXISTS projects;
DROP TABLE IF EXISTS users;

-- Create users table with UUID support for Supabase
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password TEXT,
  lastOpenedProjectId INTEGER
);

-- Create projects table
CREATE TABLE projects (
  id SERIAL PRIMARY KEY,
  userId TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  startSlogan TEXT,
  endSlogan TEXT,
  author TEXT,
  lastViewedSlideIndex INTEGER DEFAULT 0,
  isLocked BOOLEAN DEFAULT FALSE NOT NULL,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Create notes table
CREATE TABLE notes (
  id SERIAL PRIMARY KEY,
  projectId INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  parentId INTEGER REFERENCES notes(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  url TEXT,
  linkText TEXT,
  youtubeLink TEXT,
  time TEXT,
  isDiscussion BOOLEAN DEFAULT FALSE,
  images TEXT[] DEFAULT '{}',
  "order" NUMERIC DEFAULT 0,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Create indexes for better performance
CREATE INDEX idx_projects_userid ON projects(userId);
CREATE INDEX idx_notes_projectid ON notes(projectId);
CREATE INDEX idx_notes_parentid ON notes(parentId);
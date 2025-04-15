-- Update the users table to use text for the ID field to support Supabase UUIDs
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_pkey CASCADE;
ALTER TABLE users ALTER COLUMN id TYPE TEXT;
ALTER TABLE users ADD PRIMARY KEY (id);

-- Update the projects table to use text for the userId field to support Supabase UUIDs
ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_userId_fkey;
ALTER TABLE projects ALTER COLUMN "userId" TYPE TEXT;
ALTER TABLE projects ADD CONSTRAINT projects_userId_fkey FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE CASCADE;

-- Ensure all camelCase column names are used consistently
-- projects table
ALTER TABLE projects RENAME COLUMN userid TO "userId" WHERE EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'projects' AND column_name = 'userid');
ALTER TABLE projects RENAME COLUMN startslogan TO "startSlogan" WHERE EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'projects' AND column_name = 'startslogan');
ALTER TABLE projects RENAME COLUMN endslogan TO "endSlogan" WHERE EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'projects' AND column_name = 'endslogan');
ALTER TABLE projects RENAME COLUMN lastviewedslideindex TO "lastViewedSlideIndex" WHERE EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'projects' AND column_name = 'lastviewedslideindex');
ALTER TABLE projects RENAME COLUMN islocked TO "isLocked" WHERE EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'projects' AND column_name = 'islocked');
ALTER TABLE projects RENAME COLUMN createdat TO "createdAt" WHERE EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'projects' AND column_name = 'createdat');

-- notes table
ALTER TABLE notes RENAME COLUMN projectid TO "projectId" WHERE EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notes' AND column_name = 'projectid');
ALTER TABLE notes RENAME COLUMN parentid TO "parentId" WHERE EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notes' AND column_name = 'parentid');
ALTER TABLE notes RENAME COLUMN linktext TO "linkText" WHERE EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notes' AND column_name = 'linktext');
ALTER TABLE notes RENAME COLUMN youtubelink TO "youtubeLink" WHERE EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notes' AND column_name = 'youtubelink');
ALTER TABLE notes RENAME COLUMN isdiscussion TO "isDiscussion" WHERE EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notes' AND column_name = 'isdiscussion');
ALTER TABLE notes RENAME COLUMN createdat TO "createdAt" WHERE EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notes' AND column_name = 'createdat');
ALTER TABLE notes RENAME COLUMN updatedat TO "updatedAt" WHERE EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notes' AND column_name = 'updatedat');

-- users table
ALTER TABLE users RENAME COLUMN lastopenedprojectid TO "lastOpenedProjectId" WHERE EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'lastopenedprojectid');
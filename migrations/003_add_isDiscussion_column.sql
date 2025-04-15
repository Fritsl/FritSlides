-- Add the isDiscussion column to the notes table in Supabase
ALTER TABLE notes ADD COLUMN "isDiscussion" BOOLEAN DEFAULT FALSE;
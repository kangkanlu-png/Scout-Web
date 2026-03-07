-- Add status column to activities
ALTER TABLE activities ADD COLUMN activity_status TEXT DEFAULT 'active';

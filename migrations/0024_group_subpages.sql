CREATE TABLE IF NOT EXISTS group_subpages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  group_id INTEGER NOT NULL,
  label TEXT NOT NULL,
  path TEXT NOT NULL,
  icon TEXT DEFAULT '📄',
  is_active INTEGER DEFAULT 1,
  display_order INTEGER DEFAULT 0,
  is_custom INTEGER DEFAULT 0,
  custom_link TEXT,
  FOREIGN KEY (group_id) REFERENCES scout_groups(id) ON DELETE CASCADE
);

-- Insert default subpages based on existing code logic
-- We will write a Node.js script to run the D1 execute since doing it in raw SQL with dynamically fetching group IDs might be tricky.
-- But wait, we can just insert them via the app when missing, or write an initialization script.

-- 分組子頁面（學期/相片集）
-- 對應原網站 童軍團 > 113-1 / 112-2 / 112-1 這種階層

CREATE TABLE IF NOT EXISTS group_semesters (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  group_id INTEGER NOT NULL,
  semester TEXT NOT NULL,          -- 如 '113-1', '112-2', '112-1'
  title TEXT,                      -- 標題（選填，如「113學年度第1學期」）
  description TEXT,
  cover_image TEXT,                -- 封面圖
  display_order INTEGER DEFAULT 0,
  is_published INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (group_id) REFERENCES scout_groups(id) ON DELETE CASCADE
);

-- 學期相片
CREATE TABLE IF NOT EXISTS semester_images (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  semester_id INTEGER NOT NULL,
  image_url TEXT NOT NULL,
  caption TEXT,
  display_order INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (semester_id) REFERENCES group_semesters(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_group_semesters_group ON group_semesters(group_id);
CREATE INDEX IF NOT EXISTS idx_semester_images_sem ON semester_images(semester_id);

-- 榮譽小隊記錄表
-- 每次出席後可評選出榮譽小隊，並可同步公告到榮譽榜

CREATE TABLE IF NOT EXISTS honor_patrol_records (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,           -- 對應的出席場次
  patrol_name TEXT NOT NULL,          -- 小隊名稱（例：鷹隊）
  section TEXT NOT NULL,              -- junior/senior/rover/all
  reason TEXT,                        -- 得獎理由
  year_label TEXT,                    -- 學年度標籤（例：114）
  announced BOOLEAN NOT NULL DEFAULT 0,  -- 是否已同步公告到榮譽榜
  announced_at DATETIME,              -- 公告時間
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (session_id) REFERENCES attendance_sessions(id)
);

-- 出席場次新增「已送出」狀態欄位
ALTER TABLE attendance_sessions ADD COLUMN submitted INTEGER NOT NULL DEFAULT 0;
ALTER TABLE attendance_sessions ADD COLUMN submitted_at DATETIME;

CREATE INDEX IF NOT EXISTS idx_honor_patrol_session ON honor_patrol_records(session_id);
CREATE INDEX IF NOT EXISTS idx_honor_patrol_section ON honor_patrol_records(section);

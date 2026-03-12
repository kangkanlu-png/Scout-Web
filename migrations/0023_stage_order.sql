-- 為 advancement_requirements 新增 stage_order 欄位
-- 用來儲存階段（rank_to）的顯示順序，獨立於標準項目的 display_order
ALTER TABLE advancement_requirements ADD COLUMN stage_order INTEGER DEFAULT 999;

-- 為現有資料依 section + version_year + rank_from 字母順序初始化 stage_order
-- 使用 rowid 技巧對每個 stage group 設定初始順序
CREATE INDEX IF NOT EXISTS idx_adv_req_stage ON advancement_requirements(section, version_year, stage_order);

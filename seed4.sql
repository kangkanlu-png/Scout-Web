-- 樣本幹部資料（童軍團）
INSERT OR IGNORE INTO group_cadres (group_id, year_label, role, chinese_name, display_order, is_current) VALUES
(1, '115', '童軍團長', '（請後台填入）', 1, 1),
(1, '115', '副團長', '（請後台填入）', 2, 1),
(1, '115', '行政長', '（請後台填入）', 3, 1),
(1, '115', '器材長', '（請後台填入）', 4, 1);

-- 樣本幹部資料（行義童軍團）
INSERT OR IGNORE INTO group_cadres (group_id, year_label, role, chinese_name, display_order, is_current) VALUES
(2, '115', '行義團長', '（請後台填入）', 1, 1),
(2, '115', '副團長', '（請後台填入）', 2, 1),
(2, '115', '行政長', '（請後台填入）', 3, 1),
(2, '115', '器材長', '（請後台填入）', 4, 1);

-- 組織架構說明
INSERT OR IGNORE INTO group_org_chart (group_id, content) VALUES
(1, '<p>童軍團組織架構說明，請由後台編輯更新。</p>'),
(2, '<p>行義童軍團組織架構說明，請由後台編輯更新。</p>'),
(3, '<p>羅浮童軍群組織架構說明，請由後台編輯更新。</p>');

-- 初始種子資料

-- 管理員帳號 (預設密碼: admin123, 已用 SHA-256 hash)
INSERT OR IGNORE INTO admins (username, password_hash) VALUES 
  ('admin', '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9');

-- 網站設定
INSERT OR IGNORE INTO site_settings (key, value, description) VALUES
  ('site_title', 'KCISLK 林口康橋圓桌武士童軍團', '網站標題'),
  ('site_subtitle', 'KCISLK Excalibur Knights Scout Groups', '網站副標題'),
  ('about_text_zh', '我們是2019年成立於林口康橋國際學校的複式童軍團。童軍團以「新北市第54團」的名稱登記，因此以諧音「武士」為名，取名「林口康橋圓桌武士複式童軍團」。我們的目標是讓成員凝聚精神，熱心助人。', '關於我們（中文）'),
  ('about_text_en', 'We are a compound Scout troop established in 2019 at Kang Chiao International School in Linkou. The troop was registered under the name "Troop 54, New Taipei City." Hence, we adopted the homophonic name "Samurai" Scouts and our troop is named "Linkou Kang Chiao Round Table Samurai Compound Scout Troop." Our aim is for members to unite in spirit and enthusiastically assist others.', '關於我們（英文）'),
  ('facebook_url', 'https://www.facebook.com/KCISLKSCOUTS', 'Facebook 連結'),
  ('contact_email', '', '聯絡信箱');

-- 童軍分組
INSERT OR IGNORE INTO scout_groups (name, name_en, grade_range, description, description_en, display_order) VALUES
  ('童軍團', 'Scout Troop', 'G7-G8', '國中七、八年級童軍', 'Scout Troop for Grade 7-8 students', 1),
  ('深資童軍團', 'Senior Scout Troop', 'G9-G12', '國中九年級至高中童軍', 'Senior Scout Troop for Grade 9-12 students', 2),
  ('羅浮童軍群', 'Rover Scout Crew', '大學/成人', '大學及成人羅浮童軍', 'Rover Scout Crew for university students and adults', 3);

-- 示範活動資料
INSERT OR IGNORE INTO activities (title, title_en, description, description_en, activity_date, date_display, category, youtube_url, display_order, is_published) VALUES
  ('第12屆全國童軍大露營', '12th National Scout Jamboree', '2025年6月30日至7月2日，林口康橋童軍團參加第12屆全國童軍大露營，與來自全國各地的童軍共同參與精彩活動。', 'June 30 - July 2, 2025. KCISLK Scout Troop participated in the 12th National Scout Jamboree.', '2025-06-30', '2025年6月30日 - 7月2日', 'camping', NULL, 1, 1),
  ('第11屆全國童軍大露營', '11th National Scout Jamboree', '2025年6月30日至7月2日，參加2024年全國童軍大露營活動。', 'June 30 - July 2, 2025. Participated in the 2024 National Scout Jamboree.', '2024-06-30', '2024年6月30日 - 7月2日', 'camping', NULL, 2, 1),
  ('第10屆全國童軍大露營', '10th National Scout Jamboree', '2025年1月20日至1月22日舉辦的全國童軍大露營活動。', 'January 20-22, 2025. National Scout Jamboree.', '2025-01-20', '2025年1月20日 - 1月22日', 'camping', NULL, 3, 1),
  ('TECC 急救訓練 2026', 'TECC Training 2026', 'C-TECC、STOP THE BLEED、TECC-LEO/FR、STOP THE BLEED 急救課程訓練，2026年2月22日舉辦。', 'C-TECC, STOP THE BLEED, TECC-LEO/FR training courses, held on February 22, 2026.', '2026-02-22', '2026年2月22日', 'tecc', NULL, 4, 1),
  ('2025 TECC 急救訓練', '2025 TECC Training', 'C-TECC、STOP THE BLEED、TECC-LEO/FR 急救課程，2025年2月7日舉辦。', 'TECC training courses held on February 7, 2025.', '2025-02-07', '2025年2月7日', 'tecc', 'Odi8piH1PHE', 5, 1);

-- 示範圖片資料（使用佔位圖）
INSERT OR IGNORE INTO activity_images (activity_id, image_url, caption, display_order) VALUES
  (1, '/static/placeholder.jpg', '第12屆全國童軍大露營活動照片', 1),
  (2, '/static/placeholder.jpg', '第11屆全國童軍大露營活動照片', 1),
  (3, '/static/placeholder.jpg', '第10屆全國童軍大露營活動照片', 1);

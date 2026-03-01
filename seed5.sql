-- seed5.sql：精彩回顧活動相冊資料（對應原 Google Sites 精彩回顧頁）
-- 更新現有活動或插入精彩回顧相冊

-- 插入 6 個精彩回顧相冊（若不存在則新增）
INSERT OR IGNORE INTO activities (id, title, title_en, description, category, activity_type, activity_date, date_display, display_order, is_published, show_in_highlights, cover_image) VALUES
(10, '歷屆團慶活動', 'Annual Troop Anniversary', '林口康橋童軍團歷年團慶活動精彩回顧，凝聚團隊情感、展現童軍精神。', 'general', 'highlight', '2024-01-01', '歷年回顧', 10, 1, 1,
 'https://images.unsplash.com/photo-1511632765486-a01980e01a18?w=600&h=400&fit=crop&auto=format'),
(11, '歷屆考驗營活動', 'Annual Challenge Camp', '歷屆考驗營活動紀錄，展現童軍挑戰自我、突破極限的精神。', 'camping', 'highlight', '2024-01-01', '歷年回顧', 11, 1, 1,
 'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=600&h=400&fit=crop&auto=format'),
(12, '歷年國慶大典服務', 'National Day Ceremony Service', '每年國慶大典童軍服務團表現，展現公益精神與服務熱忱。', 'service', 'highlight', '2024-10-10', '歷年回顧', 12, 1, 1,
 'https://images.unsplash.com/photo-1587271407850-8d438ca9fdf2?w=600&h=400&fit=crop&auto=format'),
(13, '世界童軍大露營', 'World Scout Jamboree', '參與世界童軍大露營的珍貴紀錄，與來自全球的童軍交流，體驗多元文化。', 'camping', 'highlight', '2023-08-01', '歷年回顧', 13, 1, 1,
 'https://images.unsplash.com/photo-1478827387698-1527781a4887?w=600&h=400&fit=crop&auto=format'),
(14, '全國高中行義童軍大露營', 'National Senior Scout Jamboree', '全國高中行義童軍大露營活動紀錄，與全台行義童軍共同體驗戶外冒險。', 'camping', 'highlight', '2023-07-01', '歷年回顧', 14, 1, 1,
 'https://images.unsplash.com/photo-1445308394109-4ec2920981b1?w=600&h=400&fit=crop&auto=format'),
(15, '全國童軍大露營', 'National Scout Jamboree', '參與全國童軍大露營活動精彩回顧，挑戰自然、磨練意志、結交好友。', 'camping', 'highlight', '2025-06-30', '歷年回顧', 15, 1, 1,
 'https://images.unsplash.com/photo-1532339142463-fd0a8979791a?w=600&h=400&fit=crop&auto=format');

-- 為這些活動添加示範圖片
INSERT OR IGNORE INTO activity_images (activity_id, image_url, caption, display_order) VALUES
-- 歷屆團慶活動
(10, 'https://images.unsplash.com/photo-1511632765486-a01980e01a18?w=800&h=600&fit=crop', '全體團員合影', 1),
(10, 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=800&h=600&fit=crop', '頒獎典禮', 2),
(10, 'https://images.unsplash.com/photo-1517457373958-b7bdd4587205?w=800&h=600&fit=crop', '童軍表演', 3),

-- 歷屆考驗營活動
(11, 'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=800&h=600&fit=crop', '野外求生訓練', 1),
(11, 'https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?w=800&h=600&fit=crop', '繩索挑戰', 2),
(11, 'https://images.unsplash.com/photo-1501854140801-50d01698950b?w=800&h=600&fit=crop', '夜間定向', 3),
(11, 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800&h=600&fit=crop', '攀岩訓練', 4),

-- 歷年國慶大典服務
(12, 'https://images.unsplash.com/photo-1587271407850-8d438ca9fdf2?w=800&h=600&fit=crop', '國慶典禮服務', 1),
(12, 'https://images.unsplash.com/photo-1546484396-fb3fc6f95f98?w=800&h=600&fit=crop', '旗手隊列', 2),
(12, 'https://images.unsplash.com/photo-1514513255262-d08e468db1ff?w=800&h=600&fit=crop', '交通引導服務', 3),

-- 世界童軍大露營
(13, 'https://images.unsplash.com/photo-1478827387698-1527781a4887?w=800&h=600&fit=crop', '世界大露營開幕式', 1),
(13, 'https://images.unsplash.com/photo-1517984053584-f3c9f95e8c98?w=800&h=600&fit=crop', '各國童軍交流', 2),
(13, 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=800&h=600&fit=crop', '文化展覽', 3),
(13, 'https://images.unsplash.com/photo-1464747736614-2f41b173dfec?w=800&h=600&fit=crop', '野外活動', 4),

-- 全國高中行義童軍大露營
(14, 'https://images.unsplash.com/photo-1445308394109-4ec2920981b1?w=800&h=600&fit=crop', '行義童軍大合照', 1),
(14, 'https://images.unsplash.com/photo-1531761535209-180857e963b9?w=800&h=600&fit=crop', '技能競賽', 2),
(14, 'https://images.unsplash.com/photo-1600880292203-757bb62b4baf?w=800&h=600&fit=crop', '營地生活', 3),

-- 全國童軍大露營
(15, 'https://images.unsplash.com/photo-1532339142463-fd0a8979791a?w=800&h=600&fit=crop', '全國童軍大露營', 1),
(15, 'https://images.unsplash.com/photo-1563299796-17596ed6b017?w=800&h=600&fit=crop', '童軍技能展示', 2),
(15, 'https://images.unsplash.com/photo-1541534401786-2077eed87a74?w=800&h=600&fit=crop', '夜間聯歡晚會', 3),
(15, 'https://images.unsplash.com/photo-1516728778615-2d590ea1855e?w=800&h=600&fit=crop', '閉幕典禮', 4);

-- 更新現有活動的 show_in_highlights（全國大露營活動也顯示在精彩回顧）
UPDATE activities SET show_in_highlights = 1, activity_type = 'highlight'
WHERE id IN (1, 2, 3) AND category = 'camping';

import { Hono } from 'hono'

type Bindings = {
  DB: D1Database
}

export const apiRoutes = new Hono<{ Bindings: Bindings }>()

async function sha256(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message)
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}


// ==================== 活動 API ====================

// 取得所有活動（含圖片）
apiRoutes.get('/activities', async (c) => {
  const db = c.env.DB
  const category = c.req.query('category')
  let query = `
    SELECT a.*, GROUP_CONCAT(ai.image_url ORDER BY ai.display_order) as images
    FROM activities a
    LEFT JOIN activity_images ai ON ai.activity_id = a.id
    WHERE a.is_published = 1
  `
  const params: any[] = []
  if (category) {
    query += ` AND a.category = ?`
    params.push(category)
  }
  query += ` GROUP BY a.id ORDER BY a.display_order ASC, a.activity_date DESC`

  const result = await db.prepare(query).bind(...params).all()
  return c.json({ success: true, data: result.results })
})

// 取得單一活動
apiRoutes.get('/activities/:id', async (c) => {
  const db = c.env.DB
  const id = c.req.param('id')
  const activity = await db.prepare(`SELECT * FROM activities WHERE id = ?`).bind(id).first()
  if (!activity) return c.json({ success: false, error: 'Not found' }, 404)
  const images = await db.prepare(`SELECT * FROM activity_images WHERE activity_id = ? ORDER BY display_order`).bind(id).all()
  return c.json({ success: true, data: { ...activity, images: images.results } })
})

// 新增活動
apiRoutes.post('/activities', async (c) => {
  const db = c.env.DB
  const body = await c.req.json()
  const { 
    title, title_en, description, description_en, activity_date, date_display, category, 
    youtube_url, display_order, is_published, cover_image, show_in_highlights, activity_type,
    location, cost, content, registration_start, registration_end, max_participants, is_registration_open, activity_end_date
  } = body
  if (!title) return c.json({ success: false, error: '標題為必填' }, 400)

  const result = await db.prepare(`
    INSERT INTO activities (
      title, title_en, description, description_en, activity_date, date_display, category, 
      youtube_url, display_order, is_published, cover_image, show_in_highlights, activity_type,
      location, cost, content, registration_start, registration_end, max_participants, is_registration_open, activity_end_date
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    title, title_en || null, description || null, description_en || null,
    activity_date || null, date_display || null,
    category || 'general', youtube_url || null,
    display_order || 0, is_published !== undefined ? is_published : 1,
    cover_image || null, show_in_highlights ? 1 : 0, activity_type || 'general',
    location || null, cost || null, content || null, 
    registration_start || null, registration_end || null, 
    max_participants || null, is_registration_open ? 1 : 0, activity_end_date || null
  ).run()

  return c.json({ success: true, id: result.meta.last_row_id })
})

// 更新活動
apiRoutes.put('/activities/:id', async (c) => {
  const db = c.env.DB
  const id = c.req.param('id')
  const body = await c.req.json()
  const { 
    title, title_en, description, description_en, activity_date, date_display, category, 
    youtube_url, display_order, is_published, cover_image, show_in_highlights, activity_type,
    location, cost, content, registration_start, registration_end, max_participants, is_registration_open, activity_end_date
  } = body

  await db.prepare(`
    UPDATE activities SET
      title = ?, title_en = ?, description = ?, description_en = ?,
      activity_date = ?, date_display = ?, category = ?, youtube_url = ?,
      display_order = ?, is_published = ?, cover_image = ?, show_in_highlights = ?, activity_type = ?,
      location = ?, cost = ?, content = ?, registration_start = ?, registration_end = ?, 
      max_participants = ?, is_registration_open = ?, activity_end_date = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).bind(
    title, title_en || null, description || null, description_en || null,
    activity_date || null, date_display || null,
    category || 'general', youtube_url || null,
    display_order || 0, is_published !== undefined ? is_published : 1,
    cover_image || null, show_in_highlights ? 1 : 0, activity_type || 'general',
    location || null, cost || null, content || null, 
    registration_start || null, registration_end || null, 
    max_participants || null, is_registration_open ? 1 : 0, activity_end_date || null,
    id
  ).run()

  return c.json({ success: true })
})


// 結案並移至精彩活動
apiRoutes.post('/admin/activities/:id/close-and-highlight', async (c) => {
  const db = c.env.DB
  const id = c.req.param('id')
  await db.prepare(`
    UPDATE activities SET show_in_highlights = 1, is_registration_open = 0, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).bind(id).run()
  return c.json({ success: true })
})

// 刪除活動
apiRoutes.delete('/activities/:id', async (c) => {
  const db = c.env.DB
  const id = c.req.param('id')
  await db.prepare(`DELETE FROM activities WHERE id = ?`).bind(id).run()
  return c.json({ success: true })
})

// ==================== 活動報名 API ====================

// 取得某活動的報名名單 (管理員用)
apiRoutes.get('/activities/:id/registrations', async (c) => {
  const db = c.env.DB
  const id = c.req.param('id')
  const status = c.req.query('status')
  
  let query = `
    SELECT ar.*, m.chinese_name, m.english_name, m.section, m.unit_name, m.phone, m.email
    FROM activity_registrations ar
    JOIN members m ON m.id = ar.member_id
    WHERE ar.activity_id = ?
  `
  const params: any[] = [id]
  
  if (status) {
    query += ` AND ar.status = ?`
    params.push(status)
  }
  
  query += ` ORDER BY ar.created_at DESC`
  
  const result = await db.prepare(query).bind(...params).all()
  return c.json({ success: true, data: result.results })
})

// 報名活動 (會員用)
apiRoutes.post('/activities/:id/register', async (c) => {
  const db = c.env.DB
  const activityId = c.req.param('id')
  const memberId = await getMemberIdFromCookie(c)
  if (!memberId) return c.json({ success: false, error: '未登入' }, 401)
  
  const body = await c.req.json()
  const { user_notes, registration_data } = body
  
  // 檢查活動是否存在且開放報名
  const activity = await db.prepare(`SELECT * FROM activities WHERE id = ?`).bind(activityId).first() as any
  if (!activity) return c.json({ success: false, error: '找不到活動' }, 404)
  if (!activity.is_registration_open) return c.json({ success: false, error: '此活動未開放報名' }, 400)
  
  // 檢查是否已報名
  const existing = await db.prepare(`SELECT id FROM activity_registrations WHERE activity_id = ? AND member_id = ?`).bind(activityId, memberId).first()
  if (existing) return c.json({ success: false, error: '您已報名此活動' }, 409)
  
  // 檢查名額 (若有設定)
  if (activity.max_participants) {
    const count = await db.prepare(`SELECT COUNT(*) as cnt FROM activity_registrations WHERE activity_id = ? AND status IN ('pending', 'approved')`).bind(activityId).first() as any
    if (count.cnt >= activity.max_participants) {
      return c.json({ success: false, error: '名額已滿' }, 400)
    }
  }
  
  await db.prepare(`
    INSERT INTO activity_registrations (activity_id, member_id, status, user_notes, registration_data)
    VALUES (?, ?, 'pending', ?, ?)
  `).bind(activityId, memberId, user_notes || null, registration_data ? JSON.stringify(registration_data) : null).run()
  
  return c.json({ success: true })
})

// 審核報名 (管理員用)
apiRoutes.put('/registrations/:id', async (c) => {
  const db = c.env.DB
  const id = c.req.param('id')
  const body = await c.req.json()
  const { status, admin_notes } = body
  
  if (!['pending', 'approved', 'rejected', 'cancelled', 'waiting'].includes(status)) {
    return c.json({ success: false, error: '無效的狀態' }, 400)
  }
  
  await db.prepare(`
    UPDATE activity_registrations 
    SET status = ?, admin_notes = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).bind(status, admin_notes || null, id).run()
  
  return c.json({ success: true })
})

// 取得我的報名紀錄 (會員用)
apiRoutes.get('/registrations/my', async (c) => {
  const db = c.env.DB
  const memberId = await getMemberIdFromCookie(c)
  if (!memberId) return c.json({ success: false, error: '未登入' }, 401)
  
  const result = await db.prepare(`
    SELECT ar.*, a.title as activity_title, a.activity_date, a.activity_end_date, a.date_display, a.location
    FROM activity_registrations ar
    JOIN activities a ON a.id = ar.activity_id
    WHERE ar.member_id = ?
    ORDER BY ar.created_at DESC
  `).bind(memberId).all()
  
  return c.json({ success: true, data: result.results })
})

// ==================== 活動圖片 API ====================

// 取得活動的圖片
apiRoutes.get('/activities/:id/images', async (c) => {
  const db = c.env.DB
  const id = c.req.param('id')
  const images = await db.prepare(`SELECT * FROM activity_images WHERE activity_id = ? ORDER BY display_order`).bind(id).all()
  return c.json({ success: true, data: images.results })
})

// 新增活動圖片
apiRoutes.post('/activities/:id/images', async (c) => {
  const db = c.env.DB
  const activityId = c.req.param('id')
  const body = await c.req.json()
  const { image_url, caption, display_order } = body
  if (!image_url) return c.json({ success: false, error: '圖片網址為必填' }, 400)

  const result = await db.prepare(`
    INSERT INTO activity_images (activity_id, image_url, caption, display_order)
    VALUES (?, ?, ?, ?)
  `).bind(activityId, image_url, caption || null, display_order || 0).run()

  return c.json({ success: true, id: result.meta.last_row_id })
})

// 刪除活動圖片
apiRoutes.delete('/images/:id', async (c) => {
  const db = c.env.DB
  const id = c.req.param('id')
  await db.prepare(`DELETE FROM activity_images WHERE id = ?`).bind(id).run()
  return c.json({ success: true })
})

// ==================== 童軍分組 API ====================

apiRoutes.get('/groups', async (c) => {
  const db = c.env.DB
  const result = await db.prepare(`SELECT * FROM scout_groups WHERE is_active = 1 ORDER BY display_order`).all()
  return c.json({ success: true, data: result.results })
})

apiRoutes.post('/groups', async (c) => {
  const db = c.env.DB
  const body = await c.req.json()
  const { name, name_en, slug, grade_range, description, description_en, display_order } = body
  if (!name) return c.json({ success: false, error: '名稱為必填' }, 400)
  const result = await db.prepare(`
    INSERT INTO scout_groups (name, name_en, slug, grade_range, description, description_en, display_order)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(name, name_en || null, slug || null, grade_range || null, description || null, description_en || null, display_order || 0).run()
  return c.json({ success: true, id: result.meta.last_row_id })
})

apiRoutes.put('/groups/:id', async (c) => {
  const db = c.env.DB
  const id = c.req.param('id')
  const body = await c.req.json()
  const { name, name_en, slug, grade_range, description, description_en, display_order, is_active } = body
  await db.prepare(`
    UPDATE scout_groups SET name=?, name_en=?, slug=?, grade_range=?, description=?, description_en=?, display_order=?, is_active=?
    WHERE id = ?
  `).bind(name, name_en || null, slug || null, grade_range || null, description || null, description_en || null, display_order || 0, is_active !== undefined ? is_active : 1, id).run()
  return c.json({ success: true })
})

apiRoutes.delete('/groups/:id', async (c) => {
  const db = c.env.DB
  const id = c.req.param('id')
  await db.prepare(`DELETE FROM scout_groups WHERE id = ?`).bind(id).run()
  return c.json({ success: true })
})

// ==================== 公告 API ====================

apiRoutes.get('/announcements', async (c) => {
  const db = c.env.DB
  const result = await db.prepare(`SELECT * FROM announcements WHERE is_active = 1 ORDER BY created_at DESC`).all()
  return c.json({ success: true, data: result.results })
})

apiRoutes.post('/announcements', async (c) => {
  const db = c.env.DB
  const body = await c.req.json()
  const { title, content, link_url, is_active } = body
  if (!title) return c.json({ success: false, error: '標題為必填' }, 400)
  const result = await db.prepare(`INSERT INTO announcements (title, content, link_url, is_active) VALUES (?, ?, ?, ?)`).bind(title, content || null, link_url || null, is_active !== undefined ? is_active : 1).run()
  return c.json({ success: true, id: result.meta.last_row_id })
})

apiRoutes.put('/announcements/:id', async (c) => {
  const db = c.env.DB
  const id = c.req.param('id')
  const body = await c.req.json()
  const { title, content, link_url, is_active } = body
  await db.prepare(`UPDATE announcements SET title=?, content=?, link_url=?, is_active=? WHERE id=?`).bind(title, content || null, link_url || null, is_active !== undefined ? is_active : 1, id).run()
  return c.json({ success: true })
})

apiRoutes.delete('/announcements/:id', async (c) => {
  const db = c.env.DB
  const id = c.req.param('id')
  await db.prepare(`DELETE FROM announcements WHERE id=?`).bind(id).run()
  return c.json({ success: true })
})

// ==================== 分組學期 API ====================

apiRoutes.get('/groups/:id/semesters', async (c) => {
  const db = c.env.DB
  const id = c.req.param('id')
  const result = await db.prepare(`
    SELECT gs.*, COUNT(si.id) as image_count
    FROM group_semesters gs
    LEFT JOIN semester_images si ON si.semester_id = gs.id
    WHERE gs.group_id = ?
    GROUP BY gs.id
    ORDER BY gs.display_order ASC, gs.semester DESC
  `).bind(id).all()
  return c.json({ success: true, data: result.results })
})

apiRoutes.post('/groups/:id/semesters', async (c) => {
  const db = c.env.DB
  const groupId = c.req.param('id')
  const body = await c.req.json()
  const { semester, title, description, cover_image, display_order, is_published } = body
  if (!semester) return c.json({ success: false, error: '學期為必填' }, 400)
  const result = await db.prepare(`
    INSERT INTO group_semesters (group_id, semester, title, description, cover_image, display_order, is_published)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(groupId, semester, title || null, description || null, cover_image || null, display_order || 0, is_published !== undefined ? is_published : 1).run()
  return c.json({ success: true, id: result.meta.last_row_id })
})

apiRoutes.put('/semesters/:id', async (c) => {
  const db = c.env.DB
  const id = c.req.param('id')
  const body = await c.req.json()
  const { semester, title, description, cover_image, display_order, is_published } = body
  await db.prepare(`
    UPDATE group_semesters SET semester=?, title=?, description=?, cover_image=?, display_order=?, is_published=?
    WHERE id=?
  `).bind(semester, title || null, description || null, cover_image || null, display_order || 0, is_published !== undefined ? is_published : 1, id).run()
  return c.json({ success: true })
})

apiRoutes.delete('/semesters/:id', async (c) => {
  const db = c.env.DB
  const id = c.req.param('id')
  await db.prepare(`DELETE FROM group_semesters WHERE id=?`).bind(id).run()
  return c.json({ success: true })
})

apiRoutes.get('/semesters/:id/images', async (c) => {
  const db = c.env.DB
  const id = c.req.param('id')
  const result = await db.prepare(`SELECT * FROM semester_images WHERE semester_id=? ORDER BY display_order ASC`).bind(id).all()
  return c.json({ success: true, data: result.results })
})

apiRoutes.post('/semesters/:id/images', async (c) => {
  const db = c.env.DB
  const semId = c.req.param('id')
  const body = await c.req.json()
  const { image_url, caption, display_order } = body
  if (!image_url) return c.json({ success: false, error: '圖片網址為必填' }, 400)
  const result = await db.prepare(`
    INSERT INTO semester_images (semester_id, image_url, caption, display_order)
    VALUES (?, ?, ?, ?)
  `).bind(semId, image_url, caption || null, display_order || 0).run()
  return c.json({ success: true, id: result.meta.last_row_id })
})

apiRoutes.delete('/semester-images/:id', async (c) => {
  const db = c.env.DB
  const id = c.req.param('id')
  await db.prepare(`DELETE FROM semester_images WHERE id=?`).bind(id).run()
  return c.json({ success: true })
})

// ==================== 網站設定 API ====================

apiRoutes.get('/settings', async (c) => {
  const db = c.env.DB
  const result = await db.prepare(`SELECT key, value, description FROM site_settings`).all()
  const settings: Record<string, string> = {}
  result.results.forEach((row: any) => { settings[row.key] = row.value })
  return c.json({ success: true, data: settings })
})

apiRoutes.put('/settings', async (c) => {
  const db = c.env.DB
  const body = await c.req.json()
  for (const [key, value] of Object.entries(body)) {
    await db.prepare(`
      INSERT INTO site_settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=CURRENT_TIMESTAMP
    `).bind(key, value as string).run()
  }
  return c.json({ success: true })
})

// ==================== 年度在籍管理 API ====================

// ==================== 輔助函式：同步階級與進程標準 ====================
async function syncRankRequirements(db: D1Database, memberId: string, section: string, rank: string) {
  if (!rank || !section) return

  // 行義童軍與童軍共用相同階級名稱
  const rankOrders: Record<string, string[]> = {
    '童軍': ['見習童軍', '初級童軍', '中級童軍', '高級童軍', '獅級童軍', '長城童軍', '國花童軍'],
    '行義童軍': ['見習童軍', '初級童軍', '中級童軍', '高級童軍', '獅級童軍', '長城童軍', '國花童軍'],
    '羅浮童軍': ['見習羅浮', '授銜羅浮', '服務羅浮']
  }

  const targetOrder = rankOrders[section]
  if (!targetOrder) return

  const targetIndex = targetOrder.indexOf(rank)
  if (targetIndex === -1) return

  // 找出所有需要標記為完成的階級 (包含目前階級及之前所有階級)
  const passedRanks = targetOrder.slice(0, targetIndex + 1)

  // 1. 自動補齊「進程紀錄 (大階段)」
  for (const r of passedRanks) {
    if (!r) continue
    // 檢查是否已有紀錄，若無則補登
    const exist = await db.prepare(`SELECT id FROM progress_records WHERE member_id=? AND record_type='rank' AND award_name=?`).bind(memberId, r).first()
    if (!exist) {
      await db.prepare(`
        INSERT INTO progress_records (id, member_id, record_type, award_name, awarded_at, notes)
        VALUES (?, ?, 'rank', ?, CURRENT_DATE, '系統自動同步')
      `).bind(`pr-auto-${Date.now()}-${Math.random()}`, memberId, r).run()
    }
  }

  // 2. 自動勾選所有相關的「細項標準」
  // 找出這些階級對應的所有 requirement_id
  const requirements = await db.prepare(`
    SELECT id, required_count FROM advancement_requirements 
    WHERE section = ? AND rank_to IN (${passedRanks.map(()=>'?').join(',')}) AND is_active = 1
  `).bind(section, ...passedRanks).all()

  for (const req of requirements.results as any[]) {
    // 寫入 advancement_progress，標記為 approved
    await db.prepare(`
      INSERT INTO advancement_progress (id, member_id, requirement_id, achieved_count, status, reviewed_at, reviewed_by)
      VALUES (?, ?, ?, ?, 'approved', CURRENT_TIMESTAMP, 'system')
      ON CONFLICT(member_id, requirement_id) DO UPDATE SET
        achieved_count = ?, status = 'approved', reviewed_at = CURRENT_TIMESTAMP
    `).bind(
      `ap-auto-${Date.now()}-${Math.random()}`, 
      memberId, 
      req.id, 
      req.required_count, 
      req.required_count
    ).run()
  }
}

// 取得某年度的在籍成員（含成員基本資料）
apiRoutes.get('/enrollments', async (c) => {
  const db = c.env.DB
  const year = c.req.query('year') || '114'
  const section = c.req.query('section')
  let query = `
    SELECT me.*, m.chinese_name, m.english_name, m.gender, m.national_id, m.dob, m.phone, m.email
    FROM member_enrollments me
    JOIN members m ON m.id = me.member_id
    WHERE me.year_label = ? AND me.is_active = 1
  `
  const params: any[] = [year]
  if (section) { query += ` AND me.section = ?`; params.push(section) }
  query += ` ORDER BY me.section, me.unit_name, m.chinese_name`
  const result = await db.prepare(query).bind(...params).all()
  return c.json({ success: true, data: result.results })
})

// 取得「未加入某年度」的舊成員（用於沿用舊資料）
apiRoutes.get('/enrollments/available', async (c) => {
  const db = c.env.DB
  const year = c.req.query('year') || '114'
  const search = c.req.query('search') || ''
  let query = `
    SELECT m.*, me_prev.year_label as last_year, me_prev.section as last_section, me_prev.rank_level as last_rank, me_prev.unit_name as last_unit
    FROM members m
    LEFT JOIN member_enrollments me_prev ON me_prev.member_id = m.id AND me_prev.year_label = (
      SELECT MAX(year_label) FROM member_enrollments WHERE member_id = m.id
    )
    WHERE m.id NOT IN (
      SELECT member_id FROM member_enrollments WHERE year_label = ? AND is_active = 1
    )
    AND m.membership_status = 'ACTIVE'
  `
  const params: any[] = [year]
  if (search) { query += ` AND (m.chinese_name LIKE ? OR m.english_name LIKE ?)`; params.push(`%${search}%`, `%${search}%`) }
  query += ` ORDER BY me_prev.year_label DESC, m.chinese_name`
  const result = await db.prepare(query).bind(...params).all()
  return c.json({ success: true, data: result.results })
})

// 取得「停團/非在籍」成員 (用於管理列表)
apiRoutes.get('/members/inactive', async (c) => {
  const db = c.env.DB
  const currentYear = c.req.query('year') || '114'
  const search = c.req.query('search') || ''
  
  // 定義：所有曾經加入過，但「目前年度沒有有效學籍」的人員
  // 包含 membership_status = 'ACTIVE' (暫離) 或 'INACTIVE' (已停團)
  let query = `
    SELECT m.*, 
      (SELECT MAX(year_label) FROM member_enrollments WHERE member_id = m.id AND is_active=1) as last_active_year,
      (SELECT section FROM member_enrollments WHERE member_id = m.id ORDER BY year_label DESC LIMIT 1) as last_section
    FROM members m
    WHERE m.id NOT IN (
      SELECT member_id FROM member_enrollments WHERE year_label = ? AND is_active = 1
    )
  `
  const params: any[] = [currentYear]
  if (search) { query += ` AND (m.chinese_name LIKE ? OR m.english_name LIKE ?)`; params.push(`%${search}%`, `%${search}%`) }
  query += ` ORDER BY last_active_year DESC, m.chinese_name`
  
  const result = await db.prepare(query).bind(...params).all()
  return c.json({ success: true, data: result.results })
})

// 批次將成員加入某年度（沿用舊資料）
apiRoutes.post('/enrollments/batch', async (c) => {
  const db = c.env.DB
  const body = await c.req.json()
  const { year_label, member_ids, copy_from_prev } = body
  if (!year_label || !member_ids?.length) return c.json({ success: false, error: '參數不完整' }, 400)
  let added = 0
  for (const member_id of member_ids) {
    // 從成員主表取得基本資料（作為備用）
    const memberBase = await db.prepare(`
      SELECT section, rank_level, unit_name, role_name, troop FROM members WHERE id = ?
    `).bind(member_id).first() as any
    
    // 嘗試從最近一次在籍記錄取得資料
    const prev = copy_from_prev ? await db.prepare(`
      SELECT * FROM member_enrollments WHERE member_id = ? ORDER BY year_label DESC LIMIT 1
    `).bind(member_id).first() as any : null
    
    await db.prepare(`
      INSERT OR IGNORE INTO member_enrollments (member_id, year_label, section, rank_level, unit_name, role_name, troop, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1)
    `).bind(member_id, year_label,
      prev?.section || memberBase?.section || null,
      prev?.rank_level || memberBase?.rank_level || null,
      prev?.unit_name || memberBase?.unit_name || null,
      prev?.role_name || memberBase?.role_name || '隊員',
      prev?.troop || memberBase?.troop || '54團').run()
    added++
  }
  return c.json({ success: true, added })
})

// 新增單一成員到年度在籍（同時可新增成員主表）
apiRoutes.post('/enrollments', async (c) => {
  const db = c.env.DB
  const body = await c.req.json()
  const { year_label, member_id, chinese_name, english_name, gender, national_id, dob,
    section, rank_level, unit_name, role_name, troop, phone, email, parent_name, country, university, membership_status, notes } = body
  if (!year_label) return c.json({ success: false, error: '年度為必填' }, 400)
  if (!chinese_name && !member_id) return c.json({ success: false, error: '姓名為必填' }, 400)

  let mId = member_id

  if (!mId) {
    // 先嘗試用身分證號或姓名找現有成員
    let existingMember: any = null
    if (national_id && national_id.trim()) {
      existingMember = await db.prepare(
        `SELECT id FROM members WHERE national_id = ? AND membership_status != 'DELETED'`
      ).bind(national_id.trim().toUpperCase()).first() as any
    }
    if (!existingMember && chinese_name) {
      existingMember = await db.prepare(
        `SELECT id FROM members WHERE chinese_name = ? AND membership_status != 'DELETED' LIMIT 1`
      ).bind(chinese_name.trim()).first() as any
    }

    if (existingMember) {
      // 更新現有成員資料（如果有新資訊）
      mId = existingMember.id
      const updates: string[] = []
      const vals: any[] = []
      if (english_name) { updates.push('english_name=?'); vals.push(english_name) }
      if (gender) { updates.push('gender=?'); vals.push(gender) }
      if (dob) { updates.push('dob=?'); vals.push(dob) }
      if (phone) { updates.push('phone=?'); vals.push(phone) }
      if (email) { updates.push('email=?'); vals.push(email) }
      if (parent_name) { updates.push('parent_name=?'); vals.push(parent_name) }
      if (country !== undefined) { updates.push('country=?'); vals.push(country || null) }
      if (university !== undefined) { updates.push('university=?'); vals.push(university || null) }
      if (membership_status) { updates.push('membership_status=?'); vals.push(membership_status) }
      if (notes !== undefined) { updates.push('notes=?'); vals.push(notes || null) }
      if (section) { updates.push('section=?'); vals.push(section) }
      if (rank_level) { updates.push('rank_level=?'); vals.push(rank_level) }
      if (unit_name) { updates.push('unit_name=?'); vals.push(unit_name) }
      if (role_name) { updates.push('role_name=?'); vals.push(role_name) }
      if (updates.length) {
        updates.push('updated_at=CURRENT_TIMESTAMP')
        vals.push(mId)
        await db.prepare(`UPDATE members SET ${updates.join(',')} WHERE id=?`).bind(...vals).run()
      }
    } else {
      // 建立新成員
      mId = `m-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
      const finalTroop = troop || '54團'
      await db.prepare(`
        INSERT INTO members (id, chinese_name, english_name, gender, national_id, dob, phone, email, parent_name, country, university, section, rank_level, unit_name, role_name, troop, notes, membership_status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(mId, chinese_name.trim(), english_name || null, gender || null,
        national_id ? national_id.trim().toUpperCase() : null,
        dob || null, phone || null, email || null, parent_name || null,
        country || null, university || null,
        section || '童軍', rank_level || null, unit_name || null,
        role_name || '隊員', finalTroop, notes || null, membership_status || 'ACTIVE').run()
    }
  }

  // 新增或更新年度在籍記錄
  // 先檢查是否已有此年度記錄
  const existEnroll = await db.prepare(
    `SELECT id, is_active FROM member_enrollments WHERE member_id=? AND year_label=?`
  ).bind(mId, year_label).first() as any

  if (existEnroll) {
    // 已有記錄：重新啟用並更新
    await db.prepare(`
      UPDATE member_enrollments SET section=?, rank_level=?, unit_name=?, role_name=?, troop=?, is_active=1, updated_at=CURRENT_TIMESTAMP
      WHERE member_id=? AND year_label=?
    `).bind(section || null, rank_level || null, unit_name || null,
      role_name || '隊員', troop || '54團', mId, year_label).run()
  } else {
    await db.prepare(`
      INSERT INTO member_enrollments (member_id, year_label, section, rank_level, unit_name, role_name, troop, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1)
    `).bind(mId, year_label, section || null, rank_level || null, unit_name || null,
      role_name || '隊員', troop || '54團').run()
  }

  // 同步更新成員主表的最新資料
  if (section || rank_level || unit_name || role_name) {
    const syncUpdates: string[] = ['updated_at=CURRENT_TIMESTAMP']
    const syncVals: any[] = []
    if (section) { syncUpdates.push('section=?'); syncVals.push(section) }
    if (rank_level) { syncUpdates.push('rank_level=?'); syncVals.push(rank_level) }
    if (unit_name !== undefined) { syncUpdates.push('unit_name=?'); syncVals.push(unit_name || null) }
    if (role_name) { syncUpdates.push('role_name=?'); syncVals.push(role_name) }
    syncVals.push(mId)
    await db.prepare(`UPDATE members SET ${syncUpdates.join(',')} WHERE id=?`).bind(...syncVals).run()
    
    // 自動同步進程標準勾選
    if (rank_level && section) {
      await syncRankRequirements(db, mId, section, rank_level)
    }
  }

  return c.json({ success: true, id: mId, updated: !!existEnroll })
})

// 更新年度在籍資料
apiRoutes.put('/enrollments/:id', async (c) => {
  const db = c.env.DB
  const id = c.req.param('id')
  const body = await c.req.json()
  const { section, rank_level, unit_name, role_name, troop, is_active, notes } = body
  
  // 取得 member_id 以便同步
  const enroll = await db.prepare(`SELECT member_id FROM member_enrollments WHERE id=?`).bind(id).first() as any
  
  await db.prepare(`
    UPDATE member_enrollments SET section=?, rank_level=?, unit_name=?, role_name=?, troop=?, is_active=?, notes=?, updated_at=CURRENT_TIMESTAMP
    WHERE id=?
  `).bind(section || null, rank_level || null, unit_name || null, role_name || '隊員',
    troop || '54團', is_active ?? 1, notes || null, id).run()

  // 同步更新成員主表
  if (enroll && (section || rank_level)) {
    const mId = enroll.member_id
    const updates: string[] = []
    const vals: any[] = []
    if (section) { updates.push('section=?'); vals.push(section) }
    if (rank_level) { updates.push('rank_level=?'); vals.push(rank_level) }
    if (updates.length) {
      updates.push('updated_at=CURRENT_TIMESTAMP')
      vals.push(mId)
      await db.prepare(`UPDATE members SET ${updates.join(',')} WHERE id=?`).bind(...vals).run()
      
      // 自動同步進程標準勾選
      if (rank_level) {
        // 如果只更新 rank_level 沒傳 section，要先查 section
        let finalSection = section
        if (!finalSection) {
           const m = await db.prepare(`SELECT section FROM members WHERE id=?`).bind(mId).first() as any
           finalSection = m?.section
        }
        await syncRankRequirements(db, mId, finalSection, rank_level)
      }
    }
  }

  return c.json({ success: true })
})

// 移除某年度的在籍成員（軟刪除：is_active=0）
apiRoutes.delete('/enrollments/:id', async (c) => {
  const db = c.env.DB
  const id = c.req.param('id')
  await db.prepare(`UPDATE member_enrollments SET is_active=0 WHERE id=?`).bind(id).run()
  return c.json({ success: true })
})

// 取得可用小隊清單
apiRoutes.get('/scout-units', async (c) => {
  const db = c.env.DB
  const section = c.req.query('section')
  let query = `SELECT * FROM scout_units WHERE is_active=1`
  const params: any[] = []
  if (section) { query += ` AND section=?`; params.push(section) }
  query += ` ORDER BY unit_order, unit_name`
  const result = await db.prepare(query).bind(...params).all()
  return c.json({ success: true, data: result.results })
})

// ==================== 人員管理 API ====================

// 取得所有成員（支援篩選）
apiRoutes.get('/members', async (c) => {
  const db = c.env.DB
  const section = c.req.query('section')
  const status = c.req.query('status') || 'ACTIVE'
  const search = c.req.query('search')
  
  let query = `SELECT * FROM members WHERE 1=1`
  const params: any[] = []
  
  if (status && status !== 'all') {
    query += ` AND membership_status = ?`
    params.push(status)
  }
  if (section) {
    query += ` AND section = ?`
    params.push(section)
  }
  if (search) {
    query += ` AND (chinese_name LIKE ? OR english_name LIKE ?)`
    params.push(`%${search}%`, `%${search}%`)
  }
  query += ` ORDER BY section, unit_name, chinese_name`
  
  const result = await db.prepare(query).bind(...params).all()
  return c.json({ success: true, data: result.results })
})

// 取得單一成員
apiRoutes.get('/members/:id', async (c) => {
  const db = c.env.DB
  const id = c.req.param('id')
  const member = await db.prepare(`SELECT * FROM members WHERE id = ?`).bind(id).first()
  if (!member) return c.json({ success: false, error: '找不到成員' }, 404)
  
  // 取得進程記錄
  const progress = await db.prepare(`SELECT * FROM progress_records WHERE member_id = ? ORDER BY awarded_at DESC`).bind(id).all()
  // 取得出席記錄
  const attendance = await db.prepare(`
    SELECT ar.*, ats.title, ats.date, ats.section, ats.topic
    FROM attendance_records ar
    JOIN attendance_sessions ats ON ats.id = ar.session_id
    WHERE ar.member_id = ?
    ORDER BY ats.date DESC
  `).bind(id).all()
  
  return c.json({ success: true, data: { ...member, progress: progress.results, attendance: attendance.results } })
})

// 新增成員
apiRoutes.post('/members', async (c) => {
  const db = c.env.DB
  const body = await c.req.json()
  const { id, chinese_name, english_name, gender, national_id, dob, phone, email, parent_name, section, rank_level, unit_name, role_name, troop, membership_status, notes } = body
  if (!chinese_name) return c.json({ success: false, error: '姓名為必填' }, 400)
  
  const memberId = id || `m-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
  await db.prepare(`
    INSERT INTO members (id, chinese_name, english_name, gender, national_id, dob, phone, email, parent_name, section, rank_level, unit_name, role_name, troop, membership_status, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    memberId, chinese_name, english_name || null, gender || null, national_id || null, dob || null,
    phone || null, email || null, parent_name || null, section || '童軍', rank_level || null,
    unit_name || null, role_name || '隊員', troop || '54團', membership_status || 'ACTIVE', notes || null
  ).run()
  
  return c.json({ success: true, id: memberId })
})

// 更新成員
apiRoutes.put('/members/:id', async (c) => {
  const db = c.env.DB
  const id = c.req.param('id')
  const body = await c.req.json()
  const { chinese_name, english_name, gender, national_id, dob, phone, email, parent_name, section, rank_level, unit_name, role_name, troop, membership_status, notes, country, university } = body
  
  await db.prepare(`
    UPDATE members SET
      chinese_name=?, english_name=?, gender=?, national_id=?, dob=?, phone=?, email=?,
      parent_name=?, section=?, rank_level=?, unit_name=?, role_name=?, troop=?,
      membership_status=?, notes=?, country=?, university=?, updated_at=CURRENT_TIMESTAMP
    WHERE id=?
  `).bind(
    chinese_name, english_name || null, gender || null, national_id || null, dob || null,
    phone || null, email || null, parent_name || null, section || '童軍', rank_level || null,
    unit_name || null, role_name || '隊員', troop || '54團', membership_status || 'ACTIVE', notes || null,
    country || null, university || null, id
  ).run()

  // 自動同步進程標準勾選（當有設定階級時）
  if (rank_level && section) {
    await syncRankRequirements(db, id, section, rank_level)
  } else if (rank_level) {
    // 若未傳 section，查主表
    const m = await db.prepare(`SELECT section FROM members WHERE id=?`).bind(id).first() as any
    if (m?.section) await syncRankRequirements(db, id, m.section, rank_level)
  }
  
  return c.json({ success: true })
})

// 刪除成員
apiRoutes.delete('/members/:id', async (c) => {
  const db = c.env.DB
  const id = c.req.param('id')
  await db.prepare(`DELETE FROM members WHERE id=?`).bind(id).run()
  return c.json({ success: true })
})

// ==================== 出席管理 API ====================

// 取得所有場次
apiRoutes.get('/attendance/sessions', async (c) => {
  const db = c.env.DB
  const section = c.req.query('section')
  let query = `
    SELECT ats.*, 
      COUNT(ar.id) as total_count,
      SUM(CASE WHEN ar.status = 'present' THEN 1 ELSE 0 END) as present_count,
      SUM(CASE WHEN ar.status = 'absent' THEN 1 ELSE 0 END) as absent_count
    FROM attendance_sessions ats
    LEFT JOIN attendance_records ar ON ar.session_id = ats.id
    WHERE 1=1
  `
  const params: any[] = []
  if (section) {
    query += ` AND ats.section = ?`
    params.push(section)
  }
  query += ` GROUP BY ats.id ORDER BY ats.date DESC`
  
  const result = await db.prepare(query).bind(...params).all()
  return c.json({ success: true, data: result.results })
})

// 取得場次詳情（含出席記錄）
apiRoutes.get('/attendance/sessions/:id', async (c) => {
  const db = c.env.DB
  const id = c.req.param('id')
  const session = await db.prepare(`SELECT * FROM attendance_sessions WHERE id=?`).bind(id).first()
  if (!session) return c.json({ success: false, error: '找不到場次' }, 404)
  
  const records = await db.prepare(`
    SELECT ar.*, m.chinese_name, m.english_name, m.section, m.unit_name, m.role_name
    FROM attendance_records ar
    JOIN members m ON m.id = ar.member_id
    WHERE ar.session_id = ?
    ORDER BY m.unit_name, m.chinese_name
  `).bind(id).all()
  
  return c.json({ success: true, data: { ...session, records: records.results } })
})

// 新增場次
apiRoutes.post('/attendance/sessions', async (c) => {
  const db = c.env.DB
  const body = await c.req.json()
  const { id, title, date, section, session_number, topic, notes, year_label, member_ids } = body
  if (!title || !date) return c.json({ success: false, error: '標題和日期為必填' }, 400)
  
  const sessionId = id || `as-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
  await db.prepare(`
    INSERT INTO attendance_sessions (id, title, date, section, session_number, topic, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(sessionId, title, date, section || 'all', session_number || null, topic || null, notes || null).run()
  
  let membersList: any[] = []
  
  if (member_ids && member_ids.length > 0) {
    // 使用指定的人員名單
    for (const mid of member_ids) {
      membersList.push({ id: mid })
    }
  } else {
    // 優先從年度在籍成員取人
    const yearStr = year_label || (await db.prepare(`SELECT value FROM site_settings WHERE key='current_year_label'`).first() as any)?.value || '114'
    const sectionMap: Record<string, string> = { junior: '童軍', senior: '行義童軍', rover: '羅浮童軍' }
    const sectionCN = sectionMap[section] || ''
    
    let enrollQuery = `SELECT member_id as id FROM member_enrollments WHERE year_label = ? AND is_active = 1`
    const enrollParams: any[] = [yearStr]
    if (sectionCN) { enrollQuery += ` AND section = ?`; enrollParams.push(sectionCN) }
    
    const enrolled = await db.prepare(enrollQuery).bind(...enrollParams).all()
    membersList = enrolled.results as any[]
    
    // 若年度在籍無資料，fallback 到原本的 active members
    if (!membersList.length) {
      let memberQuery = `SELECT id FROM members WHERE membership_status = 'ACTIVE'`
      const memberParams: any[] = []
      if (sectionCN) { memberQuery += ` AND section = ?`; memberParams.push(sectionCN) }
      const fallback = await db.prepare(memberQuery).bind(...memberParams).all()
      membersList = fallback.results as any[]
    }
  }
  
  for (const member of membersList) {
    await db.prepare(`
      INSERT OR IGNORE INTO attendance_records (session_id, member_id, status)
      VALUES (?, ?, 'present')
    `).bind(sessionId, member.id).run()
  }
  
  return c.json({ success: true, id: sessionId, member_count: membersList.length })
})

// 確認送出點名（鎖定場次）
apiRoutes.post('/attendance/sessions/:id/submit', async (c) => {
  const db = c.env.DB
  const sessionId = c.req.param('id')
  const session = await db.prepare(`SELECT * FROM attendance_sessions WHERE id=?`).bind(sessionId).first()
  if (!session) return c.json({ success: false, error: '找不到場次' }, 404)
  await db.prepare(`
    UPDATE attendance_sessions SET submitted=1, submitted_at=CURRENT_TIMESTAMP WHERE id=?
  `).bind(sessionId).run()
  return c.json({ success: true })
})

// 榮譽小隊 - 取得某場次的榮譽小隊記錄
apiRoutes.get('/attendance/sessions/:id/honor-patrol', async (c) => {
  const db = c.env.DB
  const sessionId = c.req.param('id')
  const records = await db.prepare(`
    SELECT * FROM honor_patrol_records WHERE session_id=? ORDER BY created_at DESC
  `).bind(sessionId).all()
  return c.json({ success: true, data: records.results })
})

// 榮譽小隊 - 新增榮譽小隊記錄
apiRoutes.post('/attendance/sessions/:id/honor-patrol', async (c) => {
  const db = c.env.DB
  const sessionId = c.req.param('id')
  const session = await db.prepare(`SELECT * FROM attendance_sessions WHERE id=?`).bind(sessionId).first() as any
  if (!session) return c.json({ success: false, error: '找不到場次' }, 404)
  const body = await c.req.json()
  const { patrol_name, reason, year_label, announce } = body
  if (!patrol_name) return c.json({ success: false, error: '小隊名稱為必填' }, 400)
  const id = `hp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
  await db.prepare(`
    INSERT INTO honor_patrol_records (id, session_id, patrol_name, section, reason, year_label, announced, announced_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(id, sessionId, patrol_name, session.section, reason || null, year_label || null,
    announce ? 1 : 0, announce ? new Date().toISOString() : null).run()
  // 如果選擇公告到榮譽榜，同時對小隊成員新增成就記錄
  if (announce) {
    const membersList = await db.prepare(`
      SELECT id FROM members WHERE unit_name=? AND membership_status='ACTIVE'
    `).bind(patrol_name).all()
    const prBase = `pr-hp-${Date.now()}`
    for (const m of membersList.results as any[]) {
      const prId = prBase + '-' + m.id.slice(-5)
      await db.prepare(`
        INSERT OR IGNORE INTO progress_records (id, member_id, record_type, award_name, year_label, notes)
        VALUES (?, ?, 'achievement', ?, ?, ?)
      `).bind(prId, m.id, '榮譽小隊：' + patrol_name, year_label || null, reason || null).run()
    }
  }
  return c.json({ success: true, id })
})

// 榮譽小隊 - 刪除
apiRoutes.delete('/honor-patrol/:id', async (c) => {
  const db = c.env.DB
  const id = c.req.param('id')
  await db.prepare(`DELETE FROM honor_patrol_records WHERE id=?`).bind(id).run()
  return c.json({ success: true })
})

// 榮譽小隊 - 公告到榮譽榜
apiRoutes.post('/honor-patrol/:id/announce', async (c) => {
  const db = c.env.DB
  const id = c.req.param('id')
  const record = await db.prepare(`SELECT * FROM honor_patrol_records WHERE id=?`).bind(id).first() as any
  if (!record) return c.json({ success: false, error: '找不到記錄' }, 404)
  if (record.announced) return c.json({ success: false, error: '已公告過' }, 400)
  const body = await c.req.json().catch(() => ({}))
  const year_label = (body as any).year_label || record.year_label
  await db.prepare(`
    UPDATE honor_patrol_records SET announced=1, announced_at=CURRENT_TIMESTAMP WHERE id=?
  `).bind(id).run()
  // 對 unit_name = patrol_name 的所有 ACTIVE 成員新增成就記錄
  const membersList = await db.prepare(`
    SELECT id FROM members WHERE unit_name=? AND membership_status='ACTIVE'
  `).bind(record.patrol_name).all()
  const prBase = `pr-hp-${Date.now()}`
  for (const m of membersList.results as any[]) {
    const prId = prBase + '-' + m.id.slice(-5)
    await db.prepare(`
      INSERT OR IGNORE INTO progress_records (id, member_id, record_type, award_name, year_label, notes)
      VALUES (?, ?, 'achievement', ?, ?, ?)
    `).bind(prId, m.id, '榮譽小隊：' + record.patrol_name, year_label || null, record.reason || null).run()
  }
  return c.json({ success: true })
})

// 取得所有榮譽小隊記錄（公開，用於榮譽榜）
apiRoutes.get('/honor-patrol', async (c) => {
  const db = c.env.DB
  const section = c.req.query('section')
  let query = `SELECT hp.*, ats.title as session_title, ats.date as session_date
    FROM honor_patrol_records hp
    JOIN attendance_sessions ats ON ats.id = hp.session_id
    WHERE 1=1`
  const params: any[] = []
  if (section) { query += ` AND hp.section=?`; params.push(section) }
  query += ` ORDER BY hp.created_at DESC`
  const records = await db.prepare(query).bind(...params).all()
  return c.json({ success: true, data: records.results })
})

// 更新出席狀態
apiRoutes.put('/attendance/records/:sessionId/:memberId', async (c) => {
  const db = c.env.DB
  const { sessionId, memberId } = c.req.param()
  const body = await c.req.json()
  const { status, note } = body
  
  await db.prepare(`
    INSERT INTO attendance_records (session_id, member_id, status, note)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(session_id, member_id) DO UPDATE SET status=excluded.status, note=excluded.note
  `).bind(sessionId, memberId, status || 'present', note || null).run()
  
  return c.json({ success: true })
})

// 批次更新出席（整個場次）
apiRoutes.put('/attendance/sessions/:id/records', async (c) => {
  const db = c.env.DB
  const sessionId = c.req.param('id')
  const body = await c.req.json()
  const { records } = body  // [{member_id, status, note}]
  
  for (const rec of records) {
    await db.prepare(`
      INSERT INTO attendance_records (session_id, member_id, status, note)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(session_id, member_id) DO UPDATE SET status=excluded.status, note=excluded.note
    `).bind(sessionId, rec.member_id, rec.status || 'present', rec.note || null).run()
  }
  
  return c.json({ success: true })
})

// 刪除場次
apiRoutes.delete('/attendance/sessions/:id', async (c) => {
  const db = c.env.DB
  const id = c.req.param('id')
  await db.prepare(`DELETE FROM attendance_records WHERE session_id=?`).bind(id).run()
  await db.prepare(`DELETE FROM attendance_sessions WHERE id=?`).bind(id).run()
  return c.json({ success: true })
})

// ==================== 進程/榮譽 API ====================

// 取得所有進程記錄（公開，用於榮譽榜）
apiRoutes.get('/progress', async (c) => {
  const db = c.env.DB
  const type = c.req.query('type')
  const year = c.req.query('year')
  
  let query = `
    SELECT pr.*, m.chinese_name, m.english_name, m.section
    FROM progress_records pr
    JOIN members m ON m.id = pr.member_id
    WHERE 1=1
  `
  const params: any[] = []
  if (type) { query += ` AND pr.record_type = ?`; params.push(type) }
  if (year) { query += ` AND pr.year_label = ?`; params.push(year) }
  query += ` ORDER BY pr.awarded_at DESC`
  
  const result = await db.prepare(query).bind(...params).all()
  return c.json({ success: true, data: result.results })
})

// 新增進程記錄
apiRoutes.post('/progress', async (c) => {
  const db = c.env.DB
  const body = await c.req.json()
  const { member_id, record_type, award_id, award_name, year_label, awarded_at, notes } = body
  if (!member_id || !award_name) return c.json({ success: false, error: '成員和獎項為必填' }, 400)
  
  const id = `pr-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
  await db.prepare(`
    INSERT INTO progress_records (id, member_id, record_type, award_id, award_name, year_label, awarded_at, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(id, member_id, record_type || 'rank', award_id || null, award_name, year_label || null, awarded_at || null, notes || null).run()
  
  return c.json({ success: true, id })
})

// 刪除進程記錄
apiRoutes.delete('/progress/:id', async (c) => {
  const db = c.env.DB
  const id = c.req.param('id')
  await db.prepare(`DELETE FROM progress_records WHERE id=?`).bind(id).run()
  return c.json({ success: true })
})

// ==================== 公假申請 API ====================

apiRoutes.get('/leaves', async (c) => {
  const db = c.env.DB
  const status = c.req.query('status')
  let query = `
    SELECT lr.*, m.chinese_name, m.section
    FROM leave_requests lr
    JOIN members m ON m.id = lr.member_id
    WHERE 1=1
  `
  const params: any[] = []
  if (status) { query += ` AND lr.status = ?`; params.push(status) }
  query += ` ORDER BY lr.created_at DESC`
  
  const result = await db.prepare(query).bind(...params).all()
  return c.json({ success: true, data: result.results })
})

apiRoutes.post('/leaves', async (c) => {
  const db = c.env.DB
  const body = await c.req.json()
  const { member_id, session_id, leave_type, reason, date } = body
  if (!member_id || !date) return c.json({ success: false, error: '成員和日期為必填' }, 400)
  
  const id = `lr-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
  await db.prepare(`
    INSERT INTO leave_requests (id, member_id, session_id, leave_type, reason, date)
    VALUES (?, ?, ?, ?, ?, ?)
  `).bind(id, member_id, session_id || null, leave_type || 'official', reason || null, date).run()
  
  return c.json({ success: true, id })
})

apiRoutes.put('/leaves/:id', async (c) => {
  const db = c.env.DB
  const id = c.req.param('id')
  const body = await c.req.json()
  const { status, approved_by } = body
  
  await db.prepare(`UPDATE leave_requests SET status=?, approved_by=? WHERE id=?`).bind(status, approved_by || null, id).run()
  return c.json({ success: true })
})

apiRoutes.delete('/leaves/:id', async (c) => {
  const db = c.env.DB
  const id = c.req.param('id')
  await db.prepare(`DELETE FROM leave_requests WHERE id=?`).bind(id).run()
  return c.json({ success: true })
})

// ==================== 教練團 API ====================

apiRoutes.get('/coaches', async (c) => {
  const db = c.env.DB
  const year = c.req.query('year')
  let query = `SELECT * FROM coach_members WHERE 1=1`
  const params: any[] = []
  if (year) { query += ` AND year_label = ?`; params.push(year) }
  query += ` ORDER BY CASE coach_level WHEN '指導教練' THEN 1 WHEN '助理教練' THEN 2 WHEN '見習教練' THEN 3 WHEN '預備教練' THEN 4 ELSE 5 END, chinese_name`
  
  const result = await db.prepare(query).bind(...params).all()
  return c.json({ success: true, data: result.results })
})

apiRoutes.post('/coaches', async (c) => {
  const db = c.env.DB
  const body = await c.req.json()
  const { chinese_name, english_name, coach_level, specialties, year_label, section_assigned, notes } = body
  if (!chinese_name) return c.json({ success: false, error: '姓名為必填' }, 400)
  
  const id = `c-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
  await db.prepare(`
    INSERT INTO coach_members (id, chinese_name, english_name, coach_level, specialties, year_label, section_assigned, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(id, chinese_name, english_name || null, coach_level || '預備教練', specialties || null, year_label || null, section_assigned || null, notes || null).run()
  
  return c.json({ success: true, id })
})

apiRoutes.put('/coaches/:id', async (c) => {
  const db = c.env.DB
  const id = c.req.param('id')
  const body = await c.req.json()
  const { chinese_name, english_name, coach_level, specialties, year_label, section_assigned, notes } = body
  
  await db.prepare(`
    UPDATE coach_members SET chinese_name=?, english_name=?, coach_level=?, specialties=?, year_label=?, section_assigned=?, notes=?
    WHERE id=?
  `).bind(chinese_name, english_name || null, coach_level || '預備教練', specialties || null, year_label || null, section_assigned || null, notes || null, id).run()
  
  return c.json({ success: true })
})

apiRoutes.delete('/coaches/:id', async (c) => {
  const db = c.env.DB
  const id = c.req.param('id')
  await db.prepare(`DELETE FROM coach_members WHERE id=?`).bind(id).run()
  return c.json({ success: true })
})

// ==================== 教練團晉級 API ====================

// 取得成員的完成項目清單
apiRoutes.get('/coach/member-completions', async (c) => {
  const db = c.env.DB
  const memberId = c.req.query('member_id')
  if (!memberId) return c.json({ error: '缺少 member_id' }, 400)
  const rows = await db.prepare(`SELECT item_id FROM coach_checklist_completions WHERE member_id = ?`).bind(memberId).all()
  return c.json({ completions: rows.results.map((r: any) => r.item_id) })
})

// 切換完成狀態
apiRoutes.post('/coach/toggle-completion', async (c) => {
  const db = c.env.DB
  const { member_id, item_id, is_completed } = await c.req.json() as any
  if (!member_id || !item_id) return c.json({ error: '缺少參數' }, 400)
  if (is_completed) {
    await db.prepare(`
      INSERT OR IGNORE INTO coach_checklist_completions (id, member_id, item_id, completed_at)
      VALUES (lower(hex(randomblob(8))), ?, ?, datetime('now'))
    `).bind(member_id, item_id).run()
  } else {
    await db.prepare(`DELETE FROM coach_checklist_completions WHERE member_id = ? AND item_id = ?`).bind(member_id, item_id).run()
  }
  return c.json({ success: true })
})

// 新增/更新成員教練狀態
apiRoutes.post('/coach/member-status', async (c) => {
  const db = c.env.DB
  const { member_id, stage } = await c.req.json() as any
  if (!member_id || !stage) return c.json({ error: '缺少參數' }, 400)
  const existing = await db.prepare(`SELECT id FROM coach_member_status WHERE member_id = ?`).bind(member_id).first() as any
  if (existing) {
    await db.prepare(`UPDATE coach_member_status SET current_stage = ?, promoted_at = datetime('now') WHERE member_id = ?`).bind(stage, member_id).run()
  } else {
    await db.prepare(`
      INSERT INTO coach_member_status (id, member_id, current_stage, added_at)
      VALUES (lower(hex(randomblob(8))), ?, ?, datetime('now'))
    `).bind(member_id, stage).run()
  }
  return c.json({ success: true })
})

// 晉升（PUT）
apiRoutes.put('/coach/member-status', async (c) => {
  const db = c.env.DB
  const { member_id, stage } = await c.req.json() as any
  if (!member_id || !stage) return c.json({ error: '缺少參數' }, 400)
  await db.prepare(`UPDATE coach_member_status SET current_stage = ?, promoted_at = datetime('now') WHERE member_id = ?`).bind(stage, member_id).run()
  return c.json({ success: true })
})

// 移除成員教練狀態
apiRoutes.delete('/coach/member-status', async (c) => {
  const db = c.env.DB
  const memberId = c.req.query('member_id')
  if (!memberId) return c.json({ error: '缺少 member_id' }, 400)
  await db.prepare(`DELETE FROM coach_member_status WHERE member_id = ?`).bind(memberId).run()
  return c.json({ success: true })
})

// 新增檢核項目
apiRoutes.post('/coach/checklist-items', async (c) => {
  const db = c.env.DB
  const { stage, description, required_count } = await c.req.json() as any
  if (!stage || !description) return c.json({ error: '缺少參數' }, 400)
  await db.prepare(`
    INSERT INTO coach_checklist_items (id, stage, description, required_count, display_order)
    VALUES (lower(hex(randomblob(8))), ?, ?, ?, 99)
  `).bind(stage, description, required_count || 1).run()
  return c.json({ success: true })
})

// 刪除檢核項目
apiRoutes.delete('/coach/checklist-items/:id', async (c) => {
  const db = c.env.DB
  const id = c.req.param('id')
  await db.prepare(`DELETE FROM coach_checklist_items WHERE id = ?`).bind(id).run()
  return c.json({ success: true })
})

// ==================== 統計 API ====================

apiRoutes.get('/stats', async (c) => {
  const db = c.env.DB
  
  // 各組別人數
  const bySection = await db.prepare(`
    SELECT section, COUNT(*) as count FROM members WHERE membership_status = 'ACTIVE' GROUP BY section
  `).all()
  
  // 總人數
  const total = await db.prepare(`SELECT COUNT(*) as count FROM members WHERE membership_status = 'ACTIVE'`).first()
  
  // 教練團統計
  const coaches = await db.prepare(`
    SELECT coach_level, COUNT(*) as count FROM coach_members GROUP BY coach_level
  `).all()
  
  // 最近進程
  const recentProgress = await db.prepare(`
    SELECT pr.*, m.chinese_name FROM progress_records pr
    JOIN members m ON m.id = pr.member_id
    ORDER BY pr.awarded_at DESC LIMIT 10
  `).all()
  
  return c.json({
    success: true,
    data: {
      totalMembers: (total as any)?.count || 0,
      bySection: bySection.results,
      coaches: coaches.results,
      recentProgress: recentProgress.results
    }
  })
})

// ==================== 分組子頁面 API ====================

// --- 組織架構 ---
apiRoutes.get('/groups/:id/org', async (c) => {
  const db = c.env.DB
  const id = c.req.param('id')
  const org = await db.prepare(`SELECT * FROM group_org_chart WHERE group_id=?`).bind(id).first()
  return c.json({ success: true, data: org || null })
})

apiRoutes.put('/groups/:id/org', async (c) => {
  const db = c.env.DB
  const id = c.req.param('id')
  const { content, image_url } = await c.req.json()
  // upsert
  const existing = await db.prepare(`SELECT id FROM group_org_chart WHERE group_id=?`).bind(id).first()
  if (existing) {
    await db.prepare(`UPDATE group_org_chart SET content=?, image_url=?, updated_at=CURRENT_TIMESTAMP WHERE group_id=?`)
      .bind(content || null, image_url || null, id).run()
  } else {
    await db.prepare(`INSERT INTO group_org_chart (group_id, content, image_url) VALUES (?,?,?)`)
      .bind(id, content || null, image_url || null).run()
  }
  return c.json({ success: true })
})

// --- 幹部管理 ---
apiRoutes.get('/groups/:id/cadres', async (c) => {
  const db = c.env.DB
  const id = c.req.param('id')
  const year = c.req.query('year')
  const isCurrent = c.req.query('current')  // '1' = 現任

  let query = `SELECT * FROM group_cadres WHERE group_id=?`
  const params: any[] = [id]
  if (year) { query += ` AND year_label=?`; params.push(year) }
  if (isCurrent !== undefined) { query += ` AND is_current=?`; params.push(isCurrent === '1' ? 1 : 0) }
  query += ` ORDER BY display_order ASC, id ASC`

  const result = await db.prepare(query).bind(...params).all()
  return c.json({ success: true, data: result.results })
})

apiRoutes.post('/groups/:id/cadres', async (c) => {
  const db = c.env.DB
  const groupId = c.req.param('id')
  const { year_label, role, chinese_name, english_name, photo_url, notes, display_order, is_current } = await c.req.json()
  if (!chinese_name || !role) return c.json({ success: false, error: '姓名和職位為必填' }, 400)

  const result = await db.prepare(`
    INSERT INTO group_cadres (group_id, year_label, role, chinese_name, english_name, photo_url, notes, display_order, is_current)
    VALUES (?,?,?,?,?,?,?,?,?)
  `).bind(groupId, year_label || '115', role, chinese_name, english_name || null, photo_url || null, notes || null, display_order || 0, is_current ? 1 : 0).run()
  return c.json({ success: true, id: result.meta.last_row_id })
})

apiRoutes.put('/cadres/:id', async (c) => {
  const db = c.env.DB
  const id = c.req.param('id')
  const { year_label, role, chinese_name, english_name, photo_url, notes, display_order, is_current } = await c.req.json()
  await db.prepare(`
    UPDATE group_cadres SET year_label=?, role=?, chinese_name=?, english_name=?, photo_url=?, notes=?, display_order=?, is_current=?
    WHERE id=?
  `).bind(year_label || '115', role, chinese_name, english_name || null, photo_url || null, notes || null, display_order || 0, is_current ? 1 : 0, id).run()
  return c.json({ success: true })
})

apiRoutes.delete('/cadres/:id', async (c) => {
  const db = c.env.DB
  const id = c.req.param('id')
  await db.prepare(`DELETE FROM group_cadres WHERE id=?`).bind(id).run()
  return c.json({ success: true })
})

// 批次設定某學年為現任（取消其他學年的現任標記）
apiRoutes.put('/groups/:id/cadres/set-current', async (c) => {
  const db = c.env.DB
  const groupId = c.req.param('id')
  const { year_label } = await c.req.json()
  // 先全部設為歷屆
  await db.prepare(`UPDATE group_cadres SET is_current=0 WHERE group_id=?`).bind(groupId).run()
  // 再將指定學年設為現任
  await db.prepare(`UPDATE group_cadres SET is_current=1 WHERE group_id=? AND year_label=?`).bind(groupId, year_label).run()
  return c.json({ success: true })
})

// --- 歷屆名單 ---
apiRoutes.get('/groups/:id/alumni', async (c) => {
  const db = c.env.DB
  const id = c.req.param('id')
  const year = c.req.query('year')

  let query = `SELECT * FROM group_alumni WHERE group_id=?`
  const params: any[] = [id]
  if (year) { query += ` AND year_label=?`; params.push(year) }
  query += ` ORDER BY year_label DESC, display_order ASC, id ASC`

  const result = await db.prepare(query).bind(...params).all()

  // 按學年分組回傳
  const grouped: Record<string, any[]> = {}
  result.results.forEach((r: any) => {
    if (!grouped[r.year_label]) grouped[r.year_label] = []
    grouped[r.year_label].push(r)
  })
  return c.json({ success: true, data: result.results, grouped })
})

apiRoutes.post('/groups/:id/alumni', async (c) => {
  const db = c.env.DB
  const groupId = c.req.param('id')
  const { year_label, member_name, english_name, unit_name, role_name, rank_level, notes, display_order } = await c.req.json()
  if (!member_name) return c.json({ success: false, error: '姓名為必填' }, 400)

  const result = await db.prepare(`
    INSERT INTO group_alumni (group_id, year_label, member_name, english_name, unit_name, role_name, rank_level, notes, display_order)
    VALUES (?,?,?,?,?,?,?,?,?)
  `).bind(groupId, year_label || '115', member_name, english_name || null, unit_name || null, role_name || null, rank_level || null, notes || null, display_order || 0).run()
  return c.json({ success: true, id: result.meta.last_row_id })
})

// 批次匯入名單（從 members 表）
apiRoutes.post('/groups/:id/alumni/import', async (c) => {
  const db = c.env.DB
  const groupId = c.req.param('id')
  const group = await db.prepare(`SELECT * FROM scout_groups WHERE id=?`).bind(groupId).first() as any
  if (!group) return c.json({ success: false, error: '找不到分組' }, 404)

  const { year_label } = await c.req.json()

  // 根據分組名稱找對應 section
  const sectionMap: Record<string, string> = {
    '童軍團': '童軍', '行義童軍團': '行義童軍', '羅浮童軍群': '羅浮童軍'
  }
  const section = sectionMap[group.name]
  if (!section) return c.json({ success: false, error: '無法對應組別' }, 400)

  const members = await db.prepare(`SELECT * FROM members WHERE section=? AND membership_status='ACTIVE'`).bind(section).all()
  let count = 0
  for (const m of members.results as any[]) {
    const exists = await db.prepare(`SELECT id FROM group_alumni WHERE group_id=? AND year_label=? AND member_name=?`)
      .bind(groupId, year_label, m.chinese_name).first()
    if (!exists) {
      await db.prepare(`INSERT INTO group_alumni (group_id, year_label, member_name, english_name, unit_name, role_name, rank_level) VALUES (?,?,?,?,?,?,?)`)
        .bind(groupId, year_label, m.chinese_name, m.english_name || null, m.unit_name || null, m.role_name || null, m.rank_level || null).run()
      count++
    }
  }
  return c.json({ success: true, imported: count })
})

apiRoutes.put('/alumni/:id', async (c) => {
  const db = c.env.DB
  const id = c.req.param('id')
  const { year_label, member_name, english_name, unit_name, role_name, rank_level, notes, display_order } = await c.req.json()
  await db.prepare(`
    UPDATE group_alumni SET year_label=?, member_name=?, english_name=?, unit_name=?, role_name=?, rank_level=?, notes=?, display_order=?
    WHERE id=?
  `).bind(year_label || '115', member_name, english_name || null, unit_name || null, role_name || null, rank_level || null, notes || null, display_order || 0, id).run()
  return c.json({ success: true })
})

apiRoutes.delete('/alumni/:id', async (c) => {
  const db = c.env.DB
  const id = c.req.param('id')
  await db.prepare(`DELETE FROM group_alumni WHERE id=?`).bind(id).run()
  return c.json({ success: true })
})

// 刪除某學年全部名單
apiRoutes.delete('/groups/:id/alumni/:year', async (c) => {
  const db = c.env.DB
  const { id, year } = c.req.param()
  await db.prepare(`DELETE FROM group_alumni WHERE group_id=? AND year_label=?`).bind(id, year).run()
  return c.json({ success: true })
})

// ==================== 領袖獎項 API ====================

// 取得所有領袖獎項定義
apiRoutes.get('/leader-awards', async (c) => {
  const db = c.env.DB
  const result = await db.prepare(`SELECT * FROM leader_awards ORDER BY level ASC, display_order ASC`).all()
  return c.json({ success: true, data: result.results })
})

// 取得成員的領袖獎項記錄
apiRoutes.get('/leader-awards/member/:memberId', async (c) => {
  const db = c.env.DB
  const memberId = c.req.param('memberId')
  const result = await db.prepare(`
    SELECT mla.*, la.name as award_name, la.category, la.level, la.name_en
    FROM member_leader_awards mla
    JOIN leader_awards la ON la.id = mla.award_id
    WHERE mla.member_id = ?
    ORDER BY la.level ASC
  `).bind(memberId).all()
  return c.json({ success: true, data: result.results })
})

// 新增成員領袖獎項記錄
apiRoutes.post('/leader-awards/member', async (c) => {
  const db = c.env.DB
  const body = await c.req.json()
  const { member_id, award_id, year_label, notes } = body
  if (!member_id || !award_id) return c.json({ success: false, error: '成員和獎項為必填' }, 400)

  const id = `mla-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
  try {
    await db.prepare(`
      INSERT INTO member_leader_awards (id, member_id, award_id, year_label, notes)
      VALUES (?, ?, ?, ?, ?)
    `).bind(id, member_id, award_id, year_label || null, notes || null).run()
    return c.json({ success: true, id })
  } catch (e: any) {
    if (e.message?.includes('UNIQUE')) {
      return c.json({ success: false, error: '此成員已獲得該獎項' }, 409)
    }
    return c.json({ success: false, error: e.message }, 500)
  }
})

// 刪除成員領袖獎項記錄
apiRoutes.delete('/leader-awards/member/:id', async (c) => {
  const db = c.env.DB
  const id = c.req.param('id')
  await db.prepare(`DELETE FROM member_leader_awards WHERE id=?`).bind(id).run()
  return c.json({ success: true })
})

// 批次查詢多位成員的最高獎項（用於榮譽榜）
apiRoutes.get('/leader-awards/summary', async (c) => {
  const db = c.env.DB
  const result = await db.prepare(`
    SELECT m.id, m.chinese_name, m.section, m.unit_name,
      MAX(la.level) as highest_level,
      la.name as highest_award
    FROM members m
    LEFT JOIN member_leader_awards mla ON mla.member_id = m.id
    LEFT JOIN leader_awards la ON la.id = mla.award_id
    WHERE m.membership_status = 'ACTIVE'
    GROUP BY m.id
    ORDER BY highest_level DESC NULLS LAST, m.section, m.chinese_name
  `).all()
  return c.json({ success: true, data: result.results })
})

// ==================== 會員入口 API ====================

// 取得 member session（輔助函數，從 cookie 解碼）
async function getMemberIdFromCookie(c: any): Promise<string | null> {
  const { getCookie } = await import('hono/cookie')
  const session = getCookie(c, 'member_session')
  if (!session) return null
  try {
    // UTF-8 safe Base64 解碼
    const binary = atob(session)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    const decoded = new TextDecoder().decode(bytes)
    const data = JSON.parse(decoded)
    if (!data.memberId || !data.exp || Date.now() > data.exp) return null
    return data.memberId
  } catch { return null }
}

// 取得目前登入的成員資料
apiRoutes.get('/member/profile', async (c) => {
  const db = c.env.DB
  const memberId = await getMemberIdFromCookie(c)
  if (!memberId) return c.json({ success: false, error: '未登入' }, 401)

  const member = await db.prepare(`SELECT * FROM members WHERE id = ?`).bind(memberId).first() as any
  if (!member) return c.json({ success: false, error: '找不到成員資料' }, 404)

  // 取得今年在籍資料（含小隊、職位）
  const yearSetting = await db.prepare(`SELECT value FROM site_settings WHERE key='current_year_label'`).first() as any
  const currentYear = yearSetting?.value || '114'
  const enrollment = await db.prepare(`
    SELECT * FROM member_enrollments WHERE member_id=? AND year_label=? AND is_active=1
  `).bind(memberId, currentYear).first() as any

  // 取得進程記錄
  const progress = await db.prepare(`
    SELECT * FROM progress_records WHERE member_id=? ORDER BY awarded_at DESC LIMIT 20
  `).bind(memberId).all()

  return c.json({
    success: true,
    data: {
      ...member,
      current_year: currentYear,
      enrollment: enrollment || null,
      // 年度在籍資料優先，否則使用 members 主表的資料
      display_section: enrollment?.section || member.section,
      display_unit: enrollment?.unit_name || member.unit_name,
      display_rank: enrollment?.rank_level || member.rank_level,
      display_role: enrollment?.role_name || member.role_name,
      progress: progress.results
    }
  })
})

// 取得目前登入成員的出席記錄
apiRoutes.get('/member/attendance', async (c) => {
  const db = c.env.DB
  const memberId = await getMemberIdFromCookie(c)
  if (!memberId) return c.json({ success: false, error: '未登入' }, 401)

  const yearSetting = await db.prepare(`SELECT value FROM site_settings WHERE key='current_year_label'`).first() as any
  const currentYear = yearSetting?.value || '114'
  const year = c.req.query('year') || currentYear

  // 取得出席記錄（JOIN attendance_sessions 以獲取日期和標題）
  const records = await db.prepare(`
    SELECT ar.status, ar.note,
      ats.id as session_id, ats.title, ats.date, ats.section, ats.topic, ats.submitted
    FROM attendance_records ar
    JOIN attendance_sessions ats ON ats.id = ar.session_id
    WHERE ar.member_id = ?
    ORDER BY ats.date DESC
  `).bind(memberId).all()

  // 統計
  const all = records.results as any[]
  const total = all.length
  const present = all.filter(r => r.status === 'present').length
  const absent = all.filter(r => r.status === 'absent').length
  const leave = all.filter(r => r.status === 'leave').length
  const late = all.filter(r => r.status === 'late').length

  return c.json({
    success: true,
    data: {
      records: all,
      stats: { total, present, absent, leave, late,
        rate: total > 0 ? Math.round(present / total * 100) : 0 }
    }
  })
})

// 請假申請 API
// ===================== 會員修改密碼 =====================
apiRoutes.put('/member/password', async (c) => {
  const db = c.env.DB
  const memberId = await getMemberIdFromCookie(c)
  if (!memberId) return c.json({ success: false, error: '未登入' }, 401)

  try {
    const { old_password, new_password } = await c.req.json()
    if (!old_password || !new_password) return c.json({ success: false, error: '請提供舊密碼與新密碼' }, 400)
    if (new_password.length < 6) return c.json({ success: false, error: '新密碼長度至少需6位數' }, 400)

    const user = await db.prepare(`SELECT id, password_hash FROM member_accounts WHERE member_id = ?`).bind(memberId).first()
    if (!user) return c.json({ success: false, error: '找不到使用者帳號' }, 404)

    const oldHash = await sha256(old_password)
    if (oldHash !== user.password_hash) {
      return c.json({ success: false, error: '舊密碼錯誤' }, 403)
    }

    const newHash = await sha256(new_password)
    await db.prepare(`UPDATE member_accounts SET password_hash = ? WHERE member_id = ?`).bind(newHash, memberId).run()

    return c.json({ success: true, message: '密碼已成功修改' })
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500)
  }
})

apiRoutes.post('/member/leave', async (c) => {
  const db = c.env.DB
  const memberId = await getMemberIdFromCookie(c)
  if (!memberId) return c.json({ success: false, error: '未登入' }, 401)

  const body = await c.req.json()
  const { leave_type, session_id, date, reason } = body
  if (!date) return c.json({ success: false, error: '請填寫請假日期' }, 400)

  // 檢查是否已有相同申請
  if (session_id) {
    const existing = await db.prepare(`
      SELECT id FROM leave_requests WHERE member_id = ? AND session_id = ?
    `).bind(memberId, session_id).first()
    if (existing) return c.json({ success: false, error: '此例會已有請假申請' }, 409)
  }

  const id = `lr-${Date.now()}-${Math.random().toString(36).substring(2,7)}`
  await db.prepare(`
    INSERT INTO leave_requests (id, member_id, session_id, leave_type, reason, date, status)
    VALUES (?, ?, ?, ?, ?, ?, 'pending')
  `).bind(id, memberId, session_id || null, leave_type || 'personal', reason || null, date).run()

  return c.json({ success: true, id })
})

// 取消請假申請
apiRoutes.delete('/member/leave/:id', async (c) => {
  const db = c.env.DB
  const memberId = await getMemberIdFromCookie(c)
  if (!memberId) return c.json({ success: false, error: '未登入' }, 401)
  const id = c.req.param('id')
  const leave = await db.prepare(`SELECT * FROM leave_requests WHERE id = ? AND member_id = ?`).bind(id, memberId).first() as any
  if (!leave) return c.json({ success: false, error: '找不到申請' }, 404)
  if (leave.status === 'approved') return c.json({ success: false, error: '已核准的申請無法取消' }, 400)
  await db.prepare(`DELETE FROM leave_requests WHERE id = ?`).bind(id).run()
  return c.json({ success: true })
})

// 晉升申請 API
apiRoutes.post('/member/advancement', async (c) => {
  const db = c.env.DB
  const memberId = await getMemberIdFromCookie(c)
  if (!memberId) return c.json({ success: false, error: '未登入' }, 401)

  const body = await c.req.json()
  const { rank_from, rank_to, apply_date } = body
  if (!rank_from || !rank_to) return c.json({ success: false, error: '請填寫晉升資訊' }, 400)

  const member = await db.prepare(`SELECT section FROM members WHERE id = ?`).bind(memberId).first() as any
  if (!member) return c.json({ success: false, error: '找不到成員' }, 404)

  // 檢查是否已有進行中的申請
  const existing = await db.prepare(`
    SELECT id FROM advancement_applications WHERE member_id = ? AND status IN ('pending','reviewing')
  `).bind(memberId).first()
  if (existing) return c.json({ success: false, error: '已有進行中的晉升申請，請等待審核完成' }, 409)

  const id = `adv-${Date.now()}-${Math.random().toString(36).substring(2,7)}`
  await db.prepare(`
    INSERT INTO advancement_applications (id, member_id, section, rank_from, rank_to, apply_date, status)
    VALUES (?, ?, ?, ?, ?, ?, 'pending')
  `).bind(id, memberId, member.section, rank_from, rank_to, apply_date || new Date().toISOString().slice(0,10)).run()

  return c.json({ success: true, id })
})

// 提交晉升條件進度
apiRoutes.post('/member/advancement-progress', async (c) => {
  const db = c.env.DB
  const memberId = await getMemberIdFromCookie(c)
  if (!memberId) return c.json({ success: false, error: '未登入' }, 401)

  const body = await c.req.json()
  const { requirement_id, achieved_count, evidence_note } = body
  if (!requirement_id) return c.json({ success: false, error: '缺少條件 ID' }, 400)

  const id = `ap-${Date.now()}-${Math.random().toString(36).substring(2,7)}`
  await db.prepare(`
    INSERT INTO advancement_progress (id, member_id, requirement_id, achieved_count, evidence_note, status)
    VALUES (?, ?, ?, ?, ?, 'submitted')
    ON CONFLICT(member_id, requirement_id) DO UPDATE SET
      achieved_count = excluded.achieved_count,
      evidence_note = excluded.evidence_note,
      status = 'submitted',
      submitted_at = CURRENT_TIMESTAMP
  `).bind(id, memberId, requirement_id, achieved_count || 0, evidence_note || null).run()

  return c.json({ success: true })
})

// ==================== 管理員：請假審核 API ====================

// 取得所有請假申請（含成員名稱）
apiRoutes.get('/admin/leaves', async (c) => {
  const db = c.env.DB
  const status = c.req.query('status')
  let query = `
    SELECT lr.*, m.chinese_name, m.section,
      COALESCE(as2.title, '自訂') as session_title, as2.date as session_date
    FROM leave_requests lr
    JOIN members m ON m.id = lr.member_id
    LEFT JOIN attendance_sessions as2 ON as2.id = lr.session_id
  `
  const params: any[] = []
  if (status) { query += ` WHERE lr.status = ?`; params.push(status) }
  query += ` ORDER BY lr.created_at DESC LIMIT 100`
  const result = await db.prepare(query).bind(...params).all()
  return c.json({ success: true, data: result.results })
})

// 審核請假申請（核准/拒絕）
apiRoutes.put('/admin/leaves/:id', async (c) => {
  const db = c.env.DB
  const id = c.req.param('id')
  const body = await c.req.json()
  const { status, admin_note } = body
  if (!['approved','rejected','pending'].includes(status)) {
    return c.json({ success: false, error: '無效的狀態' }, 400)
  }
  await db.prepare(`
    UPDATE leave_requests SET
      status = ?, admin_note = ?,
      approved_at = CASE WHEN ? = 'approved' THEN CURRENT_TIMESTAMP ELSE NULL END,
      approved_by = ?
    WHERE id = ?
  `).bind(status, admin_note || null, status, 'admin', id).run()
  return c.json({ success: true })
})

// ==================== 管理員：晉升申請審核 ====================

// 取得所有晉升申請
apiRoutes.get('/admin/advancement', async (c) => {
  const db = c.env.DB
  const status = c.req.query('status')
  let query = `
    SELECT aa.*, m.chinese_name, m.section, m.rank_level
    FROM advancement_applications aa
    JOIN members m ON m.id = aa.member_id
  `
  const params: any[] = []
  if (status) { query += ` WHERE aa.status = ?`; params.push(status) }
  query += ` ORDER BY aa.created_at DESC LIMIT 100`
  const result = await db.prepare(query).bind(...params).all()
  return c.json({ success: true, data: result.results })
})

// 審核晉升申請
apiRoutes.put('/admin/advancement/:id', async (c) => {
  const db = c.env.DB
  const id = c.req.param('id')
  const body = await c.req.json()
  const { status, admin_notes } = body
  if (!['pending','reviewing','approved','rejected'].includes(status)) {
    return c.json({ success: false, error: '無效的狀態' }, 400)
  }

  await db.prepare(`
    UPDATE advancement_applications SET
      status = ?, admin_notes = ?, reviewed_by = 'admin',
      reviewed_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).bind(status, admin_notes || null, id).run()

  // 如果核准，更新成員的 rank_level
  if (status === 'approved') {
    const app = await db.prepare(`SELECT * FROM advancement_applications WHERE id = ?`).bind(id).first() as any
    if (app) {
      await db.prepare(`UPDATE members SET rank_level = ? WHERE id = ?`).bind(app.rank_to, app.member_id).run()
    }
  }
  return c.json({ success: true })
})

// ==================== 專科章 API ====================

// 取得所有專科章定義
apiRoutes.get('/specialty-badges', async (c) => {
  const db = c.env.DB
  const category = c.req.query('category')
  let query = `SELECT * FROM specialty_badges WHERE is_active = 1`
  const params: any[] = []
  if (category) { query += ` AND category = ?`; params.push(category) }
  query += ` ORDER BY category, display_order, name`
  const result = await db.prepare(query).bind(...params).all()
  return c.json({ success: true, data: result.results })
})

// 新增專科章
apiRoutes.post('/specialty-badges', async (c) => {
  const db = c.env.DB
  const body = await c.req.json()
  const { name, category, image_url, description, display_order } = body
  if (!name) return c.json({ success: false, error: '名稱為必填' }, 400)
  
  const result = await db.prepare(`
    INSERT INTO specialty_badges (name, category, image_url, description, display_order)
    VALUES (?, ?, ?, ?, ?)
  `).bind(name, category || '其他', image_url || null, description || null, display_order || 0).run()
  
  return c.json({ success: true, id: result.meta.last_row_id })
})

// 更新專科章
apiRoutes.put('/specialty-badges/:id', async (c) => {
  const db = c.env.DB
  const id = c.req.param('id')
  const body = await c.req.json()
  const { name, category, image_url, description, display_order, is_active } = body
  
  await db.prepare(`
    UPDATE specialty_badges SET 
      name=?, category=?, image_url=?, description=?, display_order=?, is_active=?
    WHERE id=?
  `).bind(name, category || '其他', image_url || null, description || null, display_order || 0, is_active ?? 1, id).run()
  
  return c.json({ success: true })
})

// 刪除專科章 (軟刪除)
apiRoutes.delete('/specialty-badges/:id', async (c) => {
  const db = c.env.DB
  const id = c.req.param('id')
  await db.prepare(`UPDATE specialty_badges SET is_active=0 WHERE id=?`).bind(id).run()
  return c.json({ success: true })
})

// ==================== 學員專科章與進程擴充 API ====================

// 快速切換進程標準完成狀態 (Toggle)
apiRoutes.post('/members/:id/toggle-requirement', async (c) => {
  const db = c.env.DB
  const memberId = c.req.param('id')
  const { requirement_id, completed } = await c.req.json()
  
  if (completed) {
    // 標記為完成 (achieved_count = required_count, status = approved)
    const req = await db.prepare(`SELECT required_count FROM advancement_requirements WHERE id = ?`).bind(requirement_id).first() as any
    const count = req?.required_count || 1
    
    await db.prepare(`
      INSERT INTO advancement_progress (id, member_id, requirement_id, achieved_count, status, reviewed_at, reviewed_by)
      VALUES (?, ?, ?, ?, 'approved', CURRENT_TIMESTAMP, 'admin')
      ON CONFLICT(member_id, requirement_id) DO UPDATE SET
        achieved_count = ?,
        status = 'approved',
        reviewed_at = CURRENT_TIMESTAMP,
        reviewed_by = 'admin'
    `).bind(`ap-${Date.now()}`, memberId, requirement_id, count, count).run()
  } else {
    // 標記為未完成 (刪除紀錄或歸零)
    await db.prepare(`DELETE FROM advancement_progress WHERE member_id = ? AND requirement_id = ?`).bind(memberId, requirement_id).run()
  }
  return c.json({ success: true })
})

// 快速切換專科章狀態 (Toggle)
apiRoutes.post('/members/:id/toggle-badge', async (c) => {
  const db = c.env.DB
  const memberId = c.req.param('id')
  const { badge_id, obtained } = await c.req.json()
  
  if (obtained) {
    // 新增 (如果不存在)
    try {
      await db.prepare(`
        INSERT INTO member_specialty_badges (member_id, badge_id, obtained_date, examiner)
        VALUES (?, ?, ?, '團長')
      `).bind(memberId, badge_id, new Date().toISOString().slice(0,10)).run()
    } catch (e:any) {
      if (!e.message.includes('UNIQUE')) throw e
    }
  } else {
    // 移除
    await db.prepare(`DELETE FROM member_specialty_badges WHERE member_id = ? AND badge_id = ?`).bind(memberId, badge_id).run()
  }
  return c.json({ success: true })
})

// 取得學員的專科章
apiRoutes.get('/members/:id/badges', async (c) => {
  const db = c.env.DB
  const memberId = c.req.param('id')
  const result = await db.prepare(`
    SELECT msb.*, sb.name, sb.category, sb.image_url
    FROM member_specialty_badges msb
    JOIN specialty_badges sb ON sb.id = msb.badge_id
    WHERE msb.member_id = ?
    ORDER BY sb.category, sb.display_order
  `).bind(memberId).all()
  return c.json({ success: true, data: result.results })
})

// 新增學員專科章紀錄
apiRoutes.post('/members/:id/badges', async (c) => {
  const db = c.env.DB
  const memberId = c.req.param('id')
  const body = await c.req.json()
  const { badge_id, obtained_date, examiner, notes } = body
  
  if (!badge_id) return c.json({ success: false, error: '未選擇專科章' }, 400)
  
  try {
    const result = await db.prepare(`
      INSERT INTO member_specialty_badges (member_id, badge_id, obtained_date, examiner, notes)
      VALUES (?, ?, ?, ?, ?)
    `).bind(memberId, badge_id, obtained_date || new Date().toISOString().slice(0,10), examiner || null, notes || null).run()
    return c.json({ success: true, id: result.meta.last_row_id })
  } catch (e: any) {
    if (e.message.includes('UNIQUE')) return c.json({ success: false, error: '該學員已擁有此專科章' }, 409)
    return c.json({ success: false, error: e.message }, 500)
  }
})

// 刪除學員專科章紀錄
apiRoutes.delete('/members/:id/badges/:badgeRecordId', async (c) => {
  const db = c.env.DB
  const { id, badgeRecordId } = c.req.param()
  await db.prepare(`DELETE FROM member_specialty_badges WHERE id = ? AND member_id = ?`).bind(badgeRecordId, id).run()
  return c.json({ success: true })
})

// 管理員直接晉升 (新增進程紀錄)
apiRoutes.post('/admin/members/:id/promote', async (c) => {
  const db = c.env.DB
  const memberId = c.req.param('id')
  const body = await c.req.json()
  const { rank_to, approved_date, notes } = body
  
  if (!rank_to) return c.json({ success: false, error: '目標階級為必填' }, 400)
  
  const id = `pr-adm-${Date.now()}`
  const date = approved_date || new Date().toISOString().slice(0,10)
  
  // 1. 新增進程紀錄
  await db.prepare(`
    INSERT INTO progress_records (id, member_id, record_type, award_name, awarded_at, notes)
    VALUES (?, ?, 'rank', ?, ?, ?)
  `).bind(id, memberId, rank_to, date, notes || '團長直接晉升').run()
  
  // 2. 更新學員目前階級 (如果日期比現在新，可能不更新? 但通常是補登，所以直接更新)
  // 只有當新階級的順序高於目前階級時才更新 (這裡簡化處理，直接更新為最新操作的階級)
  await db.prepare(`UPDATE members SET rank_level = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
    .bind(rank_to, memberId).run()
    
  // 3. 如果有待審核的相關申請，一併結案
  await db.prepare(`
    UPDATE advancement_applications SET status='approved', reviewed_by='admin', reviewed_at=CURRENT_TIMESTAMP
    WHERE member_id=? AND rank_to=? AND status IN ('pending', 'reviewing')
  `).bind(memberId, rank_to).run()
  
  return c.json({ success: true })
})

// 更新進程紀錄日期 (補登修正)
apiRoutes.put('/admin/progress-records/:id', async (c) => {
  const db = c.env.DB
  const id = c.req.param('id')
  const body = await c.req.json()
  const { awarded_at } = body
  
  await db.prepare(`UPDATE progress_records SET awarded_at=? WHERE id=?`).bind(awarded_at, id).run()
  return c.json({ success: true })
})

// ==================== 管理員：晉升條件管理 ====================

// 取得晉升條件 (支援版本)
apiRoutes.get('/admin/advancement-requirements', async (c) => {
  const db = c.env.DB
  const section = c.req.query('section')
  const version = c.req.query('version_year') // 支援版本篩選
  
  // 預設抓最新版本 (如果沒傳 version)
  // 但為了後台管理方便，如果沒傳 version 應該列出所有？或者預設 113？
  // 這裡邏輯：如果有傳 version 就篩選，沒傳就抓所有 active 的
  
  let query = `SELECT * FROM advancement_requirements WHERE is_active = 1`
  const params: any[] = []
  if (section) { query += ` AND section = ?`; params.push(section) }
  if (version) { query += ` AND version_year = ?`; params.push(version) }
  
  query += ` ORDER BY version_year DESC, section, rank_from, display_order`
  const result = await db.prepare(query).bind(...params).all()
  return c.json({ success: true, data: result.results })
})

// 新增晉升條件 (支援版本)
apiRoutes.post('/admin/advancement-requirements', async (c) => {
  const db = c.env.DB
  const body = await c.req.json()
  const { section, rank_from, rank_to, requirement_type, title, description, required_count, unit, is_mandatory, display_order, version_year } = body
  if (!section || !rank_to || !title) {
    return c.json({ success: false, error: '缺少必填欄位（需要 section, rank_to, title）' }, 400)
  }
  const id = `req-${Date.now()}-${Math.random().toString(36).substring(2,7)}`
  await db.prepare(`
    INSERT INTO advancement_requirements (id, section, rank_from, rank_to, requirement_type, title, description, required_count, unit, is_mandatory, display_order, version_year)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(id, section, rank_from, rank_to, requirement_type || 'other', title, description || null,
    required_count || 1, unit || '次', is_mandatory !== false ? 1 : 0, display_order || 0, version_year || '113').run()
  return c.json({ success: true, id })
})

// 更新晉升條件 (支援版本)
apiRoutes.put('/admin/advancement-requirements/:id', async (c) => {
  const db = c.env.DB
  const id = c.req.param('id')
  const body = await c.req.json()
  const { title, description, required_count, unit, is_mandatory, display_order, is_active, version_year } = body
  await db.prepare(`
    UPDATE advancement_requirements SET
      title = ?, description = ?, required_count = ?, unit = ?,
      is_mandatory = ?, display_order = ?, is_active = ?, version_year = ?
    WHERE id = ?
  `).bind(title, description || null, required_count || 1, unit || '次',
    is_mandatory !== false ? 1 : 0, display_order || 0, is_active !== false ? 1 : 0, version_year || '113', id).run()
  return c.json({ success: true })
})

// 刪除晉升條件（軟刪除）
apiRoutes.delete('/admin/advancement-requirements/:id', async (c) => {
  const db = c.env.DB
  const id = c.req.param('id')
  await db.prepare(`UPDATE advancement_requirements SET is_active = 0 WHERE id = ?`).bind(id).run()
  return c.json({ success: true })
})

// 複製進程標準 (從舊版本複製到新版本)
apiRoutes.post('/admin/advancement-requirements/clone', async (c) => {
  const db = c.env.DB
  const body = await c.req.json()
  const { from_version, to_version, section } = body 

  if (!from_version || !to_version) return c.json({ success: false, error: '請指定來源與目標版本' }, 400)
  if (from_version === to_version) return c.json({ success: false, error: '來源與目標版本不能相同' }, 400)

  let copyQuery = `
    INSERT INTO advancement_requirements (
      id, section, rank_from, rank_to, requirement_type, title, description, 
      required_count, unit, is_mandatory, display_order, version_year, is_active
    )
    SELECT 
      'req-' || hex(randomblob(4)) || '-' || strftime('%s','now') || rowid, 
      section, rank_from, rank_to, requirement_type, title, description, 
      required_count, unit, is_mandatory, display_order, ?, 1
    FROM advancement_requirements
    WHERE version_year = ? AND is_active = 1
  `
  const copyParams: any[] = [to_version, from_version]
  if (section) { copyQuery += ` AND section = ?`; copyParams.push(section) }

  const result = await db.prepare(copyQuery).bind(...copyParams).run()
  return c.json({ success: true, copied_count: result.meta.changes })
})

// 取得成員帳號列表
apiRoutes.get('/admin/member-accounts', async (c) => {
  const db = c.env.DB
  const result = await db.prepare(`
    SELECT ma.id, ma.username, ma.is_active, ma.last_login, ma.created_at,
      m.chinese_name, m.section, m.rank_level
    FROM member_accounts ma
    JOIN members m ON m.id = ma.member_id
    ORDER BY m.section, m.chinese_name
  `).all()
  return c.json({ success: true, data: result.results })
})

// 建立/更新成員帳號
apiRoutes.post('/admin/member-accounts/batch', async (c) => {
  const db = c.env.DB
  const body = await c.req.json()
  const { accounts } = body // [{ member_id, username, password }]
  
  if (!accounts || !Array.isArray(accounts)) {
    return c.json({ success: false, error: '資料格式錯誤' }, 400)
  }

  let successCount = 0;
  let errorCount = 0;
  const errors = [];

  for (const acc of accounts) {
    if (!acc.member_id || !acc.username || !acc.password) {
      errorCount++;
      errors.push(`${acc.username || '未知'}: 缺少必填欄位`);
      continue;
    }
    try {
      const hash = await sha256(acc.password);
      const id = `acc-${Date.now()}-${Math.random().toString(36).substring(2,7)}`;
      await db.prepare(`
        INSERT INTO member_accounts (id, member_id, username, password_hash, is_active)
        VALUES (?, ?, ?, ?, 1)
      `).bind(id, acc.member_id, acc.username.toLowerCase(), hash).run();
      successCount++;
    } catch (e: any) {
      errorCount++;
      errors.push(`${acc.username}: ${e.message}`);
    }
  }

  return c.json({ success: true, successCount, errorCount, errors })
})

apiRoutes.post('/admin/member-accounts', async (c) => {
  const db = c.env.DB
  const body = await c.req.json()
  const { member_id, username, password } = body
  if (!member_id || !username || !password) {
    return c.json({ success: false, error: '缺少必填欄位' }, 400)
  }
  const hash = await (async () => {
    const msgBuffer = new TextEncoder().encode(password)
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
  })()
  const id = `acc-${Date.now()}-${Math.random().toString(36).substring(2,7)}`
  try {
    await db.prepare(`
      INSERT INTO member_accounts (id, member_id, username, password_hash, is_active)
      VALUES (?, ?, ?, ?, 1)
    `).bind(id, member_id, username.toLowerCase(), hash).run()
    return c.json({ success: true, id })
  } catch (e: any) {
    if (e.message?.includes('UNIQUE')) return c.json({ success: false, error: '帳號已存在' }, 409)
    return c.json({ success: false, error: e.message }, 500)
  }
})

// 重設密碼
apiRoutes.put('/admin/member-accounts/:id/password', async (c) => {
  const db = c.env.DB
  const id = c.req.param('id')
  const body = await c.req.json()
  const { password } = body
  if (!password) return c.json({ success: false, error: '請提供新密碼' }, 400)
  const hash = await (async () => {
    const msgBuffer = new TextEncoder().encode(password)
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
  })()
  await db.prepare(`UPDATE member_accounts SET password_hash = ? WHERE id = ?`).bind(hash, id).run()
  return c.json({ success: true })
})

// 啟用/停用帳號
apiRoutes.put('/admin/member-accounts/:id/status', async (c) => {
  const db = c.env.DB
  const id = c.req.param('id')
  const body = await c.req.json()
  await db.prepare(`UPDATE member_accounts SET is_active = ? WHERE id = ?`).bind(body.is_active ? 1 : 0, id).run()
  return c.json({ success: true })
})

// =====================================================================
// 公假申請系統 API (Official Leave System)
// =====================================================================

// --- Helper: 判斷日期是否開放申請 ---
async function isOfficialLeaveDateAllowed(db: any, dateStr: string): Promise<{ allowed: boolean; reason?: string }> {
  // 取得學期設定
  const settings = await db.prepare(`
    SELECT key, value FROM site_settings WHERE key IN (
      'official_leave_semester_start','official_leave_semester_end','official_leave_allowed_weekdays'
    )
  `).all()
  const sMap: Record<string, string> = {}
  settings.results.forEach((r: any) => { sMap[r.key] = r.value })

  const start = sMap['official_leave_semester_start'] || ''
  const end   = sMap['official_leave_semester_end'] || ''
  const allowedDays: number[] = sMap['official_leave_allowed_weekdays']
    ? JSON.parse(sMap['official_leave_allowed_weekdays']) : [1,2,3,4,5]

  if (start && (dateStr < start || dateStr > end)) {
    return { allowed: false, reason: '此日期不在學期範圍內' }
  }
  const dow = new Date(dateStr + 'T12:00:00').getDay()
  if (!allowedDays.includes(dow)) {
    return { allowed: false, reason: '此星期幾未開放申請' }
  }
  // 檢查是否封鎖
  const blocked = await db.prepare(`
    SELECT id FROM leave_calendar_events WHERE date = ? AND type = 'blocked'
  `).bind(dateStr).first()
  if (blocked) {
    return { allowed: false, reason: '此日期已封鎖，暫停申請' }
  }
  return { allowed: true }
}

// GET /api/official-leave/settings  — 取得學期設定 + 每週例行規則
apiRoutes.get('/official-leave/settings', async (c) => {
  const db = c.env.DB
  const rows = await db.prepare(`
    SELECT key, value FROM site_settings WHERE key LIKE 'official_leave%'
  `).all()
  const map: Record<string, any> = {}
  rows.results.forEach((r: any) => {
    let v = r.value
    try { v = JSON.parse(v) } catch {}
    map[r.key] = v
  })
  return c.json({ success: true, data: {
    semesterStart: map['official_leave_semester_start'] || '',
    semesterEnd:   map['official_leave_semester_end'] || '',
    allowedWeekdays: map['official_leave_allowed_weekdays'] || [1,2,3,4,5],
    recurringRules: map['official_leave_recurring_rules'] || []
  }})
})

// GET /api/official-leave/calendar-events  — 取得行事曆事件
apiRoutes.get('/official-leave/calendar-events', async (c) => {
  const db = c.env.DB
  const start = c.req.query('start')
  const end   = c.req.query('end')
  let q = `SELECT * FROM leave_calendar_events WHERE 1=1`
  const params: any[] = []
  if (start) { q += ` AND date >= ?`; params.push(start) }
  if (end)   { q += ` AND date <= ?`; params.push(end) }
  q += ` ORDER BY date`
  const result = await db.prepare(q).bind(...params).all()
  return c.json({ success: true, data: result.results })
})

// GET /api/official-leave/approved  — 取得已核准公假清單（含成員資訊，供行事曆顯示）
apiRoutes.get('/official-leave/approved', async (c) => {
  const db = c.env.DB
  const start = c.req.query('start')
  const end   = c.req.query('end')
  let q = `
    SELECT ola.id, ola.member_id, ola.leave_date, ola.timeslots, ola.status,
      m.chinese_name, m.section
    FROM official_leave_applications ola
    JOIN members m ON m.id = ola.member_id
    WHERE ola.status = 'approved'
  `
  const params: any[] = []
  if (start) { q += ` AND ola.leave_date >= ?`; params.push(start) }
  if (end)   { q += ` AND ola.leave_date <= ?`; params.push(end) }
  q += ` ORDER BY ola.leave_date`
  const result = await db.prepare(q).bind(...params).all()
  return c.json({ success: true, data: result.results.map((r: any) => ({
    ...r,
    timeslots: (() => { try { return JSON.parse(r.timeslots) } catch { return [] } })()
  }))})
})

// GET /api/official-leave/check-date?date=YYYY-MM-DD  — 檢查日期是否可申請
apiRoutes.get('/official-leave/check-date', async (c) => {
  const db = c.env.DB
  const date = c.req.query('date')
  if (!date) return c.json({ success: false, error: '缺少 date 參數' }, 400)
  const result = await isOfficialLeaveDateAllowed(db, date)
  return c.json({ success: true, ...result })
})

// POST /api/official-leave  — 提交公假申請（需登入）
apiRoutes.post('/official-leave', async (c) => {
  const db = c.env.DB
  // 驗證 member session
  const cookieHeader = c.req.header('cookie') || ''
  const sessionMatch = cookieHeader.match(/member_session=([^;]+)/)
  if (!sessionMatch) return c.json({ success: false, error: '請先登入' }, 401)

  let session: any
  try {
    const raw = atob(decodeURIComponent(sessionMatch[1]))
    session = JSON.parse(raw)
    if (session.exp < Date.now()) return c.json({ success: false, error: '登入已過期' }, 401)
  } catch {
    return c.json({ success: false, error: '登入已過期，請重新登入' }, 401)
  }

  const body = await c.req.json()
  const { member_id, leave_date, timeslots, reason, is_conflict_checked, is_teacher_informed } = body

  // 驗證必填
  if (!member_id || !leave_date || !timeslots || timeslots.length === 0) {
    return c.json({ success: false, error: '缺少必填欄位' }, 400)
  }
  if (!is_conflict_checked || !is_teacher_informed) {
    return c.json({ success: false, error: '請確認不衝突並已告知導師' }, 400)
  }

  // 確認申請者是本人（或 admin 可代申請）
  if (session.memberId !== member_id) {
    return c.json({ success: false, error: '只能為自己申請公假' }, 403)
  }

  // 檢查日期是否開放
  const check = await isOfficialLeaveDateAllowed(db, leave_date)
  if (!check.allowed) {
    return c.json({ success: false, error: check.reason || '此日期不開放申請' }, 400)
  }

  // 確認同一日期沒有重複申請（pending 或 approved）
  const dup = await db.prepare(`
    SELECT id FROM official_leave_applications
    WHERE member_id = ? AND leave_date = ? AND status IN ('pending','approved')
  `).bind(member_id, leave_date).first()
  if (dup) {
    return c.json({ success: false, error: '您已申請過此日期的公假' }, 400)
  }

  const id = `lv-${Date.now()}-${Math.random().toString(36).substring(2,7)}`
  await db.prepare(`
    INSERT INTO official_leave_applications
      (id, member_id, leave_date, timeslots, reason, is_conflict_checked, is_teacher_informed, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')
  `).bind(id, member_id, leave_date, JSON.stringify(timeslots), reason || null,
    is_conflict_checked ? 1 : 0, is_teacher_informed ? 1 : 0).run()

  return c.json({ success: true, id })
})

// GET /api/official-leave/my  — 取得自己的公假申請記錄
apiRoutes.get('/official-leave/my', async (c) => {
  const db = c.env.DB
  const cookieHeader = c.req.header('cookie') || ''
  const sessionMatch = cookieHeader.match(/member_session=([^;]+)/)
  if (!sessionMatch) return c.json({ success: false, error: '請先登入' }, 401)
  let session: any
  try {
    const raw = atob(decodeURIComponent(sessionMatch[1]))
    session = JSON.parse(raw)
    if (session.exp < Date.now()) return c.json({ success: false, error: '登入已過期' }, 401)
  } catch {
    return c.json({ success: false, error: '登入已過期' }, 401)
  }
  const result = await db.prepare(`
    SELECT id, leave_date, timeslots, reason, status, is_conflict_checked, is_teacher_informed,
      admin_note, created_at
    FROM official_leave_applications
    WHERE member_id = ?
    ORDER BY leave_date DESC
  `).bind(session.memberId).all()
  return c.json({ success: true, data: result.results.map((r: any) => ({
    ...r,
    timeslots: (() => { try { return JSON.parse(r.timeslots) } catch { return [] } })()
  }))})
})

// DELETE /api/official-leave/:id  — 取消自己的申請（只能取消 pending 狀態）
apiRoutes.delete('/official-leave/:id', async (c) => {
  const db = c.env.DB
  const cookieHeader = c.req.header('cookie') || ''
  const sessionMatch = cookieHeader.match(/member_session=([^;]+)/)
  if (!sessionMatch) return c.json({ success: false, error: '請先登入' }, 401)
  let session: any
  try {
    const raw = atob(decodeURIComponent(sessionMatch[1]))
    session = JSON.parse(raw)
  } catch { return c.json({ success: false, error: '登入已過期' }, 401) }

  const id = c.req.param('id')
  const app = await db.prepare(`SELECT * FROM official_leave_applications WHERE id = ?`).bind(id).first() as any
  if (!app) return c.json({ success: false, error: '申請記錄不存在' }, 404)
  if (app.member_id !== session.memberId) return c.json({ success: false, error: '無權限取消此申請' }, 403)
  if (app.status !== 'pending') return c.json({ success: false, error: '只能取消待審核的申請' }, 400)

  await db.prepare(`DELETE FROM official_leave_applications WHERE id = ?`).bind(id).run()
  return c.json({ success: true })
})

// ===== 後台公假管理 API =====

// GET /api/admin/official-leave  — 取得所有公假申請（後台用）
apiRoutes.get('/admin/official-leave', async (c) => {
  const db = c.env.DB
  const status = c.req.query('status') || ''
  let q = `
    SELECT ola.*, m.chinese_name, m.section, m.unit_name
    FROM official_leave_applications ola
    JOIN members m ON m.id = ola.member_id
    WHERE 1=1
  `
  const params: any[] = []
  if (status) { q += ` AND ola.status = ?`; params.push(status) }
  q += ` ORDER BY ola.leave_date DESC, ola.created_at DESC`
  const result = await db.prepare(q).bind(...params).all()
  return c.json({ success: true, data: result.results.map((r: any) => ({
    ...r,
    timeslots: (() => { try { return JSON.parse(r.timeslots) } catch { return [] } })()
  }))})
})

// PUT /api/admin/official-leave/:id  — 審核公假申請
apiRoutes.put('/admin/official-leave/:id', async (c) => {
  const db = c.env.DB
  const id = c.req.param('id')
  const body = await c.req.json()
  const { status, admin_note } = body
  if (!['approved','rejected','uploaded'].includes(status)) {
    return c.json({ success: false, error: '無效的狀態值' }, 400)
  }
  await db.prepare(`
    UPDATE official_leave_applications
    SET status = ?, admin_note = ?, reviewed_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).bind(status, admin_note || null, id).run()
  return c.json({ success: true })
})

// POST /api/admin/official-leave/calendar-event  — 新增行事曆事件
apiRoutes.post('/admin/official-leave/calendar-event', async (c) => {
  const db = c.env.DB
  const body = await c.req.json()
  const { title, date, type, description } = body
  if (!title || !date) return c.json({ success: false, error: '缺少 title 或 date' }, 400)
  const id = `ev-${Date.now()}-${Math.random().toString(36).substring(2,7)}`
  await db.prepare(`
    INSERT INTO leave_calendar_events (id, title, date, type, description)
    VALUES (?, ?, ?, ?, ?)
  `).bind(id, title, date, type || 'event', description || null).run()
  return c.json({ success: true, id })
})

// DELETE /api/admin/official-leave/calendar-event/:id  — 刪除行事曆事件
apiRoutes.delete('/admin/official-leave/calendar-event/:id', async (c) => {
  const db = c.env.DB
  const id = c.req.param('id')
  await db.prepare(`DELETE FROM leave_calendar_events WHERE id = ?`).bind(id).run()
  return c.json({ success: true })
})

// POST /api/admin/official-leave/toggle-block  — 封鎖/解封某日期
apiRoutes.post('/admin/official-leave/toggle-block', async (c) => {
  const db = c.env.DB
  const body = await c.req.json()
  const { date, is_blocked, reason } = body
  if (!date) return c.json({ success: false, error: '缺少 date' }, 400)

  if (is_blocked) {
    const exists = await db.prepare(`
      SELECT id FROM leave_calendar_events WHERE date = ? AND type = 'blocked'
    `).bind(date).first()
    if (!exists) {
      const id = `ev-${Date.now()}-${Math.random().toString(36).substring(2,7)}`
      await db.prepare(`
        INSERT INTO leave_calendar_events (id, title, date, type, description)
        VALUES (?, ?, ?, 'blocked', ?)
      `).bind(id, '暫停申請', date, reason || '團長有事或不開放').run()
    }
  } else {
    await db.prepare(`
      DELETE FROM leave_calendar_events WHERE date = ? AND type = 'blocked'
    `).bind(date).run()
  }
  return c.json({ success: true })
})

// PUT /api/admin/official-leave/settings  — 更新學期設定 + 每週例行
apiRoutes.put('/admin/official-leave/settings', async (c) => {
  const db = c.env.DB
  const body = await c.req.json()
  const { semesterStart, semesterEnd, allowedWeekdays, recurringRules } = body

  const updates: Array<{ key: string; value: string }> = []
  if (semesterStart !== undefined) updates.push({ key: 'official_leave_semester_start', value: semesterStart })
  if (semesterEnd !== undefined) updates.push({ key: 'official_leave_semester_end', value: semesterEnd })
  if (allowedWeekdays !== undefined) updates.push({ key: 'official_leave_allowed_weekdays', value: JSON.stringify(allowedWeekdays) })
  if (recurringRules !== undefined) updates.push({ key: 'official_leave_recurring_rules', value: JSON.stringify(recurringRules) })

  for (const u of updates) {
    await db.prepare(`
      INSERT INTO site_settings (key, value, description) VALUES (?, ?, '')
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `).bind(u.key, u.value).run()
  }
  return c.json({ success: true })
})

// ==================== 服務員訓練 API ====================

// 取得訓練定義清單
apiRoutes.get('/leader-trainings/def', async (c) => {
  const db = c.env.DB
  const trainings = await db.prepare(`SELECT * FROM leader_trainings ORDER BY category, display_order`).all()
  return c.json({ trainings: trainings.results })
})

// 新增訓練定義
apiRoutes.post('/leader-trainings/def', async (c) => {
  const db = c.env.DB
  const { name, category } = await c.req.json()
  if (!name || !category) return c.json({ success: false, error: '缺少必填欄位' })
  const { nanoid } = await import('nanoid')
  const id = nanoid()
  await db.prepare(`INSERT INTO leader_trainings (id, name, category, display_order) VALUES (?, ?, ?, 99)`)
    .bind(id, name, category).run()
  return c.json({ success: true, id })
})

// 刪除訓練定義
apiRoutes.delete('/leader-trainings/def/:id', async (c) => {
  const db = c.env.DB
  const id = c.req.param('id')
  await db.prepare(`DELETE FROM leader_trainings WHERE id = ?`).bind(id).run()
  return c.json({ success: true })
})

// 新增成員訓練記錄
apiRoutes.post('/leader-trainings/record', async (c) => {
  const db = c.env.DB
  const { member_id, training_id, completed_at, certificate_number, notes } = await c.req.json()
  if (!member_id || !training_id) return c.json({ success: false, error: '缺少必填欄位' })
  const { nanoid } = await import('nanoid')
  const id = nanoid()
  try {
    await db.prepare(`
      INSERT OR REPLACE INTO member_leader_trainings (id, member_id, training_id, completed_at, certificate_number, notes)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(id, member_id, training_id, completed_at || null, certificate_number || null, notes || null).run()
    return c.json({ success: true, id })
  } catch (e: any) {
    return c.json({ success: false, error: e.message })
  }
})

// 刪除成員訓練記錄
apiRoutes.delete('/leader-trainings/record/:id', async (c) => {
  const db = c.env.DB
  const id = c.req.param('id')
  await db.prepare(`DELETE FROM member_leader_trainings WHERE id = ?`).bind(id).run()
  return c.json({ success: true })
})

// ==================== 服務員獎章 API ====================

// 新增獎章定義（總會核發獎章）
apiRoutes.post('/leader-awards/def', async (c) => {
  const db = c.env.DB
  const { name, category, description } = await c.req.json()
  if (!name) return c.json({ success: false, error: '缺少必填欄位' })
  const { nanoid } = await import('nanoid')
  const id = nanoid()
  await db.prepare(`
    INSERT INTO leader_awards (id, name, category, level, display_order, description)
    VALUES (?, ?, ?, 1, 999, ?)
  `).bind(id, name, category || 'Association', description || null).run()
  return c.json({ success: true, id })
})

// 刪除獎章定義
apiRoutes.delete('/leader-awards/def/:id', async (c) => {
  const db = c.env.DB
  const id = c.req.param('id')
  // 同時刪除相關記錄
  await db.prepare(`DELETE FROM member_leader_awards WHERE award_id = ?`).bind(id).run()
  await db.prepare(`DELETE FROM leader_awards WHERE id = ?`).bind(id).run()
  return c.json({ success: true })
})

// 新增成員獎章記錄
apiRoutes.post('/leader-awards/record', async (c) => {
  const db = c.env.DB
  const { member_id, award_id, year_label, awarded_at, notes } = await c.req.json()
  if (!member_id || !award_id) return c.json({ success: false, error: '缺少必填欄位' })
  const { nanoid } = await import('nanoid')
  const id = nanoid()
  try {
    await db.prepare(`
      INSERT OR REPLACE INTO member_leader_awards (id, member_id, award_id, year_label, awarded_at, notes)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(id, member_id, award_id, year_label || null, awarded_at || null, notes || null).run()
    return c.json({ success: true, id })
  } catch (e: any) {
    return c.json({ success: false, error: e.message })
  }
})

// 刪除成員獎章記錄
apiRoutes.delete('/leader-awards/record/:id', async (c) => {
  const db = c.env.DB
  const id = c.req.param('id')
  await db.prepare(`DELETE FROM member_leader_awards WHERE id = ?`).bind(id).run()
  return c.json({ success: true })
})

// ==================== 服務年資 API ====================

apiRoutes.post('/leader-service-years', async (c) => {
  const db = c.env.DB
  const { member_id, prior_years, service_start_date } = await c.req.json()
  if (!member_id) return c.json({ success: false, error: '缺少 member_id' })
  const { nanoid } = await import('nanoid')
  const existing = await db.prepare(`SELECT id FROM member_service_years WHERE member_id = ?`).bind(member_id).first() as any
  try {
    if (existing) {
      await db.prepare(`
        UPDATE member_service_years SET prior_years = ?, service_start_date = ?, updated_at = datetime('now')
        WHERE member_id = ?
      `).bind(prior_years || 0, service_start_date || null, member_id).run()
    } else {
      await db.prepare(`
        INSERT INTO member_service_years (id, member_id, prior_years, service_start_date)
        VALUES (?, ?, ?, ?)
      `).bind(nanoid(), member_id, prior_years || 0, service_start_date || null).run()
    }
    return c.json({ success: true })
  } catch (e: any) {
    return c.json({ success: false, error: e.message })
  }
})

// ==================== 職位管理 API ====================

// 取得所有職位（可依 section 篩選）
apiRoutes.get('/member-roles', async (c) => {
  const db = c.env.DB
  const section = c.req.query('section') || ''
  let roles: any
  if (section) {
    roles = await db.prepare(`
      SELECT * FROM member_roles
      WHERE scopes IS NULL OR scopes = '' OR (',' || scopes || ',') LIKE '%,' || ? || ',%'
      ORDER BY display_order, name
    `).bind(section).all()
  } else {
    roles = await db.prepare(`SELECT * FROM member_roles ORDER BY display_order, name`).all()
  }
  return c.json({ success: true, roles: roles.results })
})

// 新增職位
apiRoutes.post('/member-roles', async (c) => {
  const db = c.env.DB
  const body = await c.req.json()
  const { name, scopes } = body
  if (!name?.trim()) return c.json({ success: false, error: '請提供職位名稱' })
  const { nanoid } = await import('nanoid')
  const maxOrder = await db.prepare(`SELECT MAX(display_order) as m FROM member_roles`).first() as any
  const newOrder = (maxOrder?.m || 0) + 1
  const id = 'role_' + nanoid(8)
  await db.prepare(`
    INSERT INTO member_roles (id, name, scopes, display_order) VALUES (?, ?, ?, ?)
  `).bind(id, name.trim(), scopes?.length > 0 ? scopes.join(',') : null, newOrder).run()
  return c.json({ success: true, role: { id, name: name.trim(), scopes: scopes?.join(',') || null, display_order: newOrder } })
})

// 更新職位
apiRoutes.put('/member-roles/:id', async (c) => {
  const db = c.env.DB
  const id = c.req.param('id')
  const { name, scopes } = await c.req.json()
  if (!name?.trim()) return c.json({ success: false, error: '請提供職位名稱' })
  await db.prepare(`
    UPDATE member_roles SET name = ?, scopes = ? WHERE id = ?
  `).bind(name.trim(), scopes?.length > 0 ? scopes.join(',') : null, id).run()
  return c.json({ success: true })
})

// 刪除職位
apiRoutes.delete('/member-roles/:id', async (c) => {
  const db = c.env.DB
  const id = c.req.param('id')
  await db.prepare(`DELETE FROM member_roles WHERE id = ?`).bind(id).run()
  return c.json({ success: true })
})

// ===================== 組織/幹部/歷屆名單 APIs =====================

// API: 儲存組織架構
apiRoutes.post('/admin/group-org/:groupId', async (c) => {
  const db = c.env.DB
  const groupId = c.req.param('groupId')
  const { image_url, content } = await c.req.json() as any
  try {
    const existing = await db.prepare(`SELECT id FROM group_org_chart WHERE group_id=?`).bind(groupId).first()
    if (existing) {
      await db.prepare(`UPDATE group_org_chart SET image_url=?, content=?, updated_at=CURRENT_TIMESTAMP WHERE group_id=?`)
        .bind(image_url || null, content || null, groupId).run()
    } else {
      await db.prepare(`INSERT INTO group_org_chart (group_id, image_url, content) VALUES (?,?,?)`)
        .bind(groupId, image_url || null, content || null).run()
    }
    return c.json({ success: true })
  } catch(e: any) {
    return c.json({ success: false, error: e.message })
  }
})

// API: 新增幹部
apiRoutes.post('/admin/group-cadres', async (c) => {
  const db = c.env.DB
  const body = await c.req.json() as any
  try {
    await db.prepare(`
      INSERT INTO group_cadres (group_id, chinese_name, english_name, role, year_label, photo_url, notes, display_order, is_current)
      VALUES (?,?,?,?,?,?,?,?,?)
    `).bind(body.group_id, body.chinese_name, body.english_name||null, body.role, body.year_label||null,
             body.photo_url||null, body.notes||null, body.display_order||0, body.is_current||0).run()
    return c.json({ success: true })
  } catch(e: any) { return c.json({ success: false, error: e.message }) }
})

// API: 更新幹部
apiRoutes.put('/admin/group-cadres/:id', async (c) => {
  const db = c.env.DB
  const id = c.req.param('id')
  const body = await c.req.json() as any
  try {
    await db.prepare(`
      UPDATE group_cadres SET chinese_name=?, english_name=?, role=?, year_label=?, photo_url=?, notes=?, display_order=?, is_current=?
      WHERE id=?
    `).bind(body.chinese_name, body.english_name||null, body.role, body.year_label||null,
             body.photo_url||null, body.notes||null, body.display_order||0, body.is_current||0, id).run()
    return c.json({ success: true })
  } catch(e: any) { return c.json({ success: false, error: e.message }) }
})

// API: 刪除幹部
apiRoutes.delete('/admin/group-cadres/:id', async (c) => {
  const db = c.env.DB
  await db.prepare(`DELETE FROM group_cadres WHERE id=?`).bind(c.req.param('id')).run()
  return c.json({ success: true })
})

// API: 換年度
apiRoutes.post('/admin/group-cadres-rollover/:groupId', async (c) => {
  const db = c.env.DB
  const groupId = c.req.param('groupId')
  const { year_label } = await c.req.json() as any
  try {
    const current = await db.prepare(`SELECT * FROM group_cadres WHERE group_id=? AND is_current=1`).bind(groupId).all()
    const cadres = current.results as any[]
    if (cadres.length === 0) return c.json({ success: true, moved: 0 })
    for (const c2 of cadres) {
      await db.prepare(`
        INSERT INTO group_alumni (group_id, year_label, member_name, english_name, unit_name, role_name, rank_level, notes)
        VALUES (?,?,?,?,?,?,?,?)
      `).bind(groupId, year_label || c2.year_label || '', c2.chinese_name, c2.english_name||null,
               null, c2.role||null, null, c2.notes||null).run()
    }
    await db.prepare(`UPDATE group_cadres SET is_current=0, year_label=? WHERE group_id=? AND is_current=1`)
      .bind(year_label || '', groupId).run()
    return c.json({ success: true, moved: cadres.length })
  } catch(e: any) { return c.json({ success: false, error: e.message }) }
})

// API: 新增歷屆名單
apiRoutes.post('/admin/group-alumni', async (c) => {
  const db = c.env.DB
  const body = await c.req.json() as any
  try {
    await db.prepare(`
      INSERT INTO group_alumni (group_id, year_label, member_name, english_name, unit_name, role_name, rank_level, notes)
      VALUES (?,?,?,?,?,?,?,?)
    `).bind(body.group_id, body.year_label, body.member_name, body.english_name||null,
             body.unit_name||null, body.role_name||null, body.rank_level||null, body.notes||null).run()
    return c.json({ success: true })
  } catch(e: any) { return c.json({ success: false, error: e.message }) }
})

// API: 更新歷屆名單
apiRoutes.put('/admin/group-alumni/:id', async (c) => {
  const db = c.env.DB
  const id = c.req.param('id')
  const body = await c.req.json() as any
  try {
    await db.prepare(`
      UPDATE group_alumni SET year_label=?, member_name=?, english_name=?, unit_name=?, role_name=?, rank_level=?, notes=?
      WHERE id=?
    `).bind(body.year_label, body.member_name, body.english_name||null,
             body.unit_name||null, body.role_name||null, body.rank_level||null, body.notes||null, id).run()
    return c.json({ success: true })
  } catch(e: any) { return c.json({ success: false, error: e.message }) }
})

// API: 刪除歷屆名單
apiRoutes.delete('/admin/group-alumni/:id', async (c) => {
  const db = c.env.DB
  await db.prepare(`DELETE FROM group_alumni WHERE id=?`).bind(c.req.param('id')).run()
  return c.json({ success: true })
})

// API: 預覽可匯入的歷屆成員（從 member_year_records + member_enrollments）
apiRoutes.get('/admin/group-alumni-import-preview/:groupId', async (c) => {
  const db = c.env.DB
  const groupId = c.req.param('groupId')
  const year = c.req.query('year')
  if (!year) return c.json({ success: false, error: '請提供學年度' })

  const sectionMap: Record<string, string[]> = {
    '1': ['童軍'],
    '2': ['行義童軍'],
    '3': ['羅浮童軍']
  }
  const sections = sectionMap[groupId] || []
  if (sections.length === 0) return c.json({ success: false, error: '不支援此團別的匯入' })

  const ph = sections.map(() => '?').join(',')
  const members: any[] = []

  const pyrRows = await db.prepare(`
    SELECT m.chinese_name as name, m.english_name, myr.unit_name as unit, myr.rank_level as rank, myr.role_name as role
    FROM member_year_records myr
    JOIN members m ON m.id = myr.member_id
    WHERE myr.year_label=? AND myr.section IN (${ph})
    ORDER BY myr.unit_name, m.chinese_name
  `).bind(year, ...sections).all()

  const foundNames = new Set<string>()
  for (const r of pyrRows.results as any[]) {
    members.push({ name: r.name, english_name: r.english_name || '', unit: r.unit || '', rank: r.rank || '', role: r.role || '' })
    foundNames.add(r.name)
  }

  const penRows = await db.prepare(`
    SELECT m.chinese_name as name, m.english_name, me.unit_name as unit, me.rank_level as rank, me.role_name as role
    FROM member_enrollments me
    JOIN members m ON m.id = me.member_id
    WHERE me.year_label=? AND me.section IN (${ph})
    ORDER BY me.unit_name, m.chinese_name
  `).bind(year, ...sections).all()

  for (const r of penRows.results as any[]) {
    if (!foundNames.has(r.name)) {
      members.push({ name: r.name, english_name: r.english_name || '', unit: r.unit || '', rank: r.rank || '', role: r.role || '' })
    }
  }

  return c.json({ success: true, members })
})

// API: 執行匯入歷屆名單
apiRoutes.post('/admin/group-alumni-import/:groupId', async (c) => {
  const db = c.env.DB
  const groupId = c.req.param('groupId')
  const { year_label, members } = await c.req.json() as any
  if (!year_label || !Array.isArray(members)) return c.json({ success: false, error: '參數錯誤' })

  let imported = 0
  try {
    for (const m of members) {
      if (!m.name) continue
      const existing = await db.prepare(
        `SELECT id FROM group_alumni WHERE group_id=? AND year_label=? AND member_name=?`
      ).bind(groupId, year_label, m.name).first()
      if (existing) continue
      await db.prepare(`
        INSERT INTO group_alumni (group_id, year_label, member_name, english_name, unit_name, role_name, rank_level)
        VALUES (?,?,?,?,?,?,?)
      `).bind(groupId, year_label, m.name, m.english_name || null,
               m.unit || null, m.role || null, m.rank || null).run()
      imported++
    }
    return c.json({ success: true, imported })
  } catch(e: any) {
    return c.json({ success: false, error: e.message })
  }
})

// API: 從成員名冊匯入現任幹部
apiRoutes.post('/admin/group-cadres-from-roster', async (c) => {
  const db = c.env.DB
  const { group_id, year_label, members } = await c.req.json() as any
  if (!group_id || !Array.isArray(members)) return c.json({ success: false, error: '參數錯誤' })

  let imported = 0
  try {
    for (const m of members) {
      if (!m.chinese_name) continue
      // 支援 role 或 role_name 欄位
      const roleName = (m.role || m.role_name || '').trim()
      if (!roleName) continue
      // 檢查是否已在現任幹部（同名同組）
      const existing = await db.prepare(
        `SELECT id FROM group_cadres WHERE group_id=? AND chinese_name=? AND is_current=1`
      ).bind(group_id, m.chinese_name).first()
      if (existing) continue

      await db.prepare(`
        INSERT INTO group_cadres (group_id, chinese_name, english_name, role, year_label, photo_url, is_current, display_order)
        VALUES (?,?,?,?,?,?,1,?)
      `).bind(group_id, m.chinese_name, m.english_name || null, roleName, year_label || null, m.photo_url || null, imported).run()
      imported++
    }
    return c.json({ success: true, imported })
  } catch(e: any) {
    return c.json({ success: false, error: e.message })
  }
})

// ===================== 相關網頁 CRUD =====================
apiRoutes.post('/admin/site-links', async (c) => {
  const db = c.env.DB
  const { title, url, description, category, icon_emoji, display_order, is_active } = await c.req.json() as any
  if (!title || !url) return c.json({ success: false, error: '標題和網址為必填' })
  try {
    await db.prepare(`
      INSERT INTO site_links (title, url, description, category, icon_emoji, display_order, is_active)
      VALUES (?,?,?,?,?,?,?)
    `).bind(title, url, description || null, category || '其他', icon_emoji || '🔗', display_order ?? 0, is_active ?? 1).run()
    return c.json({ success: true })
  } catch(e: any) { return c.json({ success: false, error: e.message }) }
})

apiRoutes.put('/admin/site-links/:id', async (c) => {
  const db = c.env.DB
  const id = c.req.param('id')
  const { title, url, description, category, icon_emoji, display_order, is_active } = await c.req.json() as any
  if (!title || !url) return c.json({ success: false, error: '標題和網址為必填' })
  try {
    await db.prepare(`
      UPDATE site_links SET title=?, url=?, description=?, category=?, icon_emoji=?, display_order=?, is_active=?
      WHERE id=?
    `).bind(title, url, description || null, category || '其他', icon_emoji || '🔗', display_order ?? 0, is_active ?? 1, id).run()
    return c.json({ success: true })
  } catch(e: any) { return c.json({ success: false, error: e.message }) }
})

apiRoutes.delete('/admin/site-links/:id', async (c) => {
  const db = c.env.DB
  const id = c.req.param('id')
  try {
    await db.prepare(`DELETE FROM site_links WHERE id=?`).bind(id).run()
    return c.json({ success: true })
  } catch(e: any) { return c.json({ success: false, error: e.message }) }
})

// ===================== 羅浮地圖座標 API =====================
apiRoutes.put('/rover-map-coord', async (c) => {
  const db = c.env.DB
  const { country, x, y, label } = await c.req.json() as any
  if (!country || x === undefined || y === undefined) {
    return c.json({ ok: false, error: '缺少必要參數 country, x, y' }, 400)
  }
  const key = `rover_map_coord_${country}`
  const value = JSON.stringify({ x: parseFloat(x), y: parseFloat(y), label: label || country })
  try {
    await db.prepare(`
      INSERT INTO site_settings (key, value) VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `).bind(key, value).run()
    return c.json({ ok: true })
  } catch (e: any) {
    return c.json({ ok: false, error: e.message }, 500)
  }
})

apiRoutes.get('/rover-map-coord', async (c) => {
  const db = c.env.DB
  const rows = await db.prepare(`SELECT key, value FROM site_settings WHERE key LIKE 'rover_map_coord_%'`).all()
  const coords: Record<string, any> = {}
  ;(rows.results as any[]).forEach((row: any) => {
    const country = row.key.replace('rover_map_coord_', '')
    try { coords[country] = JSON.parse(row.value) } catch {}
  })
  return c.json({ ok: true, data: coords })
})

// ── Group Honors (榮譽榜) ──
apiRoutes.get('/admin/group-honors', async (c) => {
  const db = c.env.DB;
  const records = await db.prepare('SELECT * FROM group_honors ORDER BY year_label DESC, created_at DESC').all();
  return c.json(records.results);
});

apiRoutes.post('/admin/group-honors', async (c) => {
  const db = c.env.DB;
  const body = await c.req.json();
  const { honor_name, year_label, tier } = body;
  const res = await db.prepare('INSERT INTO group_honors (honor_name, year_label, tier) VALUES (?, ?, ?)').bind(honor_name, year_label, tier || 1).run();
  return c.json({ success: true, id: res.meta.last_row_id });
});

apiRoutes.delete('/admin/group-honors/:id', async (c) => {
  const db = c.env.DB;
  const id = c.req.param('id');
  await db.prepare('DELETE FROM group_honors WHERE id = ?').bind(id).run();
  return c.json({ success: true });
});

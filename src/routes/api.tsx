import { Hono } from 'hono'

type Bindings = {
  DB: D1Database
}

export const apiRoutes = new Hono<{ Bindings: Bindings }>()

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
  const { title, title_en, description, description_en, activity_date, date_display, category, youtube_url, display_order, is_published, cover_image, show_in_highlights } = body
  if (!title) return c.json({ success: false, error: '標題為必填' }, 400)

  const result = await db.prepare(`
    INSERT INTO activities (title, title_en, description, description_en, activity_date, date_display, category, youtube_url, display_order, is_published, cover_image, show_in_highlights)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    title, title_en || null, description || null, description_en || null,
    activity_date || null, date_display || null,
    category || 'general', youtube_url || null,
    display_order || 0, is_published !== undefined ? is_published : 1,
    cover_image || null, show_in_highlights ? 1 : 0
  ).run()

  return c.json({ success: true, id: result.meta.last_row_id })
})

// 更新活動
apiRoutes.put('/activities/:id', async (c) => {
  const db = c.env.DB
  const id = c.req.param('id')
  const body = await c.req.json()
  const { title, title_en, description, description_en, activity_date, date_display, category, youtube_url, display_order, is_published, cover_image, show_in_highlights } = body

  await db.prepare(`
    UPDATE activities SET
      title = ?, title_en = ?, description = ?, description_en = ?,
      activity_date = ?, date_display = ?, category = ?, youtube_url = ?,
      display_order = ?, is_published = ?, cover_image = ?, show_in_highlights = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).bind(
    title, title_en || null, description || null, description_en || null,
    activity_date || null, date_display || null,
    category || 'general', youtube_url || null,
    display_order || 0, is_published !== undefined ? is_published : 1,
    cover_image || null, show_in_highlights ? 1 : 0,
    id
  ).run()

  return c.json({ success: true })
})

// 刪除活動
apiRoutes.delete('/activities/:id', async (c) => {
  const db = c.env.DB
  const id = c.req.param('id')
  await db.prepare(`DELETE FROM activities WHERE id = ?`).bind(id).run()
  return c.json({ success: true })
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
  const { chinese_name, english_name, gender, national_id, dob, phone, email, parent_name, section, rank_level, unit_name, role_name, troop, membership_status, notes } = body
  
  await db.prepare(`
    UPDATE members SET
      chinese_name=?, english_name=?, gender=?, national_id=?, dob=?, phone=?, email=?,
      parent_name=?, section=?, rank_level=?, unit_name=?, role_name=?, troop=?,
      membership_status=?, notes=?, updated_at=CURRENT_TIMESTAMP
    WHERE id=?
  `).bind(
    chinese_name, english_name || null, gender || null, national_id || null, dob || null,
    phone || null, email || null, parent_name || null, section || '童軍', rank_level || null,
    unit_name || null, role_name || '隊員', troop || '54團', membership_status || 'ACTIVE', notes || null, id
  ).run()
  
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
  const { id, title, date, section, session_number, topic, notes } = body
  if (!title || !date) return c.json({ success: false, error: '標題和日期為必填' }, 400)
  
  const sessionId = id || `as-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
  await db.prepare(`
    INSERT INTO attendance_sessions (id, title, date, section, session_number, topic, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(sessionId, title, date, section || 'all', session_number || null, topic || null, notes || null).run()
  
  // 自動加入對應組別的所有成員
  let memberQuery = `SELECT id FROM members WHERE membership_status = 'ACTIVE'`
  const memberParams: any[] = []
  if (section && section !== 'all') {
    const sectionMap: Record<string, string> = {
      junior: '童軍', senior: '行義童軍', rover: '羅浮童軍'
    }
    if (sectionMap[section]) {
      memberQuery += ` AND section = ?`
      memberParams.push(sectionMap[section])
    }
  }
  const members = await db.prepare(memberQuery).bind(...memberParams).all()
  
  for (const member of members.results as any[]) {
    await db.prepare(`
      INSERT OR IGNORE INTO attendance_records (session_id, member_id, status)
      VALUES (?, ?, 'absent')
    `).bind(sessionId, member.id).run()
  }
  
  return c.json({ success: true, id: sessionId })
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
    '童軍團': '童軍', '深資童軍團': '行義童軍', '羅浮童軍群': '羅浮童軍'
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

// 請假申請 API
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

// ==================== 管理員：晉升條件管理 ====================

// 取得晉升條件
apiRoutes.get('/admin/advancement-requirements', async (c) => {
  const db = c.env.DB
  const section = c.req.query('section')
  let query = `SELECT * FROM advancement_requirements WHERE is_active = 1`
  const params: any[] = []
  if (section) { query += ` AND section = ?`; params.push(section) }
  query += ` ORDER BY section, rank_from, display_order`
  const result = await db.prepare(query).bind(...params).all()
  return c.json({ success: true, data: result.results })
})

// 新增晉升條件
apiRoutes.post('/admin/advancement-requirements', async (c) => {
  const db = c.env.DB
  const body = await c.req.json()
  const { section, rank_from, rank_to, requirement_type, title, description, required_count, unit, is_mandatory, display_order } = body
  if (!section || !rank_from || !rank_to || !title) {
    return c.json({ success: false, error: '缺少必填欄位' }, 400)
  }
  const id = `req-${Date.now()}-${Math.random().toString(36).substring(2,7)}`
  await db.prepare(`
    INSERT INTO advancement_requirements (id, section, rank_from, rank_to, requirement_type, title, description, required_count, unit, is_mandatory, display_order)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(id, section, rank_from, rank_to, requirement_type || 'other', title, description || null,
    required_count || 1, unit || '次', is_mandatory !== false ? 1 : 0, display_order || 0).run()
  return c.json({ success: true, id })
})

// 更新晉升條件
apiRoutes.put('/admin/advancement-requirements/:id', async (c) => {
  const db = c.env.DB
  const id = c.req.param('id')
  const body = await c.req.json()
  const { title, description, required_count, unit, is_mandatory, display_order, is_active } = body
  await db.prepare(`
    UPDATE advancement_requirements SET
      title = ?, description = ?, required_count = ?, unit = ?,
      is_mandatory = ?, display_order = ?, is_active = ?
    WHERE id = ?
  `).bind(title, description || null, required_count || 1, unit || '次',
    is_mandatory !== false ? 1 : 0, display_order || 0, is_active !== false ? 1 : 0, id).run()
  return c.json({ success: true })
})

// 刪除晉升條件（軟刪除）
apiRoutes.delete('/admin/advancement-requirements/:id', async (c) => {
  const db = c.env.DB
  const id = c.req.param('id')
  await db.prepare(`UPDATE advancement_requirements SET is_active = 0 WHERE id = ?`).bind(id).run()
  return c.json({ success: true })
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

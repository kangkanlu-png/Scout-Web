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
  const { title, title_en, description, description_en, activity_date, date_display, category, youtube_url, display_order, is_published } = body
  if (!title) return c.json({ success: false, error: '標題為必填' }, 400)

  const result = await db.prepare(`
    INSERT INTO activities (title, title_en, description, description_en, activity_date, date_display, category, youtube_url, display_order, is_published)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    title, title_en || null, description || null, description_en || null,
    activity_date || null, date_display || null,
    category || 'general', youtube_url || null,
    display_order || 0, is_published !== undefined ? is_published : 1
  ).run()

  return c.json({ success: true, id: result.meta.last_row_id })
})

// 更新活動
apiRoutes.put('/activities/:id', async (c) => {
  const db = c.env.DB
  const id = c.req.param('id')
  const body = await c.req.json()
  const { title, title_en, description, description_en, activity_date, date_display, category, youtube_url, display_order, is_published } = body

  await db.prepare(`
    UPDATE activities SET
      title = ?, title_en = ?, description = ?, description_en = ?,
      activity_date = ?, date_display = ?, category = ?, youtube_url = ?,
      display_order = ?, is_published = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).bind(
    title, title_en || null, description || null, description_en || null,
    activity_date || null, date_display || null,
    category || 'general', youtube_url || null,
    display_order || 0, is_published !== undefined ? is_published : 1,
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

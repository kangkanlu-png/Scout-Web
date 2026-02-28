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

// 取得某分組的所有學期
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

// 新增學期
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

// 更新學期
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

// 刪除學期
apiRoutes.delete('/semesters/:id', async (c) => {
  const db = c.env.DB
  const id = c.req.param('id')
  await db.prepare(`DELETE FROM group_semesters WHERE id=?`).bind(id).run()
  return c.json({ success: true })
})

// 取得學期的圖片
apiRoutes.get('/semesters/:id/images', async (c) => {
  const db = c.env.DB
  const id = c.req.param('id')
  const result = await db.prepare(`SELECT * FROM semester_images WHERE semester_id=? ORDER BY display_order ASC`).bind(id).all()
  return c.json({ success: true, data: result.results })
})

// 新增學期圖片
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

// 刪除學期圖片
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

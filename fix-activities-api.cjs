const fs = require('fs');
let file = fs.readFileSync('src/routes/api.tsx', 'utf8');

// We will use regex to find and replace the whole POST and PUT block.
const postRegex = /apiRoutes\.post\('\/activities', async \(c\) => \{[\s\S]*?\}\)/;
const putRegex = /apiRoutes\.put\('\/activities\/:id', async \(c\) => \{[\s\S]*?\}\)/;

const newPost = `apiRoutes.post('/activities', async (c) => {
  const db = c.env.DB
  const body = await c.req.json()
  const { 
    title, title_en, description, description_en, activity_date, date_display, category, 
    youtube_url, display_order, is_published, cover_image, show_in_highlights, activity_type,
    location, cost, content, registration_start, registration_end, max_participants, is_registration_open, activity_end_date
  } = body
  if (!title) return c.json({ success: false, error: '標題為必填' }, 400)

  const result = await db.prepare(\`
    INSERT INTO activities (
      title, title_en, description, description_en, activity_date, date_display, category, 
      youtube_url, display_order, is_published, cover_image, show_in_highlights, activity_type,
      location, cost, content, registration_start, registration_end, max_participants, is_registration_open, activity_end_date
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  \`).bind(
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
})`;

const newPut = `apiRoutes.put('/activities/:id', async (c) => {
  const db = c.env.DB
  const id = c.req.param('id')
  const body = await c.req.json()
  const { 
    title, title_en, description, description_en, activity_date, date_display, category, 
    youtube_url, display_order, is_published, cover_image, show_in_highlights, activity_type,
    location, cost, content, registration_start, registration_end, max_participants, is_registration_open, activity_end_date
  } = body

  await db.prepare(\`
    UPDATE activities SET
      title = ?, title_en = ?, description = ?, description_en = ?,
      activity_date = ?, date_display = ?, category = ?, youtube_url = ?,
      display_order = ?, is_published = ?, cover_image = ?, show_in_highlights = ?, activity_type = ?,
      location = ?, cost = ?, content = ?, registration_start = ?, registration_end = ?, 
      max_participants = ?, is_registration_open = ?, activity_end_date = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  \`).bind(
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
})`;

file = file.replace(postRegex, newPost);
file = file.replace(putRegex, newPut);

// Add an endpoint to move activity to highlights
const moveToHighlights = `
// 結案並移至精彩活動
apiRoutes.post('/admin/activities/:id/close-and-highlight', async (c) => {
  const db = c.env.DB
  const id = c.req.param('id')
  
  await db.prepare(\`
    UPDATE activities SET
      show_in_highlights = 1,
      is_registration_open = 0,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  \`).bind(id).run()

  return c.json({ success: true })
})
`;
if (!file.includes('close-and-highlight')) {
    file = file.replace(/apiRoutes\.delete\('\/activities\/:id', async \(c\) => \{[\s\S]*?\}\)/, match => match + '\n' + moveToHighlights);
}

fs.writeFileSync('src/routes/api.tsx', file);

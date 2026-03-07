const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'src/routes/api.tsx');
let content = fs.readFileSync(file, 'utf-8');

// Add endpoints at the end before `export default api`
const apiCode = `
// ── Group Honors (榮譽榜) ──
api.get('/admin/group-honors', async (c) => {
  const db = c.env.DB;
  const records = await db.prepare('SELECT * FROM group_honors ORDER BY year_label DESC, created_at DESC').all();
  return c.json(records.results);
});

api.post('/admin/group-honors', async (c) => {
  const db = c.env.DB;
  const body = await c.req.json();
  const { honor_name, year_label, tier } = body;
  const res = await db.prepare('INSERT INTO group_honors (honor_name, year_label, tier) VALUES (?, ?, ?)').bind(honor_name, year_label, tier || 1).run();
  return c.json({ success: true, id: res.meta.last_row_id });
});

api.delete('/admin/group-honors/:id', async (c) => {
  const db = c.env.DB;
  const id = c.req.param('id');
  await db.prepare('DELETE FROM group_honors WHERE id = ?').bind(id).run();
  return c.json({ success: true });
});

export default api;
`;

content = content.replace(/export default api;/g, apiCode);
fs.writeFileSync(file, content);
console.log('Added API endpoints');

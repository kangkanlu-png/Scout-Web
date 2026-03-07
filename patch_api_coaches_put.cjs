const fs = require('fs')

let code = fs.readFileSync('src/routes/api.tsx', 'utf8')

const oldBlock = `apiRoutes.put('/coaches/:id', async (c) => {
  const db = c.env.DB
  const id = c.req.param('id')
  const body = await c.req.json()
  const { chinese_name, english_name, coach_level, specialties, year_label, section_assigned, notes } = body
  
  await db.prepare(\`
    UPDATE coach_members SET chinese_name=?, english_name=?, coach_level=?, specialties=?, year_label=?, section_assigned=?, notes=?
    WHERE id=?
  \`).bind(chinese_name, english_name || null, coach_level || '預備教練', specialties || null, year_label || null, section_assigned || null, notes || null, id).run()
  
  return c.json({ success: true })
})`

const newBlock = `apiRoutes.put('/coaches/:id', async (c) => {
  const db = c.env.DB
  const id = c.req.param('id')
  const body = await c.req.json()
  const { coach_level, specialties, year_label, section_assigned, notes } = body
  
  await db.prepare(\`
    UPDATE coach_member_status 
    SET current_stage=?, specialties=?, year_label=?, section_assigned=?
    WHERE id=?
  \`).bind(coach_level || '預備教練', specialties || null, year_label || null, section_assigned || null, id).run()
  
  return c.json({ success: true })
})`

code = code.replace(oldBlock, newBlock)

fs.writeFileSync('src/routes/api.tsx', code)
console.log('API put patched')

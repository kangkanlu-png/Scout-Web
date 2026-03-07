const fs = require('fs')

let code = fs.readFileSync('src/routes/api.tsx', 'utf8')

const searchBlock = `apiRoutes.delete('/admin/group-alumni/:id', async (c) => {
  const db = c.env.DB
  await db.prepare(\`DELETE FROM group_alumni WHERE id=?\`).bind(c.req.param('id')).run()
  return c.json({ success: true })
})`

const replaceBlock = `apiRoutes.delete('/admin/group-alumni/:id', async (c) => {
  const db = c.env.DB
  await db.prepare(\`DELETE FROM group_alumni WHERE id=?\`).bind(c.req.param('id')).run()
  return c.json({ success: true })
})

apiRoutes.delete('/admin/group-alumni/year', async (c) => {
  const db = c.env.DB
  const groupId = c.req.query('groupId')
  const year = c.req.query('year')
  if (!groupId || !year) return c.json({ error: 'Missing parameters' }, 400)
  
  await db.prepare(\`DELETE FROM group_alumni WHERE group_id=? AND year_label=?\`).bind(groupId, year).run()
  return c.json({ success: true })
})`

code = code.replace(searchBlock, replaceBlock)
fs.writeFileSync('src/routes/api.tsx', code)
console.log('API patched')

const fs = require('fs')

let code = fs.readFileSync('src/routes/api.tsx', 'utf8')

const oldBlock = `apiRoutes.delete('/coaches/:id', async (c) => {
  const db = c.env.DB
  const id = c.req.param('id')
  await db.prepare(\`DELETE FROM coach_members WHERE id=?\`).bind(id).run()
  return c.json({ success: true })
})`

const newBlock = `apiRoutes.delete('/coaches/:id', async (c) => {
  const db = c.env.DB
  const id = c.req.param('id')
  await db.prepare(\`DELETE FROM coach_member_status WHERE id=?\`).bind(id).run()
  return c.json({ success: true })
})`

code = code.replace(oldBlock, newBlock)

fs.writeFileSync('src/routes/api.tsx', code)
console.log('API delete patched')

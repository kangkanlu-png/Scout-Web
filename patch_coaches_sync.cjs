const fs = require('fs')

let code = fs.readFileSync('src/routes/admin.tsx', 'utf8')

const oldBlock = `  let query = \`SELECT * FROM coach_members WHERE 1=1\`
  const params: any[] = []
  if (year) { query += \` AND year_label = ?\`; params.push(year) }
  query += \` ORDER BY CASE coach_level WHEN '指導教練' THEN 1 WHEN '助理教練' THEN 2 WHEN '見習教練' THEN 3 WHEN '預備教練' THEN 4 ELSE 5 END, chinese_name\`
  const coaches = await db.prepare(query).bind(...params).all()

  const levelCounts: Record<string,number> = {}
  coaches.results.forEach((c: any) => { levelCounts[c.coach_level] = (levelCounts[c.coach_level] || 0) + 1 })`

const newBlock = `  let query = \`
    SELECT cms.id, m.chinese_name, m.english_name, cms.current_stage as coach_level, 
           cms.section_assigned, cms.specialties, cms.year_label, m.id as member_id
    FROM coach_member_status cms
    JOIN members m ON m.id = cms.member_id
    WHERE 1=1
  \`
  const params: any[] = []
  if (year) { query += \` AND cms.year_label = ?\`; params.push(year) }
  query += \` ORDER BY CASE cms.current_stage WHEN '指導教練' THEN 1 WHEN '助理教練' THEN 2 WHEN '見習教練' THEN 3 WHEN '預備教練' THEN 4 ELSE 5 END, m.chinese_name\`
  const coaches = await db.prepare(query).bind(...params).all()

  const levelCounts: Record<string,number> = {}
  coaches.results.forEach((c: any) => { levelCounts[c.coach_level] = (levelCounts[c.coach_level] || 0) + 1 })`

code = code.replace(oldBlock, newBlock)

// We also need to add columns to coach_member_status if they are missing
fs.writeFileSync('src/routes/admin.tsx', code)
console.log('Admin route patched')

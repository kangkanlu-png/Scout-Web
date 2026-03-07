const fs = require('fs')

let code = fs.readFileSync('src/routes/admin.tsx', 'utf8')

const oldQuery = `    // 取得所有學員
    let query = \`SELECT m.id, m.chinese_name, m.section, m.unit_name, m.rank_level,
                 (SELECT award_name FROM progress_records WHERE member_id = m.id AND record_type = 'rank' ORDER BY awarded_at DESC LIMIT 1) as current_rank
                 FROM members m WHERE m.membership_status = 'ACTIVE'\``

const newQuery = `    // 取得所有學員
    let query = \`SELECT m.id, m.chinese_name, m.section, m.unit_name, m.rank_level,
                 m.rank_level as current_rank
                 FROM members m WHERE m.membership_status = 'ACTIVE'\``

code = code.replace(oldQuery, newQuery)

fs.writeFileSync('src/routes/admin.tsx', code)
console.log('Query patched')

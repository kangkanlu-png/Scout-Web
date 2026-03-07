const fs = require('fs');
let code = fs.readFileSync('src/routes/admin.tsx', 'utf8');

// Replace tableRows logic in /groups/:id/alumni with tables grouped by year
code = code.replace(
  /const tableRows = \(alumni\.results as any\[\]\)\.map\(\(a: any\) => `[\s\S]*?`\)\.join\(''\)/,
  `const tablesHTML = sortedYears.length === 0 ? '<div class="bg-white rounded-xl shadow p-8 text-center text-gray-400">尚無歷屆名單資料</div>' : sortedYears.map(year => {
    const rows = yearGroups[year].map((a: any) => \`
    <tr class="border-b hover:bg-gray-50 text-sm">
      <td class="py-2 px-3 text-gray-500">\${a.year_label}</td>
      <td class="py-2 px-3 font-medium">\${a.member_name}</td>
      <td class="py-2 px-3 text-gray-500">\${a.english_name || '-'}</td>
      <td class="py-2 px-3"><span class="bg-amber-50 text-amber-700 px-2 py-0.5 rounded text-xs">\${a.unit_name || '-'}</span></td>
      <td class="py-2 px-3 text-gray-500">\${a.role_name || '-'}</td>
      <td class="py-2 px-3 text-gray-500">\${a.rank_level || '-'}</td>
      <td class="py-2 px-3">
        <button onclick='editAlumni(\${JSON.stringify(a).replace(/'/g, "&#39;")})' class="text-blue-600 hover:text-blue-800 mr-2">編輯</button>
        <button onclick="deleteAlumni(\${a.id})" class="text-red-500 hover:text-red-700">刪除</button>
      </td>
    </tr>
    \`).join('')
    
    return \`
    <div class="bg-white rounded-xl shadow overflow-hidden mb-6">
      <div class="bg-gray-100 border-b px-4 py-3 font-bold text-gray-800 flex justify-between items-center">
        <span>\${year} 學年度</span>
        <button onclick="deleteYear(\${id}, '\${year}')" class="text-xs text-red-500 font-normal hover:text-red-700">刪除此屆</button>
      </div>
      <table class="w-full text-sm">
        <thead class="bg-gray-50 border-b text-xs text-gray-500">
          <tr>
            <th class="py-2 px-3 text-left w-20">學年度</th>
            <th class="py-2 px-3 text-left">姓名</th>
            <th class="py-2 px-3 text-left">英文名</th>
            <th class="py-2 px-3 text-left">小隊</th>
            <th class="py-2 px-3 text-left">職位</th>
            <th class="py-2 px-3 text-left">級別</th>
            <th class="py-2 px-3 text-left w-24">操作</th>
          </tr>
        </thead>
        <tbody>
          \${rows}
        </tbody>
      </table>
    </div>
    \`
  }).join('')`
);

// Replace the single table rendering with tablesHTML
code = code.replace(
  /<div class="bg-white rounded-xl shadow overflow-hidden">\s*<table class="w-full text-sm">[\s\S]*?<\/table>\s*<\/div>/,
  `\${tablesHTML}`
);

// Add deleteYear js function
code = code.replace(
  /async function deleteAlumni\(id\) \{/,
  `async function deleteYear(groupId, year) {
        if (!confirm('確定要刪除 ' + year + ' 學年度的所有名單嗎？此操作無法復原。')) return;
        const res = await fetch('/api/groups/' + groupId + '/alumni/' + year, { method: 'DELETE' });
        if (res.ok) location.reload();
        else alert('刪除失敗');
      }
      async function deleteAlumni(id) {`
);

fs.writeFileSync('src/routes/admin.tsx', code);
console.log('patched alumni admin');
const fs = require('fs');
let code = fs.readFileSync('src/routes/admin.tsx', 'utf8');

code = code.replace(
  /<span>\$\{year\} 學年度<\/span>/,
  `<span>第 \${parseInt(year) - 107} 屆 (\${year} 學年度)</span>`
);

fs.writeFileSync('src/routes/admin.tsx', code);
console.log('patched admin cohort');
const fs = require('fs')

let code = fs.readFileSync('src/routes/admin.tsx', 'utf8')

const oldBlock = `  let availableYears: string[] = []
  if (groupSections.length > 0) {
    const pyrRows = await db.prepare(
      \`SELECT DISTINCT year_label FROM member_year_records WHERE section IN (\${sectionPlaceholders}) ORDER BY year_label DESC\`
    ).bind(...groupSections).all()
    const penRows = await db.prepare(
      \`SELECT DISTINCT year_label FROM member_enrollments WHERE section IN (\${sectionPlaceholders}) ORDER BY year_label DESC\`
    ).bind(...groupSections).all()
    const yearSet = new Set<string>()
    ;(pyrRows.results as any[]).forEach((r: any) => yearSet.add(r.year_label))
    ;(penRows.results as any[]).forEach((r: any) => yearSet.add(r.year_label))
    availableYears = Array.from(yearSet).sort((a, b) => b.localeCompare(a))
  }`

const newBlock = `  const maxYear = Math.max(parseInt(currentYear) || 115, 115)
  let availableYears = Array.from({length: maxYear - 108 + 1}, (_, i) => String(108 + i)).reverse()`

code = code.replace(oldBlock, newBlock)

fs.writeFileSync('src/routes/admin.tsx', code)
console.log('Years patched')
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
const fs = require('fs')

let code = fs.readFileSync('src/routes/admin.tsx', 'utf8')

code = code.replace(
  '<th class="px-4 py-3 text-left text-xs font-medium text-gray-500">最高晉級紀錄</th>',
  '<th class="px-4 py-3 text-left text-xs font-medium text-gray-500">目前進程</th>'
)

fs.writeFileSync('src/routes/admin.tsx', code)
console.log('HTML patched')
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
const fs = require('fs');
let file = fs.readFileSync('src/routes/admin.tsx', 'utf8');

file = file.replace(/<button onclick="document.getElementById\('add-coach-modal'\).classList.remove\('hidden'\)"\n\s*class="bg-green-700 hover:bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium">＋ 新增教練<\/button>/, '<!-- button removed, use advancement page instead -->');

fs.writeFileSync('src/routes/admin.tsx', file);
console.log('Button hidden');

const fs = require('fs')

let code = fs.readFileSync('src/routes/admin.tsx', 'utf8')

// The block to replace:
const searchBlock = `  const tableRows = (alumni.results as any[]).map((a: any) => \`
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
  \`).join('')`

const replaceBlock = `  const tablesHTML = sortedYears.length === 0 ? '<div class="bg-white rounded-xl shadow p-8 text-center text-gray-400">尚無歷屆名單資料</div>' : sortedYears.map(year => {
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
        <span>第 \${parseInt(year) - 107} 屆 (\${year} 學年度)</span>
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

const searchHtml = `<div class="bg-white rounded-xl shadow overflow-hidden">
      <table class="w-full text-sm">
        <thead class="bg-gray-50 border-b text-xs text-gray-500">
          <tr>
            <th class="py-2 px-3 text-left">學年度</th>
            <th class="py-2 px-3 text-left">姓名</th>
            <th class="py-2 px-3 text-left">英文名</th>
            <th class="py-2 px-3 text-left">小隊</th>
            <th class="py-2 px-3 text-left">職位</th>
            <th class="py-2 px-3 text-left">級別</th>
            <th class="py-2 px-3 text-left">操作</th>
          </tr>
        </thead>
        <tbody>
          \${tableRows || '<tr><td colspan="7" class="py-8 text-center text-gray-400">尚無歷屆名單資料</td></tr>'}
        </tbody>
      </table>
    </div>`

const replaceHtml = `\${tablesHTML}`

if (code.includes(searchBlock) && code.includes(searchHtml)) {
  code = code.replace(searchBlock, replaceBlock)
  code = code.replace(searchHtml, replaceHtml)
  
  // also inject deleteYear JS script right after </script> in that file
  const searchScript = `async function deleteAlumni(id) {
      if (!confirm('確定刪除這筆歷屆名單？')) return
      await fetch('/api/admin/group-alumni/' + id, { method: 'DELETE' })
      location.reload()
    }`
  const replaceScript = `async function deleteAlumni(id) {
      if (!confirm('確定刪除這筆歷屆名單？')) return
      await fetch('/api/admin/group-alumni/' + id, { method: 'DELETE' })
      location.reload()
    }
    
    async function deleteYear(groupId, year) {
      if (!confirm('確定要刪除 ' + year + ' 學年度的所有歷屆名單嗎？此操作無法復原！')) return
      await fetch('/api/admin/group-alumni/year?groupId=' + groupId + '&year=' + year, { method: 'DELETE' })
      location.reload()
    }`
    
  if (code.includes(searchScript)) {
     code = code.replace(searchScript, replaceScript)
  }
  
  fs.writeFileSync('src/routes/admin.tsx', code)
  console.log("Patched successfully")
} else {
  console.log("Could not find the blocks")
}

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

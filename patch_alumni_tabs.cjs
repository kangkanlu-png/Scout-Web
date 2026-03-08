const fs = require('fs');
let code = fs.readFileSync('src/routes/admin.tsx', 'utf-8');

const regex = /const tablesHTML = sortedYears\.length === 0 \? '[\s\S]*?\}\)\.join\(''\)/;

let newBlock = `
  let tabsHTML = ''
  let tablesHTML = ''
  
  if (sortedYears.length === 0) {
    tablesHTML = '<div class="bg-white rounded-xl shadow p-8 text-center text-gray-400">尚無歷屆名單資料</div>'
  } else {
    tabsHTML = \`
      <div class="flex flex-wrap gap-2 mb-6 border-b border-gray-200 pb-2">
        \${sortedYears.map((year, idx) => \`
          <button onclick="switchYearTab('\${year}')" id="tab-\${year}" class="px-4 py-2 rounded-t-lg font-medium text-sm transition-colors \${idx === 0 ? 'bg-amber-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}">
            第 \${parseInt(year) - 107} 屆 (\${year})
          </button>
        \`).join('')}
      </div>
    \`
    
    tablesHTML = sortedYears.map((year, idx) => {
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
      <div id="pane-\${year}" class="alumni-pane \${idx !== 0 ? 'hidden' : ''}">
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
      </div>
      \`
    }).join('')
  }
`;

code = code.replace(regex, newBlock);

// also inject tabsHTML right above tablesHTML in the render string
code = code.replace('${tablesHTML}', '${tabsHTML}\n    ${tablesHTML}');

// add script for switchYearTab
const scriptRegex = /async function deleteYear\(groupId, year\) \{/;
const scriptInsert = `function switchYearTab(year) {
        document.querySelectorAll('.alumni-pane').forEach(el => el.classList.add('hidden'));
        document.querySelectorAll('[id^="tab-"]').forEach(el => {
          el.classList.remove('bg-amber-600', 'text-white');
          el.classList.add('bg-gray-100', 'text-gray-600');
        });
        document.getElementById('pane-' + year).classList.remove('hidden');
        document.getElementById('tab-' + year).classList.remove('bg-gray-100', 'text-gray-600');
        document.getElementById('tab-' + year).classList.add('bg-amber-600', 'text-white');
      }
      
      async function deleteYear(groupId, year) {`;

code = code.replace(scriptRegex, scriptInsert);

fs.writeFileSync('src/routes/admin.tsx', code);
console.log('Replaced alumni tabs');

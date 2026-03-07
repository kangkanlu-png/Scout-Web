const fs = require('fs');
let code = fs.readFileSync('src/routes/admin.tsx', 'utf8');

// 1. Add checkboxes to the approval table
code = code.replace(
  /<th class="px-4 py-3 text-left text-xs font-medium text-gray-500">成員<\/th>/,
  '<th class="px-4 py-3 text-left w-10"><input type="checkbox" id="selectAll" class="rounded border-gray-300 w-4 h-4" onclick="toggleAll(this.checked)"></th>\n            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500">成員</th>'
);

code = code.replace(
  /<tr class="hover:bg-gray-50" id="app-\$\{a\.id\}">/,
  '<tr class="hover:bg-gray-50" id="app-${a.id}">\n      <td class="px-4 py-3"><input type="checkbox" class="chk-app rounded border-gray-300 w-4 h-4" value="${a.id}"></td>'
);

// We need to add bulk action buttons above the table
code = code.replace(
  /<div class="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden mb-8">/,
  '<div class="mb-3 flex items-center gap-2 hidden" id="bulk-actions">\n      <span class="text-sm text-gray-600 mr-2">已選擇 <span id="sel-count" class="font-bold">0</span> 筆</span>\n      <button onclick="bulkStatus(\'approved\')" class="bg-green-600 hover:bg-green-500 text-white px-3 py-1.5 rounded-lg text-sm font-medium">✓ 批次核准</button>\n      <button onclick="bulkStatus(\'rejected\')" class="bg-red-500 hover:bg-red-400 text-white px-3 py-1.5 rounded-lg text-sm font-medium">✗ 批次拒絕</button>\n      <button onclick="bulkStatus(\'uploaded\')" class="bg-blue-500 hover:bg-blue-400 text-white px-3 py-1.5 rounded-lg text-sm font-medium">📤 批次已上傳</button>\n    </div>\n    <div class="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden mb-8">'
);

// 2. Add leave counts to the admin calendar
code = code.replace(
  /const blockedSet = new Set\(weekEvents\.results\.filter\(\(e:any\)=>e\.type==='blocked'\)\.map\(\(e:any\)=>e\.date as string\)\)/,
  "const blockedSet = new Set(weekEvents.results.filter((e:any)=>e.type==='blocked').map((e:any)=>e.date as string))\n\n  const weekLeaveCounts = await db.prepare(`\n    SELECT leave_date, COUNT(*) as cnt \n    FROM official_leave_applications \n    WHERE leave_date>=? AND leave_date<=? AND status='approved'\n    GROUP BY leave_date\n  `).bind(wStart, wEnd).all()\n  const leaveCountMap: Record<string,number> = {}\n  weekLeaveCounts.results.forEach((r:any) => { leaveCountMap[r.leave_date] = r.cnt })"
);

code = code.replace(
  /\$\{isBlocked \? '<div class="text-xs text-red-600 mb-1">⛔ 已封鎖<\/div>' : '<div class="text-xs text-gray-300 mb-1">無<\/div>'}/,
  "${isBlocked ? '<div class=\"text-xs text-red-600 mb-1\">⛔ 已封鎖</div>' : ''}\n        ${leaveCountMap[dStr] ? `<div class=\"text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded mb-1 font-medium text-center\">${leaveCountMap[dStr]} 人公假</div>` : '<div class=\"text-xs text-gray-300 mb-1 text-center\">無公假</div>'}"
);

// 3. Add script functions for checkboxes
const scriptInjection = `
  <script>
    function toggleAll(checked) {
      document.querySelectorAll('.chk-app').forEach(cb => cb.checked = checked);
      updateBulkUi();
    }
    
    setTimeout(() => {
      document.querySelectorAll('.chk-app').forEach(cb => {
        cb.addEventListener('change', updateBulkUi);
      });
    }, 100);
    
    function updateBulkUi() {
      const checked = document.querySelectorAll('.chk-app:checked').length;
      const bulkDiv = document.getElementById('bulk-actions');
      const countSpan = document.getElementById('sel-count');
      if (bulkDiv && countSpan) {
        if (checked > 0) {
          bulkDiv.classList.remove('hidden');
          countSpan.textContent = checked;
        } else {
          bulkDiv.classList.add('hidden');
        }
      }
    }
    
    async function bulkStatus(status) {
      const ids = Array.from(document.querySelectorAll('.chk-app:checked')).map(cb => cb.value);
      if (ids.length === 0) return;
      
      const actionName = status === 'approved' ? '核准' : status === 'rejected' ? '拒絕' : '標記為已上傳';
      if (!confirm('確定要批次' + actionName + '這 ' + ids.length + ' 筆申請嗎？')) return;
      
      let success = 0;
      for (const id of ids) {
        try {
          const res = await fetch('/api/official-leave/'+id, {
            method:'PUT', headers:{'Content-Type':'application/json'},
            body:JSON.stringify({status})
          });
          if (res.ok) success++;
        } catch(e) {}
      }
      alert('批次處理完成！成功：' + success + ' 筆');
      location.reload();
    }
`;

code = code.replace(/<script>\s*async function setStatus/, scriptInjection + '\n    async function setStatus');

fs.writeFileSync('src/routes/admin.tsx', code);
console.log('Official Leave admin patched');

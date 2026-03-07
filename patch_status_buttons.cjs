const fs = require('fs');
const file = 'src/routes/admin.tsx';
let code = fs.readFileSync(file, 'utf8');

// Replace the status buttons div
const oldButtons = `<div class="flex flex-wrap gap-1">
          \${a.status !== 'approved' ? \`<button onclick="setStatus('\${a.id}','approved')" class="bg-green-600 hover:bg-green-500 text-white text-xs px-2 py-1 rounded">✓ 核准</button>\` : ''}
          \${a.status !== 'rejected' ? \`<button onclick="setStatus('\${a.id}','rejected')" class="bg-red-500 hover:bg-red-400 text-white text-xs px-2 py-1 rounded">✗ 拒絕</button>\` : ''}
          \${a.status === 'approved' ? \`<button onclick="setStatus('\${a.id}','uploaded')" class="bg-blue-500 hover:bg-blue-400 text-white text-xs px-2 py-1 rounded">📤 已上傳</button>\` : ''}
        </div>`;

const newButtons = `<div class="flex flex-wrap gap-1">
          \${a.status !== 'approved' ? \`<button onclick="setStatus('\${a.id}','approved')" class="bg-green-600 hover:bg-green-500 text-white text-xs px-2 py-1 rounded shadow-sm">✓ 核准</button>\` : ''}
          \${a.status !== 'rejected' ? \`<button onclick="setStatus('\${a.id}','rejected')" class="bg-red-500 hover:bg-red-400 text-white text-xs px-2 py-1 rounded shadow-sm">✗ 拒絕</button>\` : ''}
          \${a.status === 'approved' ? \`<button onclick="setStatus('\${a.id}','uploaded')" class="bg-blue-500 hover:bg-blue-400 text-white text-xs px-2 py-1 rounded shadow-sm">📤 已上傳</button>\` : ''}
        </div>
        <div class="mt-2 flex items-center gap-1.5">
          <input type="checkbox" id="email-\${a.id}" class="w-3 h-3 text-blue-600 rounded border-gray-300 focus:ring-blue-500" \${a.status === 'pending' ? 'checked' : ''}>
          <label for="email-\${a.id}" class="text-[10px] text-gray-500 cursor-pointer select-none">發送 Email 通知</label>
        </div>`;

code = code.replace(oldButtons, newButtons);

// Update setStatus function
const oldSetStatus = `    async function setStatus(id, status) {
      const note = status === 'rejected' ? (prompt('拒絕原因（選填）：') || '') : ''
      const send_email = confirm('是否發送 Email 通知該學員？');
      const res = await fetch('/api/admin/official-leave/' + id, {
        method: 'PUT', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ status, admin_note: note || null, send_email })
      })`;

const newSetStatus = `    async function setStatus(id, status) {
      const note = status === 'rejected' ? (prompt('拒絕原因（選填）：') || '') : ''
      const cb = document.getElementById('email-' + id);
      const send_email = cb ? cb.checked : false;
      const res = await fetch('/api/admin/official-leave/' + id, {
        method: 'PUT', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ status, admin_note: note || null, send_email })
      })`;

code = code.replace(oldSetStatus, newSetStatus);

fs.writeFileSync(file, code);
console.log('patched official leave buttons and email checkbox');

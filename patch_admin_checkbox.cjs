const fs = require('fs');
const file = 'src/routes/admin.tsx';
let code = fs.readFileSync(file, 'utf8');

// 1. Registrations
const regOld = `      async function updateStatus(id, status) {
        if (!confirm('確定要將狀態更新為 ' + status + ' 嗎？')) return;
        const res = await fetch('/api/registrations/' + id, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status })
        });`;
const regNew = `      async function updateStatus(id, status) {
        if (!confirm('確定要將狀態更新為 ' + status + ' 嗎？')) return;
        const send_email = confirm('是否發送 Email 通知該學員？');
        const res = await fetch('/api/registrations/' + id, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status, send_email })
        });`;
code = code.replace(regOld, regNew);

// 2. Official leave
const offLeaveOld = `    async function setStatus(id, status) {
      const note = status === 'rejected' ? (prompt('拒絕原因（選填）：') || '') : ''
      const res = await fetch('/api/admin/official-leave/' + id, {
        method: 'PUT', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ status, admin_note: note || null })
      })`;
const offLeaveNew = `    async function setStatus(id, status) {
      const note = status === 'rejected' ? (prompt('拒絕原因（選填）：') || '') : ''
      const send_email = confirm('是否發送 Email 通知該學員？');
      const res = await fetch('/api/admin/official-leave/' + id, {
        method: 'PUT', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ status, admin_note: note || null, send_email })
      })`;
code = code.replace(offLeaveOld, offLeaveNew);

// 3. General leave
const leaveOld = `      let admin_note = ''
      if (status === 'rejected') {
        admin_note = prompt('拒絕原因（選填）') || ''
      }
      const res = await fetch('/api/admin/leaves/' + id, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, admin_note })
      })`;
const leaveNew = `      let admin_note = ''
      if (status === 'rejected') {
        admin_note = prompt('拒絕原因（選填）') || ''
      }
      const send_email = confirm('是否發送 Email 通知該學員？');
      const res = await fetch('/api/admin/leaves/' + id, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, admin_note, send_email })
      })`;
code = code.replace(leaveOld, leaveNew);

// 4. Advancement
const advOld = `        const notes = document.getElementById('admin_notes')?.value || '';
        
        try {
          const res = await fetch(\`/api/admin/advancement/\${app.id}\`, {
            method: 'PUT',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ status, admin_notes: notes })
          });`;
const advNew = `        const notes = document.getElementById('admin_notes')?.value || '';
        const send_email = confirm('是否發送 Email 通知該學員？');
        
        try {
          const res = await fetch(\`/api/admin/advancement/\${app.id}\`, {
            method: 'PUT',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ status, admin_notes: notes, send_email })
          });`;
code = code.replace(advOld, advNew);

fs.writeFileSync(file, code);
console.log("Patched admin.tsx");

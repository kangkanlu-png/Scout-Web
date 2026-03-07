const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, 'src/routes/member.tsx');
let content = fs.readFileSync(file, 'utf-8');

// Update regModal HTML to add file input
const oldRegModal = `<div class="mb-4">
            <label class="block text-sm font-medium text-gray-700 mb-1">備註 (飲食習慣、特殊需求等)</label>
            <textarea id="regNotes" rows="3" class="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 outline-none"></textarea>
          </div>`;

const newRegModal = `<div class="mb-4">
            <label class="block text-sm font-medium text-gray-700 mb-1">備註 (飲食習慣、特殊需求等)</label>
            <textarea id="regNotes" rows="2" class="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 outline-none"></textarea>
          </div>
          <div class="mb-5">
            <label class="block text-sm font-medium text-gray-700 mb-1">家長同意書 / 報名附件 (可選)</label>
            <input type="file" id="regFile" class="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none bg-gray-50">
            <p class="text-xs text-gray-500 mt-1">支援上傳圖檔或PDF文件，大小不超過10MB</p>
          </div>`;

content = content.replace(oldRegModal, newRegModal);

// Update submitRegistration function
const oldSubmit = `      async function submitRegistration() {
        const id = document.getElementById('regActivityId').value;
        const notes = document.getElementById('regNotes').value;
        
        if (!confirm('確定要報名此活動嗎？')) return;

        try {
          const res = await fetch('/api/activities/' + id + '/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_notes: notes })
          });`;

const newSubmit = `      async function submitRegistration() {
        const id = document.getElementById('regActivityId').value;
        const notes = document.getElementById('regNotes').value;
        const fileInput = document.getElementById('regFile');
        const submitBtn = document.querySelector('#regModal button[onclick="submitRegistration()"]');
        
        if (!confirm('確定要報名此活動嗎？')) return;

        try {
          let file_url = null;
          
          if (fileInput && fileInput.files.length > 0) {
            submitBtn.textContent = '上傳檔案中...';
            submitBtn.disabled = true;
            
            const formData = new FormData();
            formData.append('file', fileInput.files[0]);
            
            const uploadRes = await fetch('/api/upload', {
              method: 'POST',
              body: formData
            });
            const uploadData = await uploadRes.json();
            if (!uploadData.success) {
              alert('檔案上傳失敗：' + (uploadData.error || ''));
              submitBtn.textContent = '確認報名';
              submitBtn.disabled = false;
              return;
            }
            file_url = uploadData.file_url;
          }
          
          submitBtn.textContent = '送出報名中...';
          
          // 將檔案連結放入 user_notes 中，或如果是 JSON，可以放到 registration_data (後端需要處理)
          // 為了簡單起見，我們將附檔連結接在 user_notes 中
          const finalNotes = file_url ? (notes ? notes + '\\n\\n[附件]: ' + file_url : '[附件]: ' + file_url) : notes;

          const res = await fetch('/api/activities/' + id + '/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_notes: finalNotes })
          });`;

content = content.replace(oldSubmit, newSubmit);

fs.writeFileSync(file, content);
console.log('Patched Activity Registration file upload');

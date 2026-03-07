const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, 'src/routes/member.tsx');
let content = fs.readFileSync(file, 'utf-8');

// Update advForm HTML
const oldFormHtml = `        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">申請日期</label>
          <input type="date" name="apply_date" value="\${new Date().toISOString().slice(0,10)}" required
            class="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm">
        </div>
        <div id="advFormMsg"></div>`;

const newFormHtml = `        <div class="grid sm:grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">申請日期</label>
            <input type="date" name="apply_date" id="adv_apply_date" value="\${new Date().toISOString().slice(0,10)}" required
              class="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm">
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">佐證資料 (可選)</label>
            <input type="file" id="adv_evidence_file" accept=".pdf,.jpg,.jpeg,.png"
              class="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm bg-white">
          </div>
        </div>
        <div id="advFormMsg"></div>`;

content = content.replace(oldFormHtml, newFormHtml);

// Add advForm submit event listener inside tabAdvancementHtml or at the end of the script block
const scriptCode = `
  document.getElementById('reportModal').addEventListener('click', function(e) {
    if (e.target === this) this.classList.add('hidden');
  });

  // 晉升申請表單處理
  const advForm = document.getElementById('advForm');
  if (advForm) {
    advForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const msg = document.getElementById('advFormMsg');
      const rankToSel = advForm.querySelector('select[name="rank_to"]');
      const rankToOpt = rankToSel.selectedOptions[0];
      const rank_from = rankToOpt.dataset.from;
      const rank_to = rankToOpt.value;
      const apply_date = document.getElementById('adv_apply_date').value;
      const fileInput = document.getElementById('adv_evidence_file');
      
      msg.innerHTML = '<p class="text-blue-500 text-sm">處理中...</p>';
      
      try {
        let evidence_file = null;
        // 處理檔案上傳
        if (fileInput && fileInput.files.length > 0) {
          msg.innerHTML = '<p class="text-blue-500 text-sm">上傳檔案中...</p>';
          const formData = new FormData();
          formData.append('file', fileInput.files[0]);
          
          const uploadRes = await fetch('/api/upload', {
            method: 'POST',
            body: formData
          });
          const uploadData = await uploadRes.json();
          if (!uploadData.success) {
            msg.innerHTML = '<p class="text-red-500 text-sm">檔案上傳失敗：' + (uploadData.error || '') + '</p>';
            return;
          }
          evidence_file = uploadData.file_url;
        }

        // 送出申請
        msg.innerHTML = '<p class="text-blue-500 text-sm">送出申請中...</p>';
        const res = await fetch('/api/member/advancement', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rank_from, rank_to, apply_date, evidence_file })
        });
        
        const data = await res.json();
        if (data.success) {
          msg.innerHTML = '<p class="text-green-600 text-sm">✅ 申請已送出！</p>';
          setTimeout(() => location.reload(), 1500);
        } else {
          msg.innerHTML = '<p class="text-red-500 text-sm">❌ 申請失敗：' + (data.error || '') + '</p>';
        }
      } catch (err) {
        msg.innerHTML = '<p class="text-red-500 text-sm">❌ 網路錯誤</p>';
      }
    });
  }
`;

content = content.replace(/  document\.getElementById\('reportModal'\)\.addEventListener\('click', function\(e\) \{\n    if \(e\.target === this\) this\.classList\.add\('hidden'\);\n  \}\);/g, scriptCode);

fs.writeFileSync(file, content);
console.log('Patched advForm file upload');

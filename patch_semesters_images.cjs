const fs = require('fs');
let code = fs.readFileSync('src/routes/admin.tsx', 'utf-8');

const regex = /adminRoutes\.get\('\/semesters\/:id\/images', authMiddleware, async \(c\) => \{[\s\S]*?<\/script>\n  \`\)\)\n\}\)/;

let newBlock = `adminRoutes.get('/semesters/:id/images', authMiddleware, async (c) => {
  const db = c.env.DB
  const semId = c.req.param('id')
  const semester = await db.prepare(\`
    SELECT gs.*, sg.name as group_name, sg.slug as group_slug, sg.id as group_id
    FROM group_semesters gs
    JOIN scout_groups sg ON sg.id = gs.group_id
    WHERE gs.id=?
  \`).bind(semId).first() as any
  if (!semester) return c.redirect('/admin/groups')

  const images = await db.prepare(\`SELECT * FROM semester_images WHERE semester_id=? ORDER BY display_order ASC\`).bind(semId).all()

  const imgCards = images.results.map((img: any) => \`
    <div class="bg-white border rounded-xl overflow-hidden shadow-sm" id="si-\${img.id}">
      <div class="aspect-video bg-gray-100 overflow-hidden">
        <img src="\${img.image_url}" alt="\${img.caption || ''}" class="w-full h-full object-cover"
          onerror="this.parentElement.innerHTML='<div class=\\'flex items-center justify-center h-full text-gray-400 text-sm\\'>圖片無法顯示</div>'">
      </div>
      <div class="p-3">
        <p class="text-xs text-gray-500 break-all mb-1">\${img.image_url.length > 60 ? img.image_url.substring(0,60) + '...' : img.image_url}</p>
        <p class="text-xs text-gray-600">\${img.caption || '（無說明）'}</p>
        <button onclick="deleteSemImg(\${img.id})" class="mt-2 text-red-500 hover:text-red-700 text-xs font-medium">🗑 刪除</button>
      </div>
    </div>
  \`).join('')

  return c.html(adminLayout(\`相片管理：\${semester.group_name} \${semester.semester}\`, \`
    <div class="flex justify-between items-center mb-6">
      <div>
        <h2 class="text-xl font-bold text-gray-800">相片管理</h2>
        <p class="text-gray-500 text-sm">\${semester.group_name} › \${semester.title || semester.semester}</p>
      </div>
      <div class="flex gap-2">
        <a href="/admin/groups/\${semester.group_id}/semesters" class="text-gray-500 hover:text-gray-700 text-sm py-2 px-3">← 返回學期列表</a>
        <a href="/group/\${semester.group_slug}/\${semester.semester}" target="_blank" class="text-green-600 hover:text-green-800 text-sm py-2 px-3 border border-green-200 rounded-lg">🌐 預覽前台</a>
      </div>
    </div>

    <!-- 批量新增 / 單一新增 -->
    <div class="bg-white rounded-xl shadow p-6 mb-6">
      <h3 class="font-bold text-gray-700 mb-1">➕ 新增相片</h3>
      <p class="text-sm text-gray-400 mb-4">您可以直接上傳圖片，或貼上外部圖片網址（可一次填入多個網址，每行一個）。</p>
      
      <!-- 檔案上傳區 -->
      <div class="mb-6 p-4 border border-dashed border-gray-300 rounded-lg bg-gray-50">
        <label class="block text-sm font-medium text-gray-700 mb-2">上傳本機圖片</label>
        <div class="flex items-center gap-3">
          <input type="file" id="sem-upload-file" accept="image/*" multiple class="text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-green-50 file:text-green-700 hover:file:bg-green-100">
          <button onclick="uploadSemFiles(\${semId})" id="btn-sem-upload" class="bg-green-700 hover:bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">上傳檔案</button>
        </div>
        <p id="sem-upload-status" class="text-sm text-gray-500 mt-2 hidden"></p>
      </div>

      <div class="space-y-3">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">圖片網址（每行一個）</label>
          <textarea id="bulk-urls" rows="4" class="w-full border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-green-500" placeholder="https://example.com/photo1.jpg\\nhttps://example.com/photo2.jpg\\n..."></textarea>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">說明（批量時套用相同說明，可留空）</label>
            <input type="text" id="bulk-caption" placeholder="圖片說明（選填）" class="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">起始排序</label>
            <input type="number" id="bulk-order" value="\${images.results.length}" class="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
          </div>
        </div>
        <div id="bulk-preview" class="hidden">
          <p class="text-sm text-gray-600 mb-2">預覽（第一張）：</p>
          <img id="bulk-preview-img" src="" class="max-h-40 rounded-lg border">
        </div>
        <div class="flex gap-2">
          <button onclick="previewBulk()" class="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm">預覽首張網址</button>
          <button onclick="addBulkImages(\${semId})" class="bg-green-700 hover:bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium">新增網址圖片</button>
        </div>
      </div>
    </div>

    <!-- 現有相片 -->
    <div class="bg-white rounded-xl shadow p-6">
      <div class="flex items-center justify-between mb-4">
        <h3 class="font-bold text-gray-700">現有相片（\${images.results.length} 張）</h3>
      </div>
      <div id="images-grid" class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
        \${imgCards || '<p class="text-gray-400 text-sm col-span-full text-center py-8">尚無相片</p>'}
      </div>
    </div>

    <script>
      function previewBulk() {
        const urls = document.getElementById('bulk-urls').value.trim().split('\\\\\\\\n').filter(u => u.trim());
        if (!urls.length) return;
        document.getElementById('bulk-preview-img').src = urls[0].trim();
        document.getElementById('bulk-preview').classList.remove('hidden');
      }

      async function addBulkImages(semId) {
        const urls = document.getElementById('bulk-urls').value.trim().split('\\\\\\\\n').map(u => u.trim()).filter(u => u);
        const caption = document.getElementById('bulk-caption').value;
        let startOrder = parseInt(document.getElementById('bulk-order').value) || 0;
        if (!urls.length) { alert('請輸入至少一個圖片網址'); return; }
        
        let success = 0;
        for (const url of urls) {
          const res = await fetch('/api/semesters/' + semId + '/images', {
            method: 'POST',
            headers: {'Content-Type':'application/json'},
            body: JSON.stringify({ image_url: url, caption: caption || null, display_order: startOrder++ })
          });
          if (res.ok) success++;
        }
        if (success > 0) {
          alert('成功新增 ' + success + ' 張相片');
          location.reload();
        } else {
          alert('新增失敗，請檢查網址是否正確');
        }
      }

      async function uploadSemFiles(semId) {
        const fileInput = document.getElementById('sem-upload-file');
        const files = fileInput.files;
        if (files.length === 0) return alert('請選擇檔案');
        
        const btn = document.getElementById('btn-sem-upload');
        const status = document.getElementById('sem-upload-status');
        btn.disabled = true;
        btn.textContent = '上傳中...';
        status.classList.remove('hidden');
        
        let successCount = 0;
        let failCount = 0;
        let startOrder = parseInt(document.getElementById('bulk-order').value) || 0;
        const caption = document.getElementById('bulk-caption').value;

        for (let i = 0; i < files.length; i++) {
          status.textContent = \`正在上傳第 \${i+1} / \${files.length} 張...\`;
          const formData = new FormData();
          formData.append('file', files[i]);
          
          try {
            const uploadRes = await fetch('/api/upload', {
              method: 'POST',
              body: formData
            });
            const uploadData = await uploadRes.json();
            
            if (uploadData.success && uploadData.file_url) {
              const saveRes = await fetch('/api/semesters/' + semId + '/images', {
                method: 'POST',
                headers: {'Content-Type':'application/json'},
                body: JSON.stringify({ image_url: uploadData.file_url, caption: caption || null, display_order: startOrder++ })
              });
              if (saveRes.ok) successCount++;
              else failCount++;
            } else {
              failCount++;
            }
          } catch(e) {
            failCount++;
          }
        }
        
        btn.textContent = '上傳檔案';
        btn.disabled = false;
        alert(\`上傳完成！成功：\${successCount} 張，失敗：\${failCount} 張\`);
        if (successCount > 0) location.reload();
      }

      async function deleteSemImg(id) {
        if (!confirm('確定要刪除此相片嗎？')) return;
        const res = await fetch('/api/semester-images/' + id, { method: 'DELETE' });
        if (res.ok) document.getElementById('si-' + id).remove();
        else alert('刪除失敗');
      }
    </script>
  \`))
})`

code = code.replace(regex, newBlock);
fs.writeFileSync('src/routes/admin.tsx', code);
console.log('Replaced /semesters/:id/images');

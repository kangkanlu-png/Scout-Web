const fs = require('fs');
let code = fs.readFileSync('src/routes/admin.tsx', 'utf-8');

const regex = /adminRoutes\.get\('\/activities\/:id\/images', authMiddleware, async \(c\) => \{[\s\S]*?<\/script>\\n  \`\)\)\n\}\)/;

let newBlock = `adminRoutes.get('/activities/:id/images', authMiddleware, async (c) => {
  const db = c.env.DB
  const id = c.req.param('id')
  const activity = await db.prepare("SELECT * FROM activities WHERE id = ?").bind(id).first() as any
  if (!activity) return c.redirect('/admin/activities')
  const images = await db.prepare("SELECT * FROM activity_images WHERE activity_id = ? ORDER BY display_order").bind(id).all()

  const imgCards = images.results.map((img: any) => \`
    <div class="bg-white border rounded-xl overflow-hidden shadow-sm" id="img-\${img.id}">
      <div class="aspect-video bg-gray-100 overflow-hidden">
        <img src="\${img.image_url}" alt="\${img.caption || ''}" class="w-full h-full object-cover" onerror="this.parentElement.innerHTML='<div class=\\'flex items-center justify-center h-full text-gray-400 text-sm\\'>圖片無法顯示</div>'">
      </div>
      <div class="p-3">
        <p class="text-xs text-gray-500 break-all mb-1">\${img.image_url.length > 60 ? img.image_url.substring(0,60) + '...' : img.image_url}</p>
        <p class="text-xs text-gray-600">\${img.caption || '（無說明）'}</p>
        <button onclick="deleteImage(\${img.id})" class="mt-2 text-red-500 hover:text-red-700 text-xs font-medium">🗑 刪除</button>
      </div>
    </div>
  \`).join('')

  return c.html(adminLayout(\`圖片管理：\${activity.title}\`, \`
    <div class="flex justify-between items-center mb-6">
      <div>
        <h2 class="text-xl font-bold text-gray-800">圖片管理</h2>
        <p class="text-gray-500 text-sm">\${activity.title}</p>
      </div>
      <a href="/admin/activities" class="text-gray-500 hover:text-gray-700 text-sm">← 返回活動列表</a>
    </div>

    <div class="bg-white rounded-xl shadow p-6 mb-6">
      <h3 class="font-bold text-gray-700 mb-1">➕ 新增相片</h3>
      <p class="text-sm text-gray-400 mb-4">您可以直接上傳圖片，或貼上外部圖片網址（可一次填入多個網址，每行一個）。</p>
      
      <div class="mb-6 p-4 border border-dashed border-gray-300 rounded-lg bg-gray-50">
        <label class="block text-sm font-medium text-gray-700 mb-2">上傳本機圖片</label>
        <div class="flex items-center gap-3">
          <input type="file" id="image-upload-file" accept="image/*" multiple class="text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-green-50 file:text-green-700 hover:file:bg-green-100">
          <button onclick="uploadFiles(\${id})" id="btn-upload" class="bg-green-700 hover:bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">上傳檔案</button>
        </div>
        <p id="upload-status" class="text-sm text-gray-500 mt-2 hidden"></p>
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
          <button onclick="addBulkImages(\${id})" class="bg-green-700 hover:bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium">新增網址圖片</button>
        </div>
      </div>
    </div>

    <div class="bg-white rounded-xl shadow p-6">
      <h3 class="font-bold text-gray-700 mb-4">現有圖片（\${images.results.length} 張）</h3>
      <div id="images-grid" class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        \${imgCards || '<p class="text-gray-400 text-sm col-span-full text-center py-8">尚無圖片</p>'}
      </div>
    </div>

    <script>
      function previewBulk() {
        const urls = document.getElementById('bulk-urls').value.trim().split('\\\\n').filter(u => u.trim());
        if (!urls.length) return;
        document.getElementById('bulk-preview-img').src = urls[0].trim();
        document.getElementById('bulk-preview').classList.remove('hidden');
      }

      async function addBulkImages(activityId) {
        const urls = document.getElementById('bulk-urls').value.trim().split('\\\\n').map(u => u.trim()).filter(u => u);
        const caption = document.getElementById('bulk-caption').value;
        let startOrder = parseInt(document.getElementById('bulk-order').value) || 0;
        if (!urls.length) { alert('請輸入至少一個圖片網址'); return; }
        
        let success = 0;
        for (const url of urls) {
          const res = await fetch('/api/admin/activities/' + activityId + '/images', {
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

      async function uploadFiles(activityId) {
        const fileInput = document.getElementById('image-upload-file');
        const files = fileInput.files;
        if (files.length === 0) return alert('請選擇檔案');
        
        const btn = document.getElementById('btn-upload');
        const status = document.getElementById('upload-status');
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
              const saveRes = await fetch('/api/admin/activities/' + activityId + '/images', {
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

      async function deleteImage(id) {
        if (!confirm('確定要刪除這張圖片嗎？')) return;
        const res = await fetch('/api/admin/activities/images/' + id, { method: 'DELETE' });
        if (res.ok) {
          document.getElementById('img-' + id).remove();
        } else {
          alert('刪除失敗');
        }
      }
    </script>
  \`))
})`

code = code.replace(regex, newBlock);
fs.writeFileSync('src/routes/admin.tsx', code);
console.log('Replaced /activities/:id/images');

const fs = require('fs');
const file = 'src/routes/admin.tsx';
let code = fs.readFileSync(file, 'utf8');

const oldHtml = `    <!-- 新增圖片 -->
    <div class="bg-white rounded-xl shadow p-6 mb-6">
      <h3 class="font-bold text-gray-700 mb-4">➕ 新增圖片</h3>
      <p class="text-sm text-gray-500 mb-3">請輸入圖片的網址（URL）。建議先將圖片上傳至 Google Drive、Imgur 等圖床，再貼上連結。</p>
      <div class="space-y-3">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">圖片網址 *</label>
          <input type="url" id="new-image-url" placeholder="https://..." class="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">圖片說明</label>
          <input type="text" id="new-image-caption" placeholder="圖片說明（選填）" class="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">排序（數字越小越前面）</label>
          <input type="number" id="new-image-order" value="\${images.results.length}" class="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
        </div>
        <div id="preview-area" class="hidden">
          <p class="text-sm text-gray-600 mb-1">預覽：</p>
          <img id="preview-img" src="" class="max-h-40 rounded-lg border">
        </div>
        <button onclick="previewImage()" class="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm">預覽圖片</button>
        <button onclick="addImage(\${id})" class="bg-green-700 hover:bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium ml-2">新增圖片</button>
      </div>
    </div>`;

const newHtml = `    <!-- 批次新增圖片 -->
    <div class="bg-white rounded-xl shadow overflow-hidden mb-6">
      <div class="bg-gray-50 border-b flex px-4">
        <button id="tab-upload" class="px-4 py-3 font-bold text-green-700 border-b-2 border-green-700" onclick="switchTab('upload')">批次上傳相片</button>
        <button id="tab-url" class="px-4 py-3 font-bold text-gray-500 hover:text-gray-700" onclick="switchTab('url')">批次貼上網址</button>
      </div>
      
      <div class="p-6">
        <!-- 上傳模式 -->
        <div id="mode-upload" class="space-y-4">
          <p class="text-sm text-gray-500">可一次選取多張相片直接上傳到系統中（系統將自動儲存至雲端）。</p>
          <div class="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center bg-gray-50 relative hover:bg-gray-100 transition cursor-pointer">
            <input type="file" id="batch-files" multiple accept="image/*" class="absolute inset-0 w-full h-full opacity-0 cursor-pointer" onchange="handleFileSelect(event)">
            <p class="text-gray-600 font-medium">點擊或拖曳多個相片到此處</p>
            <p class="text-xs text-gray-400 mt-1">單檔上限 10MB，建議一次最多上傳 20 張</p>
          </div>
          <div id="upload-preview" class="grid grid-cols-3 md:grid-cols-5 gap-3 mt-4"></div>
          <button id="btn-start-upload" onclick="startBatchUpload(\${activity.id})" class="hidden bg-green-700 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-green-600 w-full mt-4">開始上傳 (<span id="upload-count">0</span>)</button>
          <p id="upload-status" class="text-sm text-center font-medium mt-2 hidden text-green-600"></p>
        </div>

        <!-- 網址模式 -->
        <div id="mode-url" class="hidden space-y-4">
          <p class="text-sm text-gray-500">若相片已在外部圖床（如 Imgur 等），請將圖片的直接連結（URL）貼在下方，每行一個網址。</p>
          <textarea id="batch-urls" rows="6" placeholder="https://...\\nhttps://..." class="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"></textarea>
          <input type="text" id="batch-caption" placeholder="統一圖片說明（選填）" class="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
          <button onclick="startBatchUrl(\${activity.id})" class="bg-green-700 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-green-600 w-full">開始匯入</button>
        </div>
      </div>
    </div>`;

const oldScript = `      function previewImage() {
        const url = document.getElementById('new-image-url').value;
        if (url) {
          document.getElementById('preview-img').src = url;
          document.getElementById('preview-area').classList.remove('hidden');
        }
      }

      async function addImage(activityId) {
        const url = document.getElementById('new-image-url').value;
        const caption = document.getElementById('new-image-caption').value;
        const order = document.getElementById('new-image-order').value;
        if (!url) { alert('請輸入圖片網址'); return; }
        const res = await fetch('/api/activities/' + activityId + '/images', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image_url: url, caption, display_order: parseInt(order) || 0 })
        });
        if (res.ok) location.reload();
        else alert('新增失敗，請檢查網址是否正確');
      }`;

const newScript = `      let selectedFiles = [];
      
      function switchTab(tab) {
        const tUp = document.getElementById('tab-upload'), tUrl = document.getElementById('tab-url');
        const mUp = document.getElementById('mode-upload'), mUrl = document.getElementById('mode-url');
        
        if (tab === 'upload') {
          tUp.className = 'px-4 py-3 font-bold text-green-700 border-b-2 border-green-700';
          tUrl.className = 'px-4 py-3 font-bold text-gray-500 hover:text-gray-700';
          mUp.classList.remove('hidden');
          mUrl.classList.add('hidden');
        } else {
          tUrl.className = 'px-4 py-3 font-bold text-green-700 border-b-2 border-green-700';
          tUp.className = 'px-4 py-3 font-bold text-gray-500 hover:text-gray-700';
          mUrl.classList.remove('hidden');
          mUp.classList.add('hidden');
        }
      }

      function handleFileSelect(e) {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;
        selectedFiles = files;
        
        const previewArea = document.getElementById('upload-preview');
        previewArea.innerHTML = '';
        
        files.forEach((file, idx) => {
          const reader = new FileReader();
          reader.onload = (ev) => {
            previewArea.innerHTML += \`<div class="aspect-square bg-gray-100 rounded overflow-hidden border relative">
              <img src="\${ev.target.result}" class="w-full h-full object-cover">
              <div class="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-[10px] px-1 truncate">\${file.name}</div>
            </div>\`;
          };
          reader.readAsDataURL(file);
        });
        
        document.getElementById('upload-count').textContent = files.length;
        document.getElementById('btn-start-upload').classList.remove('hidden');
      }

      async function startBatchUpload(activityId) {
        if (selectedFiles.length === 0) return;
        const btn = document.getElementById('btn-start-upload');
        const status = document.getElementById('upload-status');
        btn.disabled = true;
        btn.classList.add('opacity-50');
        status.classList.remove('hidden');
        
        let success = 0;
        let startOrder = \${images.results.length};
        
        for (let i = 0; i < selectedFiles.length; i++) {
          status.textContent = \`正在上傳 \${i + 1} / \${selectedFiles.length} ...\`;
          
          const fd = new FormData();
          fd.append('file', selectedFiles[i]);
          
          try {
            const upRes = await fetch('/api/upload', { method: 'POST', body: fd });
            const upData = await upRes.json();
            
            if (upData.success && upData.file_url) {
              await fetch('/api/activities/' + activityId + '/images', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                  image_url: upData.file_url, 
                  caption: null, 
                  display_order: startOrder++ 
                })
              });
              success++;
            }
          } catch(e) { console.error(e); }
        }
        
        status.textContent = \`上傳完成！成功：\${success} 張\`;
        setTimeout(() => location.reload(), 1000);
      }

      async function startBatchUrl(activityId) {
        const text = document.getElementById('batch-urls').value.trim();
        const caption = document.getElementById('batch-caption').value.trim() || null;
        if (!text) { alert('請貼上圖片網址'); return; }
        
        const urls = text.split('\\n').map(s => s.trim()).filter(s => s);
        if (urls.length === 0) return;
        
        let success = 0;
        let startOrder = \${images.results.length};
        
        for (const url of urls) {
          const res = await fetch('/api/activities/' + activityId + '/images', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image_url: url, caption, display_order: startOrder++ })
          });
          if (res.ok) success++;
        }
        
        if (success > 0) {
          alert(\`成功匯入 \${success} 張圖片！\`);
          location.reload();
        } else {
          alert('匯入失敗，請檢查網址格式');
        }
      }`;

code = code.replace(oldHtml, newHtml);
code = code.replace(oldScript, newScript);

fs.writeFileSync(file, code);
console.log("Patched image bulk upload!");

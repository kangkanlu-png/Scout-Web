const fs = require('fs');
const file = 'src/routes/admin.tsx';
let code = fs.readFileSync(file, 'utf8');

const newScript = `      let selectedFiles = [];
      
      function switchImageTab(tab) {
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
        let startOrder = document.querySelectorAll('.aspect-video').length;
        
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
        let startOrder = document.querySelectorAll('.aspect-video').length;
        
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
      }
      
      async function deleteImage(id) {
        if (!confirm('確定要刪除此圖片嗎？')) return;
        const res = await fetch('/api/images/' + id, { method: 'DELETE' });
        if (res.ok) document.getElementById('img-' + id).remove();
        else alert('刪除失敗');
      }
`;

const oldScriptHtml = `      function previewImage() {
        const url = document.getElementById('new-image-url').value;
        if (!url) return;
        document.getElementById('preview-img').src = url;
        document.getElementById('preview-area').classList.remove('hidden');
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
      }

      async function deleteImage(id) {
        if (!confirm('確定要刪除此圖片嗎？')) return;
        const res = await fetch('/api/images/' + id, { method: 'DELETE' });
        if (res.ok) document.getElementById('img-' + id).remove();
        else alert('刪除失敗');
      }`;

code = code.replace(oldScriptHtml, newScript);
code = code.replace("onclick=\"switchTab('upload')\"", "onclick=\"switchImageTab('upload')\"");
code = code.replace("onclick=\"switchTab('url')\"", "onclick=\"switchImageTab('url')\"");

fs.writeFileSync(file, code);

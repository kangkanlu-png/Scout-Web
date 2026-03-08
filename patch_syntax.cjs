const fs = require('fs');
let code = fs.readFileSync('src/routes/admin.tsx', 'utf-8');

const badBlock = `            if (uploadData.success && uploadData.file_url) {
            } else {
              console.error("Upload failed:", uploadData);
              alert('上傳失敗: ' + (uploadData.error || '未知錯誤'));
              failCount++;
            }
              const saveRes = await fetch('/api/admin/activities/' + activityId + '/images', {
                method: 'POST',
                headers: {'Content-Type':'application/json'},
                body: JSON.stringify({ image_url: uploadData.file_url, caption: caption || null, display_order: startOrder++ })
              });
              if (saveRes.ok) successCount++;
              else failCount++;
            } else {
              failCount++;
            }`;

const goodBlock = `            if (uploadData.success && uploadData.file_url) {
              const saveRes = await fetch('/api/admin/activities/' + activityId + '/images', {
                method: 'POST',
                headers: {'Content-Type':'application/json'},
                body: JSON.stringify({ image_url: uploadData.file_url, caption: caption || null, display_order: startOrder++ })
              });
              if (saveRes.ok) {
                successCount++;
              } else {
                const saveError = await saveRes.json().catch(()=>({}));
                console.error("Save to DB failed:", saveError);
                alert('圖片資料庫儲存失敗');
                failCount++;
              }
            } else {
              console.error("Upload failed:", uploadData);
              alert('上傳失敗: ' + (uploadData.error || '未知錯誤'));
              failCount++;
            }`;

code = code.replace(badBlock, goodBlock);

const badBlock2 = `            if (uploadData.success && uploadData.file_url) {
            } else {
              console.error("Upload failed:", uploadData);
              alert('上傳失敗: ' + (uploadData.error || '未知錯誤'));
              failCount++;
            }
              const saveRes = await fetch('/api/semesters/' + semId + '/images', {
                method: 'POST',
                headers: {'Content-Type':'application/json'},
                body: JSON.stringify({ image_url: uploadData.file_url, caption: caption || null, display_order: startOrder++ })
              });
              if (saveRes.ok) successCount++;
              else failCount++;
            } else {
              failCount++;
            }`;

const goodBlock2 = `            if (uploadData.success && uploadData.file_url) {
              const saveRes = await fetch('/api/semesters/' + semId + '/images', {
                method: 'POST',
                headers: {'Content-Type':'application/json'},
                body: JSON.stringify({ image_url: uploadData.file_url, caption: caption || null, display_order: startOrder++ })
              });
              if (saveRes.ok) {
                successCount++;
              } else {
                const saveError = await saveRes.json().catch(()=>({}));
                console.error("Save to DB failed:", saveError);
                alert('圖片資料庫儲存失敗');
                failCount++;
              }
            } else {
              console.error("Upload failed:", uploadData);
              alert('上傳失敗: ' + (uploadData.error || '未知錯誤'));
              failCount++;
            }`;

code = code.replace(badBlock2, goodBlock2);

fs.writeFileSync('src/routes/admin.tsx', code);
console.log('Fixed syntax and error handling');

const fs = require('fs');
let code = fs.readFileSync('src/routes/admin.tsx', 'utf-8');

// Replace the alert message to show the actual error message
code = code.replace(`
            if (uploadData.success && uploadData.file_url) {`, `
            if (uploadData.success && uploadData.file_url) {
            } else {
              console.error("Upload failed:", uploadData);
              alert('上傳失敗: ' + (uploadData.error || '未知錯誤'));
              failCount++;
            }`);

// Clean up duplicate else from simple replace
code = code.replace(`
            } else {
              console.error("Upload failed:", uploadData);
              alert('上傳失敗: ' + (uploadData.error || '未知錯誤'));
              failCount++;
            } else {
              failCount++;
            }`, `
            } else {
              console.error("Upload failed:", uploadData);
              alert('上傳失敗: ' + (uploadData.error || '未知錯誤'));
              failCount++;
            }`);

fs.writeFileSync('src/routes/admin.tsx', code);
console.log('Error alert patched');

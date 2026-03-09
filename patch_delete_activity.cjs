const fs = require('fs');
let code = fs.readFileSync('src/routes/admin.tsx', 'utf-8');

const closeFunction = `      async function closeAndHighlight(id) {
        if (!confirm('確定要結案此活動並將其移至「精彩活動」展示嗎？\\n(系統將自動關閉報名功能並設定為精彩活動)')) return;
        try {
          const res = await fetch('/api/admin/activities/' + id + '/close-and-highlight', { method: 'POST' });
          if (res.ok) {
            alert('已成功結案並移至精彩活動！');
            location.reload();
          } else {
            alert('操作失敗');
          }
        } catch (e) {
          alert('連線錯誤');
        }
      }`;

const deleteFunction = `      async function closeAndHighlight(id) {
        if (!confirm('確定要結案此活動並將其移至「精彩活動」展示嗎？\\n(系統將自動關閉報名功能並設定為精彩活動)')) return;
        try {
          const res = await fetch('/api/admin/activities/' + id + '/close-and-highlight', { method: 'POST' });
          if (res.ok) {
            alert('已成功結案並移至精彩活動！');
            location.reload();
          } else {
            alert('操作失敗');
          }
        } catch (e) {
          alert('連線錯誤');
        }
      }

      async function deleteActivity(id) {
        if (!confirm('確定要刪除此活動嗎？（包含所有報名與圖片資料將一併刪除）')) return;
        try {
          const res = await fetch('/api/activities/' + id, { method: 'DELETE' });
          if (res.ok) {
            alert('活動已刪除');
            location.reload();
          } else {
            alert('刪除失敗');
          }
        } catch (e) {
          alert('連線錯誤');
        }
      }`;

code = code.replace(closeFunction, deleteFunction);

fs.writeFileSync('src/routes/admin.tsx', code);
console.log('Added missing deleteActivity function');

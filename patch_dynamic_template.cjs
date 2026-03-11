const fs = require('fs');

let code = fs.readFileSync('src/routes/admin.tsx', 'utf-8');

// Replace the download link
const oldLink = `<a href="/static/accounts_import_template.xlsx" download="帳號匯入範例.xlsx" class="text-xs text-blue-600 hover:underline font-medium">📥 下載 Excel 範例檔</a>`;
const newLink = `<button onclick="downloadDynamicTemplate()" class="text-xs text-blue-600 hover:underline font-medium flex items-center gap-1"><i class="fas fa-download"></i>📥 下載 Excel 範本（包含所有未開通帳號成員）</button>`;
code = code.replace(oldLink, newLink);

// Add the downloadDynamicTemplate function
const targetStr = `async function submitCSVImport() {`;
const newScript = `
    async function downloadDynamicTemplate() {
      const loaded = await loadXLSX();
      if (!loaded) {
        alert('無法載入 Excel 處理套件，請檢查網路連線。');
        return;
      }
      
      const members = \${JSON.stringify(noAccount.results)};
      
      const wsData = [
        ['member_id', '姓名 (僅供參考)', 'username', 'password']
      ];
      
      members.forEach(m => {
        wsData.push([m.id, m.chinese_name, '', '']);
      });
      
      if (members.length === 0) {
        alert('目前所有有效成員都已開通帳號。將下載空白範本。');
        wsData.push(['(填寫ID)', '(填寫姓名)', '', '']);
      }
      
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      ws['!cols'] = [{ wch: 12 }, { wch: 18 }, { wch: 20 }, { wch: 15 }];
      
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Accounts");
      XLSX.writeFile(wb, "未開通會員帳號清單_匯入範本.xlsx");
    }

    async function submitCSVImport() {`;

code = code.replace(targetStr, newScript);

fs.writeFileSync('src/routes/admin.tsx', code);
console.log('Patched dynamic excel template successfully');

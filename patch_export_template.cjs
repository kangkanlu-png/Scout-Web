const fs = require('fs');

let content = fs.readFileSync('src/routes/admin.tsx', 'utf8');

const oldScript = `    let csvDataToImport = [];

    // Load XLSX library dynamically if not present`;

const newScript = `    let csvDataToImport = [];

    async function exportBatchTemplate() {
      const loaded = await loadXLSX();
      if (!loaded) {
        alert('無法載入 Excel 處理套件，請檢查網路連線。');
        return;
      }
      
      const members = \${JSON.stringify(noAccount.results)};
      
      const wsData = [
        ['member_id', '學員姓名', 'username', 'password']
      ];
      
      members.forEach(m => {
        wsData.push([m.id, m.chinese_name, '', '']);
      });
      
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "批次登錄表");
      XLSX.writeFile(wb, "批次帳號密碼登錄表.xlsx");
    }

    // Load XLSX library dynamically if not present`;

if (content.includes(oldScript)) {
  content = content.replace(oldScript, newScript);
  fs.writeFileSync('src/routes/admin.tsx', content);
  console.log('Script injected successfully.');
} else {
  console.log('Could not find target to replace.');
}

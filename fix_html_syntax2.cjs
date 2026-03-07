const fs = require('fs');
const file = 'src/routes/admin.tsx';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(
  "status.textContent = `正在上傳 ${i + 1} / ${selectedFiles.length} ...`;",
  "status.textContent = '正在上傳 ' + (i + 1) + ' / ' + selectedFiles.length + ' ...';"
);

code = code.replace(
  "status.textContent = `上傳完成！成功：${success} 張`;",
  "status.textContent = '上傳完成！成功：' + success + ' 張';"
);

code = code.replace(
  "alert(`成功匯入 ${success} 張圖片！`);",
  "alert('成功匯入 ' + success + ' 張圖片！');"
);

fs.writeFileSync(file, code);

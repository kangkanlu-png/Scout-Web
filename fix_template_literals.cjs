const fs = require('fs');
let code = fs.readFileSync('src/routes/admin.tsx', 'utf-8');

code = code.replace(/status\.textContent = \`正在上傳第 \$\{i\+1\} \/ \$\{files\.length\} 張\.\.\.\`;/g, 
  "status.textContent = '正在上傳第 ' + (i+1) + ' / ' + files.length + ' 張...';");

code = code.replace(/alert\(\`上傳完成！成功：\$\{successCount\} 張，失敗：\$\{failCount\} 張\`\);/g,
  "alert('上傳完成！成功：' + successCount + ' 張，失敗：' + failCount + ' 張');");

fs.writeFileSync('src/routes/admin.tsx', code);

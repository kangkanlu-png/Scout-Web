const fs = require('fs');
let code = fs.readFileSync('src/routes/admin.tsx', 'utf8');

// I need to escape template literals properly for the JS inside a TSX literal block.
// Wait, the block is already generated in the code correctly but vite build fails because in TSX, \${record.member_id} string inside \`...\` will be parsed by TypeScript or the JSX compiler. 
// Let's replace the JS literal to use string concatenation to avoid syntax errors.

code = code.replace("previewHtml += `<tr><td>${record.member_id}</td><td>${record.username}</td><td>***</td></tr>`;", 
"previewHtml += '<tr><td>' + record.member_id + '</td><td>' + record.username + '</td><td>***</td></tr>';");

code = code.replace("previewHtml += `<tr><td colspan=\"3\" class=\"text-gray-400\">...共 ${csvDataToImport.length} 筆資料</td></tr>`;",
"previewHtml += '<tr><td colspan=\"3\" class=\"text-gray-400\">...共 ' + csvDataToImport.length + ' 筆資料</td></tr>';");

code = code.replace("let txt = `成功匯入 ${result.successCount} 筆帳號。`;",
"let txt = '成功匯入 ' + result.successCount + ' 筆帳號。';");

code = code.replace("txt += `<br><span class=\"text-red-500\">有 ${result.errorCount} 筆失敗：<br>${result.errors.join('<br>')}</span>`;",
"txt += '<br><span class=\"text-red-500\">有 ' + result.errorCount + ' 筆失敗：<br>' + result.errors.join('<br>') + '</span>';");

fs.writeFileSync('src/routes/admin.tsx', code);

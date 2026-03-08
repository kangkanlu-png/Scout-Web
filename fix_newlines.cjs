const fs = require('fs');
let code = fs.readFileSync('src/routes/admin.tsx', 'utf-8');
code = code.replace(/確定要永久刪除「' \+ memberName \+ '」？\\n\\n此操作將刪除該成員所有資料，包含出席記錄與進程記錄，且不可復原！/g, "確定要永久刪除「' + memberName + '」？\\\\n\\\\n此操作將刪除該成員所有資料，包含出席記錄與進程記錄，且不可復原！");
fs.writeFileSync('src/routes/admin.tsx', code);

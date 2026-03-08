const fs = require('fs');
let code = fs.readFileSync('src/routes/admin.tsx', 'utf-8');
// Fix line 253
code = code.replace(/確定要結案此活動並將其移至「精彩活動」展示嗎？\\n/g, "確定要結案此活動並將其移至「精彩活動」展示嗎？\\\\n");
// What about line 11197?
code = code.replace(/text\.split\('\\n'\)/g, "text.split('\\\\n')");

fs.writeFileSync('src/routes/admin.tsx', code);

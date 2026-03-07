const fs = require('fs');
let code = fs.readFileSync('README.md', 'utf8');

code = code.replace("- [ ] 會員修改自己的密碼", "- [x] 會員修改自己的密碼");
code = code.replace("- [ ] 管理員批次建立會員帳號（CSV 匯入）", "- [x] 管理員批次建立會員帳號（CSV 匯入）");

fs.writeFileSync('README.md', code);

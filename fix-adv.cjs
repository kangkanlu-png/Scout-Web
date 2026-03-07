const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, 'src/routes/admin.tsx');
let content = fs.readFileSync(file, 'utf-8');

content = content.replace(/m\.status = 'active'/g, "m.membership_status = 'ACTIVE'");
fs.writeFileSync(file, content);

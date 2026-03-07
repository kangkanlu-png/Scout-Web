const fs = require('fs');
let file = fs.readFileSync('src/routes/admin.tsx', 'utf8');

file = file.replace(/\\`/g, "`");

fs.writeFileSync('src/routes/admin.tsx', file);

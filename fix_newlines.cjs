const fs = require('fs');
let code = fs.readFileSync('src/routes/admin.tsx', 'utf8');

// Fix startBatchUrl
code = code.replace(/const urls = text\.split\('\\n'\)\.map\(s => s\.trim\(\)\)\.filter\(s => s\);/g, "const urls = text.split('\\\\n').map(s => s.trim()).filter(s => s);");

// Fix CSV upload
code = code.replace(/const lines = text\.split\('\\n'\)\.map\(l => l\.trim\(\)\)\.filter\(l => l\);/g, "const lines = text.split('\\\\n').map(l => l.trim()).filter(l => l);");

fs.writeFileSync('src/routes/admin.tsx', code);
console.log('Fixed newlines!');

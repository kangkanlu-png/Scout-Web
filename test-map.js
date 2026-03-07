const fs = require('fs');
const content = fs.readFileSync('src/routes/frontend.tsx', 'utf8');
console.log(content.includes('8Wyfoby3'));

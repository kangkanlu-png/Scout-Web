const fs = require('fs');
let code = fs.readFileSync('src/routes/admin.tsx', 'utf8');

code = code.replace(
  /<span>\$\{year\} 學年度<\/span>/,
  `<span>第 \${parseInt(year) - 107} 屆 (\${year} 學年度)</span>`
);

fs.writeFileSync('src/routes/admin.tsx', code);
console.log('patched admin cohort');

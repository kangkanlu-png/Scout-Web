const fs = require('fs');
let code = fs.readFileSync('src/routes/admin.tsx', 'utf8');

code = code.replace(
  /\$\{\['pending','approved','schedule','settings'\]\.map\(\(t,i\) => \{/,
  `\${['pending','calendar','schedule','settings'].map((t,i) => {`
);

fs.writeFileSync('src/routes/admin.tsx', code);
console.log('patched tabs');

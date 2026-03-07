const fs = require('fs');
const file = 'src/routes/member.tsx';
let code = fs.readFileSync(file, 'utf8');

// I'll ensure that the isRegOpen check treats a.is_registration_open as truthy (1)
code = code.replace(
  'const isRegOpen = a.is_registration_open &&',
  'const isRegOpen = (a.is_registration_open === 1 || a.is_registration_open === true || a.is_registration_open === "1") &&'
);

fs.writeFileSync(file, code);
console.log('Fixed member activity isRegOpen boolean check');

const fs = require('fs');
let code = fs.readFileSync('src/routes/frontend.tsx', 'utf8');

code = code.replace(
  /\$\{pageFooter\(settings\)\}\`\)/g,
  "${pageFooter(settings)}\n</body></html>`)"
);

fs.writeFileSync('src/routes/frontend.tsx', code);
console.log('Fixed missing body/html closing tags');

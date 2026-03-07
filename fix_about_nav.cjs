const fs = require('fs');
let code = fs.readFileSync('src/routes/frontend.tsx', 'utf8');

code = code.replace(
  /return c\.html\(`\$\{pageHead\('認識童軍 - 林口康橋童軍團'\)\}\n  <div class="max-w-4xl/,
  `return c.html(\`\${pageHead('認識童軍 - 林口康橋童軍團')}
<body class="bg-gray-50 font-sans">
  \${navBar(settings)}
  <div class="max-w-4xl`
);

code = code.replace(
  /return c\.html\(`\$\{pageHead\('服務員介紹 - 林口康橋童軍團'\)\}\n  <div class="max-w-4xl/,
  `return c.html(\`\${pageHead('服務員介紹 - 林口康橋童軍團')}
<body class="bg-gray-50 font-sans">
  \${navBar(settings)}
  <div class="max-w-4xl`
);

fs.writeFileSync('src/routes/frontend.tsx', code);
console.log('Fixed about pages navigation');

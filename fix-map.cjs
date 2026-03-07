const fs = require('fs');
let code = fs.readFileSync('src/routes/frontend.tsx', 'utf8');

// 1. Update viewBox and image tag
code = code.replace(
  /<svg id="world-svg" viewBox="[^"]+" class="absolute inset-0 w-full h-full"\n\s*style="background:[^"]+">/g,
  `<svg id="world-svg" viewBox="0 0 1024 439" class="absolute inset-0 w-full h-full" style="background:#000">`
);
code = code.replace(
  /<image href="https:\/\/www.genspark.ai[^"]+" x="0" y="0" width="[^"]+" height="[^"]+" preserveAspectRatio="none" \/>/g,
  `<image href="/static/8Wyfoby3.jpg" x="0" y="0" width="1024" height="439" />`
);
code = code.replace(
  /<div class="relative" style="padding-bottom:52.5%;background:#000">/g,
  `<div class="relative" style="padding-bottom:42.87%;background:#000">`
);

fs.writeFileSync('src/routes/frontend.tsx', code);

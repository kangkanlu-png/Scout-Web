const fs = require('fs');
let code = fs.readFileSync('src/routes/admin.tsx', 'utf8');

if (!code.includes('import { generateRoverMapHtml')) {
  code = code.replace("import { Hono } from 'hono'", "import { Hono } from 'hono'\nimport { generateRoverMapHtml, mapScript, countryCoords, countryFlags, googleMapsQuery } from './map-data'");
  fs.writeFileSync('src/routes/admin.tsx', code);
}

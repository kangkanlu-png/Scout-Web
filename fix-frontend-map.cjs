const fs = require('fs');
let code = fs.readFileSync('src/routes/frontend.tsx', 'utf8');

if (!code.includes("import { generateRoverMapHtml")) {
  code = code.replace("import { Hono } from 'hono'", "import { Hono } from 'hono'\nimport { generateRoverMapHtml, mapScript } from './map-data'");
}

const mapStartStr = "// ── Google Simple Map SVG 世界分佈圖 ──────────────────────";
const mapEndStr = "<!-- ====== Tab: 羅浮群全球分佈 ====== -->";

const splitStart = code.indexOf(mapStartStr);
const splitEnd = code.indexOf(mapEndStr);

if (splitStart > -1 && splitEnd > -1) {
  // Remove the old coords and HTML building logic for the map
  const before = code.substring(0, splitStart);
  const after = code.substring(splitEnd);
  
  code = before + `
  const roverMapHtml = generateRoverMapHtml(roverCountries, roverCountryMap, sectionColors)
  
  ` + after;
}

// Now replace the injected HTML
const htmlStartStr = `<!-- SVG 世界地圖 -->`;
const htmlEndStr = `</div>\` : \``;
const htmlSplitStart = code.indexOf(htmlStartStr);
const htmlSplitEnd = code.indexOf(htmlEndStr);

if (htmlSplitStart > -1 && htmlSplitEnd > -1) {
  // Replace the old SVG logic with \${roverMapHtml}
  // Wait, in frontend.tsx, the tab structure is:
  // <!-- ====== Tab: 羅浮群全球分佈 ====== -->
  // <div id="pane-rover" class="tab-pane hidden">
  // ...
  // \${roverCountries.length > 0 ? \` ... SVG Map ... \` : \`...\`}
  
  // It's easier to just use a regex for the pane content.
}

fs.writeFileSync('src/routes/frontend.tsx', code);

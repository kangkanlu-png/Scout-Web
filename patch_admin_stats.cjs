const fs = require('fs');

let adminCode = fs.readFileSync('src/routes/admin.tsx', 'utf8');
let frontendStats = fs.readFileSync('frontend_stats.txt', 'utf8');

let logic = frontendStats.split('return c.html')[0].replace(/frontendRoutes\.get\('\/stats', async \(c\) => \{/, '');

let htmlParts = frontendStats.split('return c.html')[1];
// Extract everything between <div class="max-w-5xl mx-auto px-4 py-8"> or something similar
// Wait, we want to strip the hero banner and navBar, and just keep the content tabs.
// Let's find where the tabs start.

let contentHtml = htmlParts.substring(htmlParts.indexOf('<div class="max-w-6xl mx-auto'));

// We remove the trailing pageFooter
contentHtml = contentHtml.split('${pageFooter(settings)}')[0];
// And remove trailing backticks and parenthesis
contentHtml = contentHtml.replace(/`\)$/, '').trim();

let adminStatsNew = `adminRoutes.get('/stats', authMiddleware, async (c) => {${logic}  return c.html(adminLayout('統計報表', \`\n<div class="mb-6"><h1 class="text-2xl font-bold text-gray-800">統計報表</h1></div>\n\${contentHtml}\n  \`))\n})`

adminCode = adminCode.replace(/adminRoutes\.get\('\/stats', authMiddleware, async \(c\) => \{[\s\S]*?return c\.html\(adminLayout\('統計報表', `[\s\S]*?`\)\)\n\}\)/, adminStatsNew);

fs.writeFileSync('src/routes/admin.tsx', adminCode);
console.log('patched admin stats');

const fs = require('fs');
let code = fs.readFileSync('src/routes/admin.tsx', 'utf-8');

const regex = /adminRoutes\.get\('\/activities\/:id\/images', authMiddleware, async \(c\) => \{[\s\S]*?<\/script>\n  \`\)\)\n\}\)/;

const match = code.match(regex);
if (match) {
  console.log("Found activities/:id/images block!");
} else {
  console.log("Not found!");
}

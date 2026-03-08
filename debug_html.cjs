const fs = require('fs');
const { execSync } = require('child_process');

execSync('curl -s -b "admin_session=authenticated" http://127.0.0.1:3000/admin/members > output.html');
const html = fs.readFileSync('output.html', 'utf8');

const scriptRegex = /<script>([\s\S]*?)<\/script>/g;
let match;
let i = 0;
while ((match = scriptRegex.exec(html)) !== null) {
  i++;
  const scriptContent = match[1];
  try {
    // We try to parse it with Function constructor to catch syntax errors
    new Function(scriptContent);
    console.log(`Script ${i} is OK.`);
  } catch(err) {
    console.error(`Script ${i} SYNTAX ERROR:`, err.message);
    const lines = scriptContent.split('\n');
    lines.forEach((l, idx) => console.log(`${idx+1}: ${l}`));
  }
}

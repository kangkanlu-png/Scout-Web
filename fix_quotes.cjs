const fs = require('fs');
let code = fs.readFileSync('src/routes/admin.tsx', 'utf8');

code = code.replace(
  /'<button onclick="deleteCalEvent\(\\' ' \+ e\.id \+ ' \\'\)"/,
  `'<button onclick="deleteCalEvent(\\'' + e.id + '\\')" `
);

// Better to use generic string replace:
// Wait, in my previous `fix_newlines.cjs`, I saw similar issues!
// The current code has: '\\'' 
// Wait, if it has `\\'`, it outputs `\'`. But the error said `deleteCalEvent('' + e.id + '')`. So it actually had `\''` which evaluates to `''`.

code = code.replace(
  /'<button onclick="deleteCalEvent\(\\'' \+ e\.id \+ '\\'\)"/g,
  `'<button onclick="deleteCalEvent(\\\\'' + e.id + '\\\\')" `
);

fs.writeFileSync('src/routes/admin.tsx', code);

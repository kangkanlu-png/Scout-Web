const fs = require('fs');
const file = 'src/routes/api.tsx';
let code = fs.readFileSync(file, 'utf8');

// 1. Registrations API
code = code.replace(
  "const { status, admin_notes } = body",
  "const { status, admin_notes, send_email } = body"
);

code = code.replace(
  "// Send Email Notification\n  try {",
  "// Send Email Notification\n  if (send_email) {\n    try {"
);

// We need to be careful with replaces to match properly. 
// It's better to use regexes or more specific replaces.

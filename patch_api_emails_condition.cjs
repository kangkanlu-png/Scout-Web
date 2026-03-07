const fs = require('fs');
const file = 'src/routes/api.tsx';
let code = fs.readFileSync(file, 'utf8');

// Update destructuring
code = code.replace(
  "const { status, admin_notes } = body",
  "const { status, admin_notes, send_email } = body"
);
// Make sure second one is updated too if it's identical
code = code.replace(
  "const { status, admin_notes } = body",
  "const { status, admin_notes, send_email } = body"
);

code = code.replace(
  "const { status, approved_by } = body",
  "const { status, approved_by, send_email } = body"
);

code = code.replace(
  "const { status, admin_note } = body",
  "const { status, admin_note, send_email } = body"
);

// We also need to update the `/admin/leaves/:id` if it was added, but the email is in `/leaves/:id`. Wait, I'll check if admin uses `/admin/leaves/:id`.
// Let's modify all 4 try blocks:

const regex = /\/\/ Send Email Notification\s+try\s+\{([\s\S]*?)\}\s+catch\s+\(e\)\s+\{\s+console\.error\('Email failed:', e\)\s+\}/g;

code = code.replace(regex, (match, inner) => {
  return `// Send Email Notification
  if (send_email) {
    try {${inner}} catch (e) {
      console.error('Email failed:', e)
    }
  }`;
});

fs.writeFileSync(file, code);
console.log("Patched API endpoints to check for send_email");

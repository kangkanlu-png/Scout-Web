const fs = require('fs')
let code = fs.readFileSync('src/routes/api.tsx', 'utf8')
code = code.replace(
  'const { status, admin_note } = body',
  'const { status, admin_note, send_email } = body'
)
fs.writeFileSync('src/routes/api.tsx', code)

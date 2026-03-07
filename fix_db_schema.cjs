const fs = require('fs')

let code = fs.readFileSync('package.json', 'utf8')
code = code.replace(
  /"db:migrate:local": "wrangler d1 migrations apply webapp-production --local",/,
  `"db:migrate:local": "wrangler d1 migrations apply webapp-production --local",
    "db:migrate:alter": "wrangler d1 execute webapp-production --local --command=\\"ALTER TABLE coach_member_status ADD COLUMN section_assigned TEXT; ALTER TABLE coach_member_status ADD COLUMN specialties TEXT; ALTER TABLE coach_member_status ADD COLUMN year_label TEXT;\\"",`
)
fs.writeFileSync('package.json', code)
console.log('package.json patched')

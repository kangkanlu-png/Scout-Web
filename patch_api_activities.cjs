const fs = require('fs');
const file = 'src/routes/api.tsx';
let code = fs.readFileSync(file, 'utf8');

// POST /activities
code = code.replace(
  'is_registration_open, activity_end_date\n  } = body',
  'is_registration_open, activity_end_date, activity_status\n  } = body'
);

code = code.replace(
  'location, cost, content, registration_start, registration_end, max_participants, is_registration_open, activity_end_date\n    )',
  'location, cost, content, registration_start, registration_end, max_participants, is_registration_open, activity_end_date, activity_status\n    )'
);

code = code.replace(
  'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
  'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
);

code = code.replace(
  'max_participants || null, is_registration_open ? 1 : 0, activity_end_date || null\n  ).run()',
  "max_participants || null, is_registration_open ? 1 : 0, activity_end_date || null, activity_status || 'active'\n  ).run()"
);

// PUT /activities/:id
code = code.replace(
  'is_registration_open, activity_end_date\n  } = body',
  'is_registration_open, activity_end_date, activity_status\n  } = body'
);

code = code.replace(
  'max_participants = ?, is_registration_open = ?, activity_end_date = ?,\n      updated_at = CURRENT_TIMESTAMP',
  'max_participants = ?, is_registration_open = ?, activity_end_date = ?, activity_status = ?,\n      updated_at = CURRENT_TIMESTAMP'
);

code = code.replace(
  'max_participants || null, is_registration_open ? 1 : 0, activity_end_date || null,\n    id\n  ).run()',
  "max_participants || null, is_registration_open ? 1 : 0, activity_end_date || null, activity_status || 'active',\n    id\n  ).run()"
);

fs.writeFileSync(file, code);
console.log('Patched api.tsx');

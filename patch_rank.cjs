const fs = require('fs');
let code = fs.readFileSync('src/routes/admin.tsx', 'utf8');

code = code.replace(
  /\(SELECT award_name FROM progress_records WHERE member_id = m\.id AND record_type = 'rank' ORDER BY awarded_at DESC LIMIT 1\) as current_rank/,
  `m.rank_level as current_rank` // Fallback, let's just use rank_level as current_rank alias
);

fs.writeFileSync('src/routes/admin.tsx', code);
console.log('patched rank query');

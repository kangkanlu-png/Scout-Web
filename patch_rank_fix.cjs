const fs = require('fs');
const file = 'src/routes/admin.tsx';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(
  'm.rank_level as current_rank',
  `(SELECT pr.award_name FROM progress_records pr WHERE pr.member_id = m.id AND pr.record_type = 'rank' ORDER BY pr.awarded_at DESC LIMIT 1) as current_rank`
);

fs.writeFileSync(file, code);

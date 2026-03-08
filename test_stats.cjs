const { execSync } = require('child_process');

// Here is the query used in /stats
const queries = [
  `SELECT section, COUNT(*) as count FROM members WHERE UPPER(membership_status) = 'ACTIVE' GROUP BY section`,
  `SELECT year_label, section, COUNT(DISTINCT member_id) as count FROM member_enrollments WHERE is_active = 1 GROUP BY year_label, section ORDER BY year_label ASC, section`,
  `SELECT year_label, COUNT(DISTINCT member_id) as count FROM member_enrollments WHERE is_active = 1 GROUP BY year_label ORDER BY year_label ASC`,
  `SELECT pr.year_label, m.section, pr.award_name, COUNT(*) as count FROM progress_records pr JOIN members m ON m.id = pr.member_id WHERE pr.record_type = 'rank' AND pr.year_label IS NOT NULL GROUP BY pr.year_label, m.section, pr.award_name ORDER BY pr.year_label ASC, m.section, count DESC`,
  `SELECT current_stage, COUNT(*) as count FROM coach_member_status GROUP BY current_stage`,
  `SELECT chinese_name, country, university FROM members WHERE UPPER(membership_status) = 'ACTIVE' AND section = '羅浮童軍' ORDER BY country, chinese_name`
];

for (const q of queries) {
  try {
    console.log("Query:", q);
    const result = execSync(`npx wrangler d1 execute scout-management-production --remote --command="${q}"`, { encoding: 'utf8' });
    console.log("Success");
  } catch (err) {
    console.log("Error:", err.message);
  }
}

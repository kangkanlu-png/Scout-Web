const fs = require('fs');
const file = 'src/routes/member.tsx';
let code = fs.readFileSync(file, 'utf8');

// Modify the query to only show their own approved leaves
const oldQuery = `  const approvedLeaves = await db.prepare(\`
    SELECT ola.leave_date, ola.timeslots, m.chinese_name, m.section
    FROM official_leave_applications ola
    JOIN members m ON m.id = ola.member_id
    WHERE ola.status='approved' AND ola.leave_date>=? AND ola.leave_date<=?
    ORDER BY ola.leave_date
  \`).bind(wStart, wEnd).all()`;

const newQuery = `  const approvedLeaves = await db.prepare(\`
    SELECT ola.leave_date, ola.timeslots, m.chinese_name, m.section
    FROM official_leave_applications ola
    JOIN members m ON m.id = ola.member_id
    WHERE ola.status='approved' AND ola.leave_date>=? AND ola.leave_date<=? AND ola.member_id=?
    ORDER BY ola.leave_date
  \`).bind(wStart, wEnd, memberId).all()`;

code = code.replace(oldQuery, newQuery);

fs.writeFileSync(file, code);
console.log('patched member leave query');

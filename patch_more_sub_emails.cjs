const fs = require('fs');
const file = 'src/routes/api.tsx';
let code = fs.readFileSync(file, 'utf8');

const offLeaveSubOld = `  }).bind(id, member_id, leave_date, JSON.stringify(timeslots), reason || null,
    is_conflict_checked ? 1 : 0, is_teacher_informed ? 1 : 0).run()

  return c.json({ success: true, id })`;

const offLeaveSubNew = `  }).bind(id, member_id, leave_date, JSON.stringify(timeslots), reason || null,
    is_conflict_checked ? 1 : 0, is_teacher_informed ? 1 : 0).run()

  try {
    const mem = await db.prepare(\`SELECT email, chinese_name FROM members WHERE id = ?\`).bind(member_id).first() as any
    if (mem && mem.email) {
      await sendEmail(c.env, mem.email, \`【公假通知】已收到 \${leave_date} 公假申請\`, 
        \`親愛的 \${mem.chinese_name} 您好：<br><br>我們已經收到您於 \${leave_date} 的公假申請，目前狀態為：<b>待審核</b>。<br>後續審核完成將會再以 Email 通知您。\`)
    }
  } catch (e) { console.error(e) }

  return c.json({ success: true, id })`;

code = code.replace(offLeaveSubOld, offLeaveSubNew);

const advSubOld = `  }).bind(id, memberId, member.section, rank_from, rank_to, apply_date || new Date().toISOString().slice(0,10), evidence_file || null).run()

  return c.json({ success: true, id })`;

const advSubNew = `  }).bind(id, memberId, member.section, rank_from, rank_to, apply_date || new Date().toISOString().slice(0,10), evidence_file || null).run()

  try {
    const mem = await db.prepare(\`SELECT email, chinese_name FROM members WHERE id = ?\`).bind(memberId).first() as any
    if (mem && mem.email) {
      await sendEmail(c.env, mem.email, \`【晉級通知】已收到「\${rank_to}」晉升申請\`, 
        \`親愛的 \${mem.chinese_name} 您好：<br><br>我們已經收到您晉升「\${rank_to}」的申請，目前狀態為：<b>待審核</b>。<br>教練團將盡快進行審核，結果將會再以 Email 通知您。\`)
    }
  } catch (e) { console.error(e) }

  return c.json({ success: true, id })`;

code = code.replace(advSubOld, advSubNew);

fs.writeFileSync(file, code);
console.log("Patched more submissions!");

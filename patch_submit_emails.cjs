const fs = require('fs');
const file = 'src/routes/api.tsx';
let code = fs.readFileSync(file, 'utf8');

const regSubOld = `  }).bind(activityId, memberId, user_notes || null, registration_data ? JSON.stringify(registration_data) : null).run()
  
  return c.json({ success: true })`;

const regSubNew = `  }).bind(activityId, memberId, user_notes || null, registration_data ? JSON.stringify(registration_data) : null).run()
  
  try {
    const mem = await db.prepare(\`SELECT email, chinese_name FROM members WHERE id = ?\`).bind(memberId).first() as any
    if (mem && mem.email) {
      await sendEmail(c.env, mem.email, \`【活動報名通知】已收到「\${activity.title}」報名\`, 
        \`親愛的 \${mem.chinese_name} 您好：<br><br>我們已經收到您報名活動「\${activity.title}」的申請，目前狀態為：<b>待審核</b>。<br>後續審核完成將會再以 Email 通知您，感謝您的參與！\`)
    }
  } catch (e) { console.error(e) }

  return c.json({ success: true })`;

code = code.replace(regSubOld, regSubNew);

const leaveSubOld = `  }).bind(id, memberId, session_id || null, leave_type || 'personal', reason || null, date).run()

  return c.json({ success: true })`;

const leaveSubNew = `  }).bind(id, memberId, session_id || null, leave_type || 'personal', reason || null, date).run()

  try {
    const mem = await db.prepare(\`SELECT email, chinese_name FROM members WHERE id = ?\`).bind(memberId).first() as any
    if (mem && mem.email) {
      await sendEmail(c.env, mem.email, \`【請假通知】已收到 \${date} 請假申請\`, 
        \`親愛的 \${mem.chinese_name} 您好：<br><br>我們已經收到您於 \${date} 的請假申請，目前狀態為：<b>待審核</b>。<br>後續審核完成將會再以 Email 通知您。\`)
    }
  } catch (e) { console.error(e) }

  return c.json({ success: true })`;

code = code.replace(leaveSubOld, leaveSubNew);

fs.writeFileSync(file, code);
console.log("Patched submissions!");

const fs = require('fs');
const file = 'src/routes/api.tsx';
let code = fs.readFileSync(file, 'utf8');

const offLeaveOld = `  \`).bind(status, admin_note || null, id).run()\n  return c.json({ success: true })`;

const offLeaveNew = `  \`).bind(status, admin_note || null, id).run()

  // Send Email Notification
  try {
    const info = await db.prepare(\`
      SELECT m.email, m.chinese_name, ola.leave_date 
      FROM official_leave_applications ola 
      JOIN members m ON ola.member_id = m.id 
      WHERE ola.id = ?
    \`).bind(id).first() as any
    if (info && info.email) {
      await sendEmail(c.env, info.email, \`【公假通知】\${info.leave_date} 公假審核結果\`, 
        \`親愛的 \${info.chinese_name} 您好：<br><br>您申請的 \${info.leave_date} 公假，審核結果為：<b>\${translateStatus(status)}</b>。<br><br>\${admin_note ? \`備註：\${admin_note}<br><br>\` : ''}請登入系統查看詳情。\`)
    }
  } catch (e) {
    console.error('Email failed:', e)
  }

  return c.json({ success: true })`;

code = code.replace(offLeaveOld, offLeaveNew);
fs.writeFileSync(file, code);
console.log("Patched!");

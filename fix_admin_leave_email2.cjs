const fs = require('fs');
const file = 'src/routes/api.tsx';
let code = fs.readFileSync(file, 'utf8');

const regexOld = `  }).bind(status, admin_note || null, status, 'admin', id).run()
  return c.json({ success: true })`;

const regexNew = `  }).bind(status, admin_note || null, status, 'admin', id).run()

  // Send Email Notification
  if (send_email) {
    try {
      const info = await db.prepare(\`
        SELECT m.email, m.chinese_name, lr.date 
        FROM leave_requests lr 
        JOIN members m ON lr.member_id = m.id 
        WHERE lr.id = ?
      \`).bind(id).first() as any
      if (info && info.email) {
        await sendEmail(c.env, info.email, \`【請假通知】\${info.date} 請假審核結果\`, 
          \`親愛的 \${info.chinese_name} 您好：<br><br>您於 \${info.date} 的請假申請，審核結果為：<b>\${translateStatus(status)}</b>。<br><br>\${admin_note ? \`備註：\${admin_note}<br><br>\` : ''}請隨時登入系統查看詳情。\`)
      }
    } catch (e) {
      console.error('Email failed:', e)
    }
  }

  return c.json({ success: true })`;

if (code.includes(regexOld)) {
  code = code.replace(regexOld, regexNew);
  console.log("Fixed /admin/leaves/:id");
} else {
  console.log("Could not find /admin/leaves/:id block");
}

fs.writeFileSync(file, code);

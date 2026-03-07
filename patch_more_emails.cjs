const fs = require('fs');
const file = 'src/routes/api.tsx';
let code = fs.readFileSync(file, 'utf8');

// Patch Official Leave
const offLeaveOld = `  await db.prepare(\`
    UPDATE official_leave_applications
    SET status = ?, admin_note = ?, reviewed_at = CURRENT_TIMESTAMP
    WHERE id = ?
  \`).bind(status, admin_note || null, id).run()

  return c.json({ success: true })`;

const offLeaveNew = `  await db.prepare(\`
    UPDATE official_leave_applications
    SET status = ?, admin_note = ?, reviewed_at = CURRENT_TIMESTAMP
    WHERE id = ?
  \`).bind(status, admin_note || null, id).run()

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

if (code.includes(offLeaveOld)) {
  code = code.replace(offLeaveOld, offLeaveNew);
  console.log("Patched Official Leave email");
} else {
  console.log("Could not find Official Leave old block");
}

// Patch Advancement
const advOld = `  // 如果核准，更新成員的 rank_level
  if (status === 'approved') {
    const app = await db.prepare(\`SELECT * FROM advancement_applications WHERE id = ?\`).bind(id).first() as any
    if (app) {
      await db.prepare(\`UPDATE members SET rank_level = ? WHERE id = ?\`).bind(app.rank_to, app.member_id).run()
    }
  }
  return c.json({ success: true })`;

const advNew = `  // 如果核准，更新成員的 rank_level
  if (status === 'approved') {
    const app = await db.prepare(\`SELECT * FROM advancement_applications WHERE id = ?\`).bind(id).first() as any
    if (app) {
      await db.prepare(\`UPDATE members SET rank_level = ? WHERE id = ?\`).bind(app.rank_to, app.member_id).run()
    }
  }
  
  // Send Email Notification
  try {
    const info = await db.prepare(\`
      SELECT m.email, m.chinese_name, aa.rank_to 
      FROM advancement_applications aa 
      JOIN members m ON aa.member_id = m.id 
      WHERE aa.id = ?
    \`).bind(id).first() as any
    if (info && info.email) {
      await sendEmail(c.env, info.email, \`【晉級通知】晉升審核結果更新\`, 
        \`親愛的 \${info.chinese_name} 您好：<br><br>您提交晉升「\${info.rank_to}」的申請，審核狀態已更新為：<b>\${translateStatus(status)}</b>。<br><br>\${admin_notes ? \`審核備註：\${admin_notes}<br><br>\` : ''}請登入系統查看詳情與最新榮譽狀態。\`)
    }
  } catch (e) {
    console.error('Email failed:', e)
  }

  return c.json({ success: true })`;

if (code.includes(advOld)) {
  code = code.replace(advOld, advNew);
  console.log("Patched Advancement email");
} else {
  console.log("Could not find Advancement old block");
}

fs.writeFileSync(file, code);

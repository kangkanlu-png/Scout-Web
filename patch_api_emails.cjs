const fs = require('fs');
const file = 'src/routes/api.tsx';
let code = fs.readFileSync(file, 'utf8');

// 1. Add import
if (!code.includes("import { sendEmail }")) {
  code = code.replace("import { Hono } from 'hono'", "import { Hono } from 'hono'\nimport { sendEmail } from '../utils/email'");
}

// Helper to translate status
const statusText = `
function translateStatus(s: string) {
  const map: Record<string, string> = {
    pending: '待審核',
    approved: '已核准',
    rejected: '已拒絕',
    cancelled: '已取消',
    waiting: '候補中',
    reviewing: '審核中'
  }
  return map[s] || s
}
`;

if (!code.includes("function translateStatus(")) {
  code = code.replace("export const apiRoutes = new Hono<{ Bindings: Bindings }>()", "export const apiRoutes = new Hono<{ Bindings: Bindings }>()\n" + statusText);
}

// 2. Patch Activity Registration update
const regOld = `  await db.prepare(\`
    UPDATE activity_registrations 
    SET status = ?, admin_notes = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  \`).bind(status, admin_notes || null, id).run()
  
  return c.json({ success: true })`;

const regNew = `  await db.prepare(\`
    UPDATE activity_registrations 
    SET status = ?, admin_notes = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  \`).bind(status, admin_notes || null, id).run()

  // Send Email Notification
  try {
    const info = await db.prepare(\`
      SELECT m.email, m.chinese_name, a.title 
      FROM activity_registrations ar 
      JOIN members m ON ar.member_id = m.id 
      JOIN activities a ON ar.activity_id = a.id 
      WHERE ar.id = ?
    \`).bind(id).first() as any
    if (info && info.email) {
      await sendEmail(c.env, info.email, \`【活動報名通知】\${info.title} 報名狀態更新\`, 
        \`親愛的 \${info.chinese_name} 您好：<br><br>您報名的活動「\${info.title}」狀態已更新為：<b>\${translateStatus(status)}</b>。<br><br>\${admin_notes ? \`備註說明：\${admin_notes}<br><br>\` : ''}感謝您的參與！\`)
    }
  } catch (e) {
    console.error('Email failed:', e)
  }

  return c.json({ success: true })`;

if (code.includes(regOld)) {
  code = code.replace(regOld, regNew);
  console.log("Patched Registration email");
}

// 3. Patch Leave Requests
const leaveOld = `  await db.prepare(\`UPDATE leave_requests SET status=?, approved_by=? WHERE id=?\`).bind(status, approved_by || null, id).run()
  return c.json({ success: true })`;

const leaveNew = `  await db.prepare(\`UPDATE leave_requests SET status=?, approved_by=? WHERE id=?\`).bind(status, approved_by || null, id).run()
  
  // Send Email Notification
  try {
    const info = await db.prepare(\`
      SELECT m.email, m.chinese_name, lr.date 
      FROM leave_requests lr 
      JOIN members m ON lr.member_id = m.id 
      WHERE lr.id = ?
    \`).bind(id).first() as any
    if (info && info.email) {
      await sendEmail(c.env, info.email, \`【請假通知】\${info.date} 請假審核結果\`, 
        \`親愛的 \${info.chinese_name} 您好：<br><br>您於 \${info.date} 的請假申請，審核結果為：<b>\${translateStatus(status)}</b>。<br><br>請隨時登入系統查看詳情。\`)
    }
  } catch (e) {
    console.error('Email failed:', e)
  }

  return c.json({ success: true })`;

if (code.includes(leaveOld)) {
  code = code.replace(leaveOld, leaveNew);
  console.log("Patched Leave Request email");
}

// 4. Patch Official Leave
const offLeaveOld = `  await db.prepare(\`
    UPDATE official_leave_applications
    SET status = ?, reject_reason = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  \`).bind(status, reject_reason || null, id).run()

  return c.json({ success: true })`;

const offLeaveNew = `  await db.prepare(\`
    UPDATE official_leave_applications
    SET status = ?, reject_reason = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  \`).bind(status, reject_reason || null, id).run()

  // Send Email Notification
  try {
    const info = await db.prepare(\`
      SELECT m.email, m.chinese_name, ola.leave_date 
      FROM official_leave_applications ola 
      JOIN members m ON ola.member_id = m.id 
      WHERE ola.id = ?
    \`).bind(id).first() as any
    if (info && info.email) {
      await sendEmail(c.env, info.email, \`【公假通知】\${info.leave_date} 公假申請結果\`, 
        \`親愛的 \${info.chinese_name} 您好：<br><br>您申請的 \${info.leave_date} 公假，審核結果為：<b>\${translateStatus(status)}</b>。<br><br>\${reject_reason ? \`駁回原因：\${reject_reason}<br><br>\` : ''}請隨時登入系統查看詳情。\`)
    }
  } catch (e) {
    console.error('Email failed:', e)
  }

  return c.json({ success: true })`;

if (code.includes(offLeaveOld)) {
  code = code.replace(offLeaveOld, offLeaveNew);
  console.log("Patched Official Leave email");
}

// 5. Patch Advancement
const advOld = `  await db.prepare(\`
    UPDATE advancement_applications SET
      status = ?, reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP, reject_reason = ?
    WHERE id = ?
  \`).bind(status, reviewed_by || 'admin', reject_reason || null, id).run()

  return c.json({ success: true })`;

const advNew = `  await db.prepare(\`
    UPDATE advancement_applications SET
      status = ?, reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP, reject_reason = ?
    WHERE id = ?
  \`).bind(status, reviewed_by || 'admin', reject_reason || null, id).run()

  // Send Email Notification
  try {
    const info = await db.prepare(\`
      SELECT m.email, m.chinese_name, aa.rank_to 
      FROM advancement_applications aa 
      JOIN members m ON aa.member_id = m.id 
      WHERE aa.id = ?
    \`).bind(id).first() as any
    if (info && info.email) {
      await sendEmail(c.env, info.email, \`【晉級通知】晉級申請審核結果\`, 
        \`親愛的 \${info.chinese_name} 您好：<br><br>您提交晉升「\${info.rank_to}」的申請，審核結果為：<b>\${translateStatus(status)}</b>。<br><br>\${reject_reason ? \`備註：\${reject_reason}<br><br>\` : ''}請登入系統查看詳情與最新榮譽狀態。\`)
    }
  } catch (e) {
    console.error('Email failed:', e)
  }

  return c.json({ success: true })`;

if (code.includes(advOld)) {
  code = code.replace(advOld, advNew);
  console.log("Patched Advancement email");
}

fs.writeFileSync(file, code);

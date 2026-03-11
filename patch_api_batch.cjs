const fs = require('fs');

let content = fs.readFileSync('src/routes/api.tsx', 'utf8');

const oldApi = `apiRoutes.post('/admin/member-accounts/batch', async (c) => {
  const db = c.env.DB
  const body = await c.req.json()
  const { accounts } = body // [{ member_id, username, password }]
  
  if (!accounts || !Array.isArray(accounts)) {
    return c.json({ success: false, error: '資料格式錯誤' }, 400)
  }

  let successCount = 0;
  let errorCount = 0;
  const errors = [];

  for (const acc of accounts) {
    if (!acc.member_id || !acc.username || !acc.password) {
      errorCount++;
      errors.push(\`\${acc.username || '未知'}: 缺少必填欄位\`);
      continue;
    }
    try {
      const hash = await sha256(acc.password);
      const id = \`acc-\${Date.now()}-\${Math.random().toString(36).substring(2,7)}\`;
      await db.prepare(\`
        INSERT INTO member_accounts (id, member_id, username, password_hash, is_active)
        VALUES (?, ?, ?, ?, 1)
      \`).bind(id, acc.member_id, acc.username.toLowerCase(), hash).run();
      successCount++;
    } catch (e: any) {
      errorCount++;
      errors.push(\`\${acc.username}: \${e.message}\`);
    }
  }

  return c.json({ success: true, successCount, errorCount, errors })
})`;

const newApi = `apiRoutes.post('/admin/member-accounts/batch', async (c) => {
  const db = c.env.DB
  const body = await c.req.json()
  const { accounts } = body // [{ member_id?, name?, username, password }]
  
  if (!accounts || !Array.isArray(accounts)) {
    return c.json({ success: false, error: '資料格式錯誤' }, 400)
  }

  let successCount = 0;
  let errorCount = 0;
  const errors = [];

  for (const acc of accounts) {
    if (!acc.username || !acc.password) {
      errorCount++;
      errors.push(\`\${acc.username || '未知'}: 缺少帳號或密碼\`);
      continue;
    }
    
    let memberId = acc.member_id;
    
    try {
      // If member_id is empty but we have a name, look up the member_id
      if (!memberId && acc.name) {
        const member = await db.prepare('SELECT id FROM members WHERE chinese_name = ?').bind(acc.name).first();
        if (member) {
          memberId = member.id;
        } else {
          errorCount++;
          errors.push(\`\${acc.username}: 找不到名為 "\${acc.name}" 的成員\`);
          continue;
        }
      }
      
      if (!memberId) {
        errorCount++;
        errors.push(\`\${acc.username}: 缺少 member_id 且未提供姓名\`);
        continue;
      }
      
      const hash = await sha256(acc.password);
      const id = \`acc-\${Date.now()}-\${Math.random().toString(36).substring(2,7)}\`;
      await db.prepare(\`
        INSERT INTO member_accounts (id, member_id, username, password_hash, is_active)
        VALUES (?, ?, ?, ?, 1)
      \`).bind(id, memberId, acc.username.toLowerCase(), hash).run();
      successCount++;
    } catch (e: any) {
      errorCount++;
      // Provide a friendlier message for duplicate users
      if (e.message && e.message.includes('UNIQUE constraint failed')) {
        errors.push(\`\${acc.username}: 帳號已存在\`);
      } else {
        errors.push(\`\${acc.username}: \${e.message}\`);
      }
    }
  }

  return c.json({ success: true, successCount, errorCount, errors })
})`;

if (content.includes(oldApi)) {
  content = content.replace(oldApi, newApi);
  fs.writeFileSync('src/routes/api.tsx', content);
  console.log('Successfully patched api batch endpoint.');
} else {
  console.log('Failed to patch api batch endpoint, string not found.');
}

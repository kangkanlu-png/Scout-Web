const fs = require('fs');
let code = fs.readFileSync('src/routes/api.tsx', 'utf8');

const batchApi = `apiRoutes.post('/admin/member-accounts/batch', async (c) => {
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
})

apiRoutes.post('/admin/member-accounts',`;

code = code.replace("apiRoutes.post('/admin/member-accounts',", batchApi);

fs.writeFileSync('src/routes/api.tsx', code);

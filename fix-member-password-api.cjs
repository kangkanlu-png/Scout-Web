const fs = require('fs');
let code = fs.readFileSync('src/routes/api.tsx', 'utf8');

const newApi = `// ===================== 會員修改密碼 =====================
apiRoutes.put('/member/password', async (c) => {
  const db = c.env.DB
  const memberId = await getMemberIdFromCookie(c)
  if (!memberId) return c.json({ success: false, error: '未登入' }, 401)

  try {
    const { old_password, new_password } = await c.req.json()
    if (!old_password || !new_password) return c.json({ success: false, error: '請提供舊密碼與新密碼' }, 400)
    if (new_password.length < 6) return c.json({ success: false, error: '新密碼長度至少需6位數' }, 400)

    const user = await db.prepare(\`SELECT id, password_hash FROM member_accounts WHERE member_id = ?\`).bind(memberId).first()
    if (!user) return c.json({ success: false, error: '找不到使用者帳號' }, 404)

    const oldHash = await sha256(old_password)
    if (oldHash !== user.password_hash) {
      return c.json({ success: false, error: '舊密碼錯誤' }, 403)
    }

    const newHash = await sha256(new_password)
    await db.prepare(\`UPDATE member_accounts SET password_hash = ? WHERE member_id = ?\`).bind(newHash, memberId).run()

    return c.json({ success: true, message: '密碼已成功修改' })
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500)
  }
})

apiRoutes.post('/member/leave'`;

code = code.replace("apiRoutes.post('/member/leave'", newApi);

// check if sha256 is defined in api.tsx
if (!code.includes('async function sha256')) {
    const sha256Func = `\nasync function sha256(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message)
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}\n`;
    code = code.replace("export const apiRoutes = new Hono<{ Bindings: Bindings }>()", "export const apiRoutes = new Hono<{ Bindings: Bindings }>()\n" + sha256Func);
}

fs.writeFileSync('src/routes/api.tsx', code);

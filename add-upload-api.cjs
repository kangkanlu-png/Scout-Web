const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, 'src/routes/api.tsx');
let content = fs.readFileSync(file, 'utf-8');

const uploadApiCode = `
// ===================== 檔案上傳 API =====================
apiRoutes.post('/upload', async (c) => {
  const body = await c.req.parseBody()
  const file = body['file'] as File

  if (!file || !(file instanceof File)) {
    return c.json({ success: false, error: '請選擇檔案' }, 400)
  }

  // 限制檔案大小 (10MB)
  if (file.size > 10 * 1024 * 1024) {
    return c.json({ success: false, error: '檔案大小不能超過 10MB' }, 400)
  }

  try {
    const r2 = c.env.R2
    if (!r2) {
      return c.json({ success: false, error: '尚未設定 R2 儲存空間' }, 500)
    }

    const timestamp = Date.now()
    const ext = file.name.split('.').pop() || 'tmp'
    const fileName = \`\${timestamp}-\${Math.random().toString(36).substring(2, 8)}.\${ext}\`
    
    // Store in R2
    const arrayBuffer = await file.arrayBuffer()
    await r2.put(fileName, arrayBuffer, {
      httpMetadata: { contentType: file.type }
    })

    // Return the file access URL
    return c.json({ 
      success: true, 
      file_url: \`/api/files/\${fileName}\`,
      file_name: file.name
    })
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500)
  }
})

// 讀取 R2 檔案
apiRoutes.get('/files/:key', async (c) => {
  const r2 = c.env.R2
  if (!r2) return c.text('R2 not configured', 500)
  
  const key = c.req.param('key')
  const object = await r2.get(key)
  
  if (!object) return c.notFound()
  
  const headers = new Headers()
  object.writeHttpMetadata(headers as any)
  headers.set('etag', object.httpEtag)
  
  return new Response(object.body, { headers })
})

export default apiRoutes
`;

content = content.replace(/export default apiRoutes/g, uploadApiCode);
fs.writeFileSync(file, content);
console.log('Added Upload API');

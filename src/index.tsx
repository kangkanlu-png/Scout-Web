import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serveStatic } from 'hono/cloudflare-workers'
import { apiRoutes } from './routes/api'
import { adminRoutes } from './routes/admin'
import { frontendRoutes } from './routes/frontend'
import { memberRoutes } from './routes/member'

type Bindings = {
  DB: D1Database
  R2: any
}

const app = new Hono<{ Bindings: Bindings }>()

// CORS
app.use('/api/*', cors())

// 靜態檔案
app.use('/static/*', serveStatic({ root: './' }))

// API 路由
app.route('/api', apiRoutes)

// 後台管理路由
app.route('/admin', adminRoutes)

// 會員入口路由
app.route('/member', memberRoutes)

// 前台路由
app.route('/', frontendRoutes)

export default app

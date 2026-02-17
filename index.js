const express = require('express')
const morgan = require('morgan')
const helmet = require('helmet')
const cors = require('cors')
const pkg = require('./package.json')
const router = require('./routes')
const db = require('./db')
const fs = require('fs')
const path = require('path')

const app = express()
app.use(helmet())
app.use(cors())
app.use(express.json())
app.use(express.urlencoded({ extended: false }))
app.use(morgan('dev'))

const PORT = process.env.PORT || 3000

async function initDbIfNeeded() {
  if (process.env.INIT_DB === 'true' && db.available()) {
    const p = path.join(__dirname, 'db', 'schema.sql')
    const sql = fs.readFileSync(p, 'utf8')
    const statements = sql
      .split(/;\s*\n/gi)
      .map(s => s.trim())
      .filter(Boolean)
    for (const s of statements) {
      // eslint-disable-next-line no-await-in-loop
      await db.query(s)
    }
    console.log('Database schema applied')
  }
}

app.get('/', (req, res) => {
  res.json({
    name: 'Bowl Tournament Management System',
    version: pkg.version,
    endpoints: ['/health', '/api/version', '/api/auth/login', '/api/clubs', '/api/matches', '/api/admin/titles', '/api/admin/roles', '/api/players', '/api/integrations/ocr/scoreboard', '/player/invite?name=Alex&nationality=HKG', '/join/:token']
  })
})

// 靜態資源
app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'] }))

// Convenience redirects so callers不必知道 /api 前綴
app.get('/player/invite', (req, res) => {
  const q = req.originalUrl.includes('?') ? req.originalUrl.slice(req.originalUrl.indexOf('?')) : ''
  res.redirect(302, `/api/player/invite${q}`)
})
app.get('/join/:token', (req, res) => {
  res.redirect(302, `/api/join/${req.params.token}`)
})

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

app.get('/api/version', (req, res) => {
  res.json({ version: pkg.version })
})

app.post('/api/auth/login', (req, res) => {
  const role = (req.body && req.body.role) || 'player'
  res.json({ token: 'dev-token', role })
})

app.get('/api/clubs', (req, res) => {
  res.json([])
})

app.get('/api/matches', (req, res) => {
  res.json([])
})

app.use('/api', router)

initDbIfNeeded()
  .catch(err => console.error('DB init error', err))
  .finally(() => {
    app.listen(PORT, () => {
      console.log(`Server listening on http://localhost:${PORT}`)
    })
  })

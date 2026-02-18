const express = require('express')
const crypto = require('crypto')
const jwt = require('jsonwebtoken')
const fs = require('fs')
const path = require('path')
const db = require('./db')
const router = express.Router()

const mem = {
  users: [],
  titles: [],
  roles: [],
  clubs: [],
  matches: [],
  frames: [],
  rolls: []
}

async function ensureClubColumns() {
  if (db.available()) {
    await db.query("alter table if exists clubs add column if not exists city text")
    await db.query("alter table if exists clubs add column if not exists address text")
    await db.query("alter table if exists clubs add column if not exists contact_name text")
    await db.query("alter table if exists clubs add column if not exists contact_phone text")
    await db.query("alter table if exists clubs add column if not exists contact_email text")
    await db.query("alter table if exists clubs add column if not exists logo_url text")
  }
}

async function ensureCountries() {
  if (db.available()) {
    await db.query(`create table if not exists countries (
      code text primary key,
      name text not null,
      local_name text,
      flag_url text,
      enabled boolean not null default true,
      created_at timestamptz default now()
    )`)
  }
}

async function ensureClubTemplates() {
  if (db.available()) {
    await db.query(`create table if not exists club_match_templates (
      id serial primary key,
      club_id integer not null,
      name text not null,
      mode text not null default 'friendly',
      participant_kind text not null default 'single',
      team_size integer,
      frames_per_match integer not null default 1,
      options jsonb,
      enabled boolean not null default true,
      created_at timestamptz default now()
    )`)
  }
}

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || ''
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || ''
const ADMIN_JWT_SECRET = process.env.ADMIN_JWT_SECRET || 'change-me'

function adminAuth(req, res, next) {
  const h = req.get('authorization') || ''
  const m = h.match(/^Bearer\s+(.+)$/i)
  if (!m) return res.status(401).json({ error: 'unauthorized' })
  try {
    const p = jwt.verify(m[1], ADMIN_JWT_SECRET)
    if (p.role !== 'super') return res.status(401).json({ error: 'unauthorized' })
    return next()
  } catch (e) {
    return res.status(401).json({ error: 'unauthorized' })
  }
}

function clubAuth(req, res, next) {
  const h = req.get('authorization') || ''
  const m = h.match(/^Bearer\s+(.+)$/i)
  if (!m) return res.status(401).json({ error: 'unauthorized' })
  try {
    const p = jwt.verify(m[1], ADMIN_JWT_SECRET)
    if (p.role !== 'club-admin' || !p.clubId) return res.status(401).json({ error: 'unauthorized' })
    req.clubId = p.clubId
    return next()
  } catch (e) {
    return res.status(401).json({ error: 'unauthorized' })
  }
}

router.post('/admin/login', (req, res) => {
  const { email, password } = req.body || {}
  if (!email || !password) return res.status(400).json({ error: 'email and password required' })
  if (email !== ADMIN_EMAIL || password !== ADMIN_PASSWORD) return res.status(401).json({ error: 'invalid credentials' })
  const token = jwt.sign({ sub: email, role: 'super' }, ADMIN_JWT_SECRET, { expiresIn: '12h' })
  res.json({ token })
})
router.get('/admin/titles', adminAuth, async (req, res) => {
  if (db.available()) {
    const r = await db.query('select id,name,scope from titles order by id desc')
    return res.json(r.rows)
  }
  res.json(mem.titles)
})

router.post('/admin/titles', adminAuth, async (req, res) => {
  const { name, scope } = req.body || {}
  if (!name) return res.status(400).json({ error: 'name required' })
  if (db.available()) {
    const r = await db.query('insert into titles(name,scope) values($1,$2) returning id,name,scope', [name, scope || 'club'])
    return res.status(201).json(r.rows[0])
  }
  const id = mem.titles.length + 1
  const item = { id, name, scope: scope || 'club' }
  mem.titles.push(item)
  res.status(201).json(item)
})

router.post('/admin/roles', adminAuth, async (req, res) => {
  const { name, permissions, parentRoleId } = req.body || {}
  if (!name) return res.status(400).json({ error: 'name required' })
  if (db.available()) {
    const r = await db.query('insert into roles(name,parent_role_id,permissions) values($1,$2,$3) returning id,name,parent_role_id,permissions', [name, parentRoleId || null, JSON.stringify(permissions || [])])
    return res.status(201).json(r.rows[0])
  }
  const id = mem.roles.length + 1
  const item = { id, name, parentRoleId: parentRoleId || null, permissions: permissions || [] }
  mem.roles.push(item)
  res.status(201).json(item)
})

// ----- Clubs CRUD (admin protected) -----
router.get('/admin/clubs', adminAuth, async (req, res) => {
  if (db.available()) {
    try {
      const r = await db.query('select id,name,region,city,address,contact_name,contact_phone,contact_email,logo_url,created_at from clubs order by id desc')
      return res.json(r.rows)
    } catch (e) {
      if (e && e.code === '42703') {
        try { await ensureClubColumns(); const r2 = await db.query('select id,name,region,city,address,contact_name,contact_phone,contact_email,logo_url,created_at from clubs order by id desc'); return res.json(r2.rows) } catch (e2) { return res.status(500).json({ error: 'clubs columns missing' }) }
      }
      return res.status(500).json({ error: 'list clubs failed' })
    }
  }
  res.json(mem.clubs)
})

router.post('/admin/clubs', adminAuth, async (req, res) => {
  const { name, region } = req.body || {}
  if (!name) return res.status(400).json({ error: 'name required' })
  if (db.available()) {
    const r = await db.query('insert into clubs(name,region) values($1,$2) returning id,name,region,created_at', [name, region || null])
    return res.status(201).json(r.rows[0])
  }
  const id = mem.clubs.length + 1
  const item = { id, name, region: region || null, created_at: new Date().toISOString() }
  mem.clubs.push(item)
  res.status(201).json(item)
})

router.put('/admin/clubs/:id', adminAuth, async (req, res) => {
  const id = parseInt(req.params.id, 10)
  const { name, region, city, address, contactName, contactPhone, contactEmail, logoUrl } = req.body || {}
  if (db.available()) {
    try {
      const r = await db.query('update clubs set name=coalesce($2,name), region=$3, city=$4, address=$5, contact_name=$6, contact_phone=$7, contact_email=$8, logo_url=coalesce($9,logo_url) where id=$1 returning id,name,region,city,address,contact_name,contact_phone,contact_email,logo_url,created_at', [id, name || null, region || null, city || null, address || null, contactName || null, contactPhone || null, contactEmail || null, logoUrl || null])
      if (r.rowCount === 0) return res.status(404).json({ error: 'not found' })
      return res.json(r.rows[0])
    } catch (e) {
      if (e && e.code === '42703') { try { await ensureClubColumns(); const r2 = await db.query('update clubs set name=coalesce($2,name), region=$3, city=$4, address=$5, contact_name=$6, contact_phone=$7, contact_email=$8, logo_url=coalesce($9,logo_url) where id=$1 returning id,name,region,city,address,contact_name,contact_phone,contact_email,logo_url,created_at', [id, name || null, region || null, city || null, address || null, contactName || null, contactPhone || null, contactEmail || null, logoUrl || null]); if (r2.rowCount === 0) return res.status(404).json({ error: 'not found' }); return res.json(r2.rows[0]) } catch (e2) { return res.status(500).json({ error: 'clubs columns missing' }) } }
      return res.status(500).json({ error: 'update club failed' })
    }
  }
  const idx = mem.clubs.findIndex(c => c.id === id)
  if (idx === -1) return res.status(404).json({ error: 'not found' })
  mem.clubs[idx] = { ...mem.clubs[idx], ...(name ? { name } : {}), region: region || mem.clubs[idx].region, city: city || mem.clubs[idx].city, address: address || mem.clubs[idx].address, contact_name: contactName || mem.clubs[idx].contact_name, contact_phone: contactPhone || mem.clubs[idx].contact_phone, contact_email: contactEmail || mem.clubs[idx].contact_email, logo_url: logoUrl || mem.clubs[idx].logo_url }
  res.json(mem.clubs[idx])
})

router.delete('/admin/clubs/:id', adminAuth, async (req, res) => {
  const id = parseInt(req.params.id, 10)
  if (db.available()) {
    const r = await db.query('delete from clubs where id=$1', [id])
    if (r.rowCount === 0) return res.status(404).json({ error: 'not found' })
    return res.status(204).end()
  }
  const idx = mem.clubs.findIndex(c => c.id === id)
  if (idx === -1) return res.status(404).json({ error: 'not found' })
  mem.clubs.splice(idx, 1)
  res.status(204).end()
})

router.post('/admin/clubs/:id/logo', adminAuth, express.raw({ type: ['image/png', 'image/jpeg', 'image/webp'], limit: '1mb' }), async (req, res) => {
  const id = parseInt(req.params.id, 10)
  try {
    const mime = req.get('content-type') || ''
    const exts = { 'image/png': '.png', 'image/jpeg': '.jpg', 'image/webp': '.webp' }
    const ext = exts[mime]
    if (!ext) return res.status(415).json({ error: 'unsupported media type' })
    const dir = path.join(__dirname, 'public', 'logos')
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    const filePath = path.join(dir, `${id}${ext}`)
    fs.writeFileSync(filePath, req.body)
    const url = `/logos/${id}${ext}`
    if (db.available()) {
      try { await ensureClubColumns(); await db.query('update clubs set logo_url=$2 where id=$1', [id, url]) } catch (e) { return res.status(500).json({ error: 'update logo failed' }) }
    } else {
      const idx = mem.clubs.findIndex(c => c.id === id)
      if (idx >= 0) mem.clubs[idx].logo_url = url
    }
    return res.status(201).json({ logo_url: url })
  } catch (e) {
    return res.status(500).json({ error: 'upload logo failed' })
  }
})

// ----- Countries CRUD (admin protected) -----
router.get('/super/countries', adminAuth, async (req, res) => {
  if (db.available()) {
    try{
      const r = await db.query('select code,name,local_name,flag_url,enabled,created_at from countries where enabled=true order by name asc')
      return res.json(r.rows)
    }catch(e){
      if (e && e.code === '42P01') {
        try{ await ensureCountries(); const r2 = await db.query('select code,name,local_name,flag_url,enabled,created_at from countries where enabled=true order by name asc'); return res.json(r2.rows) }catch(e2){ return res.status(500).json({ error: 'countries table missing' }) }
      }
      return res.status(500).json({ error: 'list countries failed' })
    }
  }
  const list = (mem.countries || []).filter(c => c.enabled !== false).sort((a,b)=>String(a.name).localeCompare(String(b.name)))
  res.json(list)
})

router.post('/super/countries', adminAuth, async (req, res) => {
  const { code, name, localName, flagUrl, enabled } = req.body || {}
  if (!code || !name) return res.status(400).json({ error: 'code and name required' })
  if (db.available()) {
    try{
      const r = await db.query('insert into countries(code,name,local_name,flag_url,enabled) values($1,$2,$3,$4,$5) returning code,name,local_name,flag_url,enabled,created_at', [code.trim().toUpperCase(), name.trim(), localName || null, flagUrl || null, enabled === false ? false : true])
      return res.status(201).json(r.rows[0])
    }catch(e){
      if (e && e.code === '42P01') {
        try { await ensureCountries(); const r2 = await db.query('insert into countries(code,name,local_name,flag_url,enabled) values($1,$2,$3,$4,$5) returning code,name,local_name,flag_url,enabled,created_at', [code.trim().toUpperCase(), name.trim(), localName || null, flagUrl || null, enabled === false ? false : true]); return res.status(201).json(r2.rows[0]) } catch (e2) { return res.status(500).json({ error: 'countries table missing' }) }
      }
      return res.status(500).json({ error: 'create country failed' })
    }
  }
  if (!mem.countries) mem.countries = []
  const exists = mem.countries.find(c => c.code === code.toUpperCase())
  if (exists) return res.status(409).json({ error: 'country exists' })
  const item = { code: code.toUpperCase(), name, local_name: localName || null, flag_url: flagUrl || null, enabled: enabled === false ? false : true, created_at: new Date().toISOString() }
  mem.countries.push(item)
  res.status(201).json(item)
})

router.put('/super/countries/:code', adminAuth, async (req, res) => {
  const code = (req.params.code || '').toUpperCase()
  const { name, localName, flagUrl, enabled } = req.body || {}
  if (db.available()) {
    try{
      const r = await db.query('update countries set name=coalesce($2,name), local_name=$3, flag_url=$4, enabled=coalesce($5,enabled) where code=$1 returning code,name,local_name,flag_url,enabled,created_at', [code, name || null, localName || null, flagUrl || null, typeof enabled === 'boolean' ? enabled : null])
      if (r.rowCount === 0) return res.status(404).json({ error: 'not found' })
      return res.json(r.rows[0])
    }catch(e){
      if (e && e.code === '42P01') { try { await ensureCountries(); const r2 = await db.query('update countries set name=coalesce($2,name), local_name=$3, flag_url=$4, enabled=coalesce($5,enabled) where code=$1 returning code,name,local_name,flag_url,enabled,created_at', [code, name || null, localName || null, flagUrl || null, typeof enabled === 'boolean' ? enabled : null]); if (r2.rowCount === 0) return res.status(404).json({ error: 'not found' }); return res.json(r2.rows[0]) } catch (e2) { return res.status(500).json({ error: 'countries table missing' }) } }
      return res.status(500).json({ error: 'update country failed' })
    }
  }
  if (!mem.countries) mem.countries = []
  const idx = mem.countries.findIndex(c => c.code === code)
  if (idx === -1) return res.status(404).json({ error: 'not found' })
  mem.countries[idx] = { ...mem.countries[idx], ...(name ? { name } : {}), local_name: localName ?? mem.countries[idx].local_name, flag_url: flagUrl ?? mem.countries[idx].flag_url, enabled: typeof enabled === 'boolean' ? enabled : mem.countries[idx].enabled }
  res.json(mem.countries[idx])
})

router.delete('/super/countries/:code', adminAuth, async (req, res) => {
  const code = (req.params.code || '').toUpperCase()
  if (db.available()) {
    try{
      const r = await db.query('delete from countries where code=$1', [code])
      if (r.rowCount === 0) return res.status(404).json({ error: 'not found' })
      return res.status(204).end()
    }catch(e){
      if (e && e.code === '42P01') { try { await ensureCountries(); const r2 = await db.query('delete from countries where code=$1', [code]); if (r2.rowCount === 0) return res.status(404).json({ error: 'not found' }); return res.status(204).end() } catch (e2) { return res.status(500).json({ error: 'countries table missing' }) } }
      return res.status(500).json({ error: 'delete country failed' })
    }
  }
  if (!mem.countries) mem.countries = []
  const idx = mem.countries.findIndex(c => c.code === code)
  if (idx === -1) return res.status(404).json({ error: 'not found' })
  mem.countries.splice(idx, 1)
  res.status(204).end()
})

router.get('/super/clubs', adminAuth, async (req, res) => {
  if (db.available()) {
    const r = await db.query('select id,name,region,created_at from clubs order by id desc')
    return res.json(r.rows)
  }
  res.json(mem.clubs)
})

router.post('/super/club-admin/link', adminAuth, async (req, res) => {
  const { clubId } = req.body || {}
  const id = parseInt(clubId, 10)
  if (!id) return res.status(400).json({ error: 'clubId required' })
  const token = jwt.sign({ role: 'club-admin', clubId: id }, ADMIN_JWT_SECRET, { expiresIn: '12h' })
  const url = `${req.protocol}://${req.get('host')}/club-admin/login.html#token=${token}`
  res.json({ token, url })
})

// Upload flag image (admin protected) - store under public/flags/<ISO3>.<ext>
router.post(
  '/super/countries/:code/flag',
  adminAuth,
  express.raw({ type: ['image/png', 'image/jpeg', 'image/webp'], limit: '1mb' }),
  async (req, res) => {
    try {
      const code = (req.params.code || '').toUpperCase()
      if (!code || code.length !== 3) return res.status(400).json({ error: 'invalid code' })
      const mime = req.get('content-type') || ''
      const exts = { 'image/png': '.png', 'image/jpeg': '.jpg', 'image/webp': '.webp' }
      const ext = exts[mime]
      if (!ext) return res.status(415).json({ error: 'unsupported media type' })
      const dir = path.join(__dirname, 'public', 'flags')
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
      const filePath = path.join(dir, `${code}${ext}`)
      fs.writeFileSync(filePath, req.body)
      const url = `/flags/${code}${ext}`
      if (db.available()) {
        await ensureCountries()
        await db.query('update countries set flag_url=$2 where code=$1', [code, url])
      } else {
        if (!mem.countries) mem.countries = []
        const idx = mem.countries.findIndex(c => c.code === code)
        if (idx >= 0) mem.countries[idx].flag_url = url
      }
      return res.status(201).json({ flag_url: url })
    } catch (e) {
      return res.status(500).json({ error: 'upload flag failed' })
    }
  }
)

// ----- Club Admin profile (by token clubId) -----
router.get('/club/profile', clubAuth, async (req, res) => {
  const id = req.clubId
  if (db.available()) {
    const r = await db.query('select id,name,region,city,address,contact_name,contact_phone,contact_email,logo_url,created_at from clubs where id=$1', [id])
    if (r.rowCount === 0) return res.status(404).json({ error: 'not found' })
    return res.json(r.rows[0])
  }
  const c = mem.clubs.find(x => x.id === id)
  if (!c) return res.status(404).json({ error: 'not found' })
  res.json(c)
})

router.put('/club/profile', clubAuth, async (req, res) => {
  const id = req.clubId
  const { name, region, city, address, contactName, contactPhone, contactEmail } = req.body || {}
  if (db.available()) {
    try {
      const r = await db.query('update clubs set name=coalesce($2,name), region=$3, city=$4, address=$5, contact_name=$6, contact_phone=$7, contact_email=$8 where id=$1 returning id,name,region,city,address,contact_name,contact_phone,contact_email,logo_url,created_at', [id, name || null, region || null, city || null, address || null, contactName || null, contactPhone || null, contactEmail || null])
      if (r.rowCount === 0) return res.status(404).json({ error: 'not found' })
      return res.json(r.rows[0])
    } catch (e) {
      if (e && e.code === '42703') { try { await ensureClubColumns(); const r2 = await db.query('update clubs set name=coalesce($2,name), region=$3, city=$4, address=$5, contact_name=$6, contact_phone=$7, contact_email=$8 where id=$1 returning id,name,region,city,address,contact_name,contact_phone,contact_email,logo_url,created_at', [id, name || null, region || null, city || null, address || null, contactName || null, contactPhone || null, contactEmail || null]); if (r2.rowCount === 0) return res.status(404).json({ error: 'not found' }); return res.json(r2.rows[0]) } catch (e2) { return res.status(500).json({ error: 'clubs columns missing' }) } }
      return res.status(500).json({ error: 'update club failed' })
    }
  }
  const idx = mem.clubs.findIndex(c => c.id === id)
  if (idx === -1) return res.status(404).json({ error: 'not found' })
  mem.clubs[idx] = { ...mem.clubs[idx], ...(name ? { name } : {}), region: region || mem.clubs[idx].region, city: city || mem.clubs[idx].city, address: address || mem.clubs[idx].address, contact_name: contactName || mem.clubs[idx].contact_name, contact_phone: contactPhone || mem.clubs[idx].contact_phone, contact_email: contactEmail || mem.clubs[idx].contact_email }
  res.json(mem.clubs[idx])
})

router.post('/club/logo', clubAuth, express.raw({ type: ['image/png', 'image/jpeg', 'image/webp'], limit: '1mb' }), async (req, res) => {
  const id = req.clubId
  try {
    const mime = req.get('content-type') || ''
    const exts = { 'image/png': '.png', 'image/jpeg': '.jpg', 'image/webp': '.webp' }
    const ext = exts[mime]
    if (!ext) return res.status(415).json({ error: 'unsupported media type' })
    const dir = path.join(__dirname, 'public', 'logos')
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    const filePath = path.join(dir, `${id}${ext}`)
    fs.writeFileSync(filePath, req.body)
    const url = `/logos/${id}${ext}`
    if (db.available()) {
      try { await ensureClubColumns(); await db.query('update clubs set logo_url=$2 where id=$1', [id, url]) } catch (e) { return res.status(500).json({ error: 'update logo failed' }) }
    } else {
      const idx = mem.clubs.findIndex(c => c.id === id)
      if (idx >= 0) mem.clubs[idx].logo_url = url
    }
    return res.status(201).json({ logo_url: url })
  } catch (e) {
    return res.status(500).json({ error: 'upload logo failed' })
  }
})

router.get('/club/templates', clubAuth, async (req, res) => {
  const id = req.clubId
  if (db.available()) {
    try { await ensureClubTemplates(); const r = await db.query('select id,club_id,name,mode,participant_kind,team_size,frames_per_match,options,enabled,created_at from club_match_templates where club_id=$1 order by id desc', [id]); return res.json(r.rows) } catch (e) { return res.status(500).json({ error: 'list templates failed' }) }
  }
  res.json([])
})

router.post('/club/templates', clubAuth, async (req, res) => {
  const id = req.clubId
  const { name, mode, participantKind, teamSize, framesPerMatch, options, enabled } = req.body || {}
  if (!name) return res.status(400).json({ error: 'name required' })
  if (framesPerMatch && framesPerMatch < 1) return res.status(400).json({ error: 'framesPerMatch invalid' })
  if (participantKind === 'team' && (!teamSize || teamSize < 2)) return res.status(400).json({ error: 'teamSize required for team' })
  if (mode === 'tournament' && options) {
    if (!options.lanes || options.lanes < 1) return res.status(400).json({ error: 'lanes invalid' })
    if (!options.participants_limit || options.participants_limit < 5) return res.status(400).json({ error: 'participants_limit invalid' })
    const prelimGames = options.prelim && options.prelim.games
    if (!prelimGames || prelimGames < 1) return res.status(400).json({ error: 'prelim.games invalid' })
    const bracket = options.bracket || {}
    if (bracket.type !== 'stepladder' || bracket.seeds !== 5) return res.status(400).json({ error: 'bracket must be stepladder-5' })
  }
  if (db.available()) {
    try { await ensureClubTemplates(); const r = await db.query('insert into club_match_templates(club_id,name,mode,participant_kind,team_size,frames_per_match,options,enabled) values($1,$2,$3,$4,$5,$6,$7,$8) returning id,club_id,name,mode,participant_kind,team_size,frames_per_match,options,enabled,created_at', [id, name, mode || 'friendly', participantKind || 'single', teamSize || null, framesPerMatch || 1, options || null, enabled === false ? false : true]); return res.status(201).json(r.rows[0]) } catch (e) { return res.status(500).json({ error: 'create template failed' }) }
  }
  res.status(201).json({ id: Date.now(), club_id: id, name, mode: mode || 'friendly', participant_kind: participantKind || 'single', team_size: teamSize || null, frames_per_match: framesPerMatch || 1, options: options || null, enabled: enabled !== false })
})

router.put('/club/templates/:tplId', clubAuth, async (req, res) => {
  const clubId = req.clubId
  const tplId = parseInt(req.params.tplId, 10)
  const { name, mode, participantKind, teamSize, framesPerMatch, options, enabled } = req.body || {}
  if (framesPerMatch && framesPerMatch < 1) return res.status(400).json({ error: 'framesPerMatch invalid' })
  if (participantKind === 'team' && teamSize !== undefined && teamSize !== null && teamSize < 2) return res.status(400).json({ error: 'teamSize invalid' })
  if (mode === 'tournament' && options) {
    if (options.lanes !== undefined && options.lanes < 1) return res.status(400).json({ error: 'lanes invalid' })
    if (options.participants_limit !== undefined && options.participants_limit < 5) return res.status(400).json({ error: 'participants_limit invalid' })
    if (options.prelim && options.prelim.games !== undefined && options.prelim.games < 1) return res.status(400).json({ error: 'prelim.games invalid' })
    if (options.bracket) {
      if (options.bracket.type && options.bracket.type !== 'stepladder') return res.status(400).json({ error: 'bracket.type must be stepladder' })
      if (options.bracket.seeds && options.bracket.seeds !== 5) return res.status(400).json({ error: 'bracket.seeds must be 5' })
    }
  }
  if (db.available()) {
    try { await ensureClubTemplates(); const r = await db.query('update club_match_templates set name=coalesce($3,name), mode=coalesce($4,mode), participant_kind=coalesce($5,participant_kind), team_size=$6, frames_per_match=coalesce($7,frames_per_match), options=$8, enabled=coalesce($9,enabled) where id=$1 and club_id=$2 returning id,club_id,name,mode,participant_kind,team_size,frames_per_match,options,enabled,created_at', [tplId, clubId, name || null, mode || null, participantKind || null, teamSize || null, framesPerMatch || null, options || null, typeof enabled === 'boolean' ? enabled : null]); if (r.rowCount === 0) return res.status(404).json({ error: 'not found' }); return res.json(r.rows[0]) } catch (e) { return res.status(500).json({ error: 'update template failed' }) }
  }
  res.json({ id: tplId })
})

router.delete('/club/templates/:tplId', clubAuth, async (req, res) => {
  const clubId = req.clubId
  const tplId = parseInt(req.params.tplId, 10)
  if (db.available()) {
    try { await ensureClubTemplates(); const r = await db.query('delete from club_match_templates where id=$1 and club_id=$2', [tplId, clubId]); if (r.rowCount === 0) return res.status(404).json({ error: 'not found' }); return res.status(204).end() } catch (e) { return res.status(500).json({ error: 'delete template failed' }) }
  }
  return res.status(204).end()
})

router.get('/club/templates/:tplId/plan', clubAuth, async (req, res) => {
  const clubId = req.clubId
  const tplId = parseInt(req.params.tplId, 10)
  if (db.available()) {
    try {
      await ensureClubTemplates()
      const r = await db.query('select id,club_id,name,mode,participant_kind,team_size,frames_per_match,options from club_match_templates where id=$1 and club_id=$2', [tplId, clubId])
      if (r.rowCount === 0) return res.status(404).json({ error: 'not found' })
      const t = r.rows[0]
      if (t.mode !== 'tournament' || !t.options || t.options.bracket?.type !== 'stepladder' || t.options.bracket?.seeds !== 5) {
        return res.status(400).json({ error: 'template must be tournament stepladder-5' })
      }
      const prelim = { games: t.options.prelim?.games || 1, lanes: t.options.lanes || 1, participants_limit: t.options.participants_limit || 5 }
      const frames = t.frames_per_match || 1
      const bracket = [
        { round: 1, label: '5 vs 4', frames },
        { round: 2, label: '勝者 vs 3', frames },
        { round: 3, label: '勝者 vs 2', frames },
        { round: 4, label: '勝者 vs 1（決賽）', frames },
      ]
      return res.json({ template: { id: t.id, name: t.name }, prelim, bracket })
    } catch (e) {
      return res.status(500).json({ error: 'plan failed' })
    }
  }
  // memory fallback
  return res.json({ template: { id: tplId }, prelim: { games: 1, lanes: 1, participants_limit: 5 }, bracket: [{ round:1, label:'5 vs 4', frames:1 },{ round:2, label:'勝者 vs 3', frames:1 },{ round:3, label:'勝者 vs 2', frames:1 },{ round:4, label:'勝者 vs 1（決賽）', frames:1 }] })
})

router.post('/club/templates/:tplId/generate', clubAuth, async (req, res) => {
  const clubId = req.clubId
  const tplId = parseInt(req.params.tplId, 10)
  if (db.available()) {
    try {
      await ensureClubTemplates()
      const r = await db.query('select id,club_id,name,mode,participant_kind,team_size,frames_per_match,options from club_match_templates where id=$1 and club_id=$2', [tplId, clubId])
      if (r.rowCount === 0) return res.status(404).json({ error: 'not found' })
      const t = r.rows[0]
      if (t.mode !== 'tournament' || !t.options || t.options.bracket?.type !== 'stepladder' || t.options.bracket?.seeds !== 5) {
        return res.status(400).json({ error: 'template must be tournament stepladder-5' })
      }
      const frames = t.frames_per_match || 1
      const ids = []
      // 建立 4 場淘汰賽占位（player_ids 空陣列，待後續以初賽排名指派）
      for (let i = 1; i <= 4; i++) {
        const mr = await db.query('insert into matches(competition_id,club_id,player_ids,frames_per_match,status) values($1,$2,$3,$4,$5) returning id', [null, clubId, JSON.stringify([]), frames, 'scheduled'])
        ids.push(mr.rows[0].id)
      }
      return res.status(201).json({ matchIds: ids })
    } catch (e) {
      return res.status(500).json({ error: 'generate failed' })
    }
  }
  const ids = []
  for (let i = 1; i <= 4; i++) {
    const id = mem.matches.length + 1
    mem.matches.push({ id, competitionId: null, clubId, playerIds: [], framesPerMatch: 1, status: 'scheduled' })
    ids.push(id)
  }
  res.status(201).json({ matchIds: ids })
})
function rankSeeds(results) {
  return [...results].sort((a, b) => {
    const ta = Number(a.total || 0)
    const tb = Number(b.total || 0)
    if (tb !== ta) return tb - ta
    // 簡化的 tie-break：以 playerId 作固定排序避免不確定性
    return Number(a.playerId) - Number(b.playerId)
  }).slice(0, 5).map(r => Number(r.playerId))
}

router.post('/club/templates/:tplId/seeds', clubAuth, async (req, res) => {
  const clubId = req.clubId
  const tplId = parseInt(req.params.tplId, 10)
  const { results } = req.body || {}
  if (!Array.isArray(results) || results.length < 5) return res.status(400).json({ error: 'results need at least 5 players' })
  if (db.available()) {
    try {
      await ensureClubTemplates()
      const r = await db.query('select id,club_id,name,mode,options from club_match_templates where id=$1 and club_id=$2', [tplId, clubId])
      if (r.rowCount === 0) return res.status(404).json({ error: 'not found' })
      const seeds = rankSeeds(results)
      // 可選：把 seeds 寫回 options（方便後續檢視）
      const t = r.rows[0]
      const opts = Object.assign({}, t.options || {}, { bracket: Object.assign({}, (t.options||{}).bracket || {}, { seeds_list: seeds }) })
      await db.query('update club_match_templates set options=$2 where id=$1', [tplId, opts])
      return res.json({ seeds })
    } catch (e) {
      return res.status(500).json({ error: 'seeding failed' })
    }
  }
  return res.json({ seeds: rankSeeds(results) })
})

router.post('/club/templates/:tplId/assign-seeds', clubAuth, async (req, res) => {
  const clubId = req.clubId
  const tplId = parseInt(req.params.tplId, 10)
  const { matchIds, seeds } = req.body || {}
  if (!Array.isArray(matchIds) || matchIds.length !== 4) return res.status(400).json({ error: 'matchIds length must be 4' })
  if (!Array.isArray(seeds) || seeds.length !== 5) return res.status(400).json({ error: 'seeds length must be 5' })
  const [s1, s2, s3, s4, s5] = seeds.map(Number) // s1=最高分
  if (db.available()) {
    try {
      await ensureClubTemplates()
      // 初始指派：Round1: 5 vs 4，其餘先放置單邊種子
      await db.query('update matches set player_ids=$2 where id=$1 and club_id=$3', [matchIds[0], JSON.stringify([s5, s4]), clubId])
      await db.query('update matches set player_ids=$2 where id=$1 and club_id=$3', [matchIds[1], JSON.stringify([s3]), clubId])
      await db.query('update matches set player_ids=$2 where id=$1 and club_id=$3', [matchIds[2], JSON.stringify([s2]), clubId])
      await db.query('update matches set player_ids=$2 where id=$1 and club_id=$3', [matchIds[3], JSON.stringify([s1]), clubId])
      // 記錄到模板 options 以便 UI 顯示
      const r = await db.query('select options from club_match_templates where id=$1 and club_id=$2', [tplId, clubId])
      const opts = Object.assign({}, (r.rows[0] && r.rows[0].options) || {})
      opts.bracket = Object.assign({}, opts.bracket || {}, { matchIds, seeds_list: seeds })
      await db.query('update club_match_templates set options=$2 where id=$1', [tplId, opts])
      return res.json({ assigned: true, matchIds })
    } catch (e) {
      return res.status(500).json({ error: 'assign failed' })
    }
  }
  return res.json({ assigned: true, matchIds })
})
router.post('/players', async (req, res) => {
  const { name, nationality, photoUrl } = req.body || {}
  if (!name) return res.status(400).json({ error: 'name required' })
  if (db.available()) {
    const r = await db.query('insert into users(name,nationality,photo_url) values($1,$2,$3) returning id,name,nationality,photo_url', [name, nationality || null, photoUrl || null])
    return res.status(201).json(r.rows[0])
  }
  const id = mem.users.length + 1
  const item = { id, name, nationality: nationality || null, photoUrl: photoUrl || null }
  mem.users.push(item)
  res.status(201).json(item)
})

router.post('/matches', async (req, res) => {
  const { competitionId, clubId, playerIds, framesPerMatch } = req.body || {}
  if (!Array.isArray(playerIds) || playerIds.length < 2) return res.status(400).json({ error: 'playerIds required' })
  if (db.available()) {
    const r = await db.query('insert into matches(competition_id,club_id,player_ids,frames_per_match,status) values($1,$2,$3,$4,$5) returning id', [competitionId || null, clubId || null, JSON.stringify(playerIds), framesPerMatch || 4, 'created'])
    return res.status(201).json({ id: r.rows[0].id })
  }
  const id = mem.matches.length + 1
  mem.matches.push({ id, competitionId: competitionId || null, clubId: clubId || null, playerIds, framesPerMatch: framesPerMatch || 4, status: 'created' })
  res.status(201).json({ id })
})

router.post('/matches/:id/frames', async (req, res) => {
  const matchId = parseInt(req.params.id, 10)
  const { frameNo, rolls } = req.body || {}
  if (!frameNo || !Array.isArray(rolls)) return res.status(400).json({ error: 'frameNo and rolls required' })
  const valid = rolls.every(r => typeof r.playerId === 'number' && Array.isArray(r.pins))
  if (!valid) return res.status(400).json({ error: 'invalid rolls payload' })
  if (db.available()) {
    const f = await db.query('insert into frames(match_id,frame_no) values($1,$2) returning id', [matchId, frameNo])
    for (const r of rolls) {
      await db.query('insert into rolls(frame_id,player_id,pins) values($1,$2,$3)', [f.rows[0].id, r.playerId, JSON.stringify(r.pins)])
    }
    return res.status(201).json({ frameId: f.rows[0].id })
  }
  const frameId = mem.frames.length + 1
  mem.frames.push({ id: frameId, matchId, frameNo })
  for (const r of rolls) {
    const rollId = mem.rolls.length + 1
    mem.rolls.push({ id: rollId, frameId, playerId: r.playerId, pins: r.pins })
  }
  res.status(201).json({ frameId })
})

router.post('/integrations/ocr/scoreboard', (req, res) => {
  res.status(501).json({ error: 'Not Implemented' })
})

router.get('/integrations/centers/:id/scores', (req, res) => {
  res.status(501).json({ error: 'Not Implemented' })
})

// （已完成修補後）移除了一次性修補端點

// ----- Player QR match flow -----
async function ensureUser(name, nationality) {
  if (!db.available()) {
    const id = mem.users.length + 1
    const item = { id, name, nationality: nationality || null }
    mem.users.push(item)
    return item
  }
  const r = await db.query('insert into users(name,nationality) values($1,$2) returning id,name,nationality', [name, nationality || null])
  return r.rows[0]
}

function tok() { return crypto.randomBytes(16).toString('hex') }

router.get('/player/invite', async (req, res) => {
  const name = (req.query.name || '').trim()
  const nationality = (req.query.nationality || '').trim() || null
  if (!name) return res.status(400).send('name required, e.g. /player/invite?name=Alex&nationality=HKG')
  try {
    // 放寬此頁的 CSP 以允許外部 QR 服務
    res.set('Content-Security-Policy', [
      "default-src 'self'",
      "img-src * data: blob:",
      "style-src 'self' 'unsafe-inline'",
      "script-src 'self' 'unsafe-inline'",
      "connect-src 'self'"
    ].join('; '))
    const u1 = await ensureUser(name, nationality)
    let matchId
    if (db.available()) {
      const mr = await db.query(
        'insert into matches(competition_id,club_id,player_ids,frames_per_match,status) values($1,$2,$3,$4,$5) returning id',
        [null, null, JSON.stringify([u1.id]), 4, 'pending']
      )
      matchId = mr.rows[0].id
      const t = tok()
      await db.query('insert into match_invites(match_id, token, created_at) values($1,$2, now())', [matchId, t])
      const joinUrl = `${req.protocol}://${req.get('host')}/api/join/${t}`
      const qr = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(joinUrl)}`
      return res.send(`
        <!doctype html><meta name="viewport" content="width=device-width,initial-scale=1">
        <h2>邀請對手掃碼加入比賽</h2>
        <p>發起人：${name}${nationality ? `（${nationality}）` : ''}</p>
        <img alt="QR" src="${qr}">
        <p><a href="${joinUrl}">${joinUrl}</a></p>
      `)
    }
    // memory fallback
    const id = mem.matches.length + 1
    mem.matches.push({ id, playerIds: [u1.id], framesPerMatch: 4, status: 'pending' })
    const t = tok()
    if (!mem.invites) mem.invites = []
    mem.invites.push({ token: t, matchId: id })
    const joinUrl = `${req.protocol}://${req.get('host')}/api/join/${t}`
    const qr = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(joinUrl)}`
    res.send(`
      <!doctype html><meta name="viewport" content="width=device-width,initial-scale=1">
      <h2>邀請對手掃碼加入比賽</h2>
      <p>發起人：${name}${nationality ? `（${nationality}）` : ''}</p>
      <img alt="QR" src="${qr}">
      <p><a href="${joinUrl}">${joinUrl}</a></p>
    `)
  } catch (e) {
    res.status(500).send('invite error')
  }
})

router.get('/join/:token', async (req, res) => {
  const token = req.params.token
  res.send(`
    <!doctype html><meta name="viewport" content="width=device-width,initial-scale=1">
    <h2>加入比賽</h2>
    <form method="post" action="/api/player/matches/join">
      <input type="hidden" name="token" value="${token}">
      <div><label>名字</label><br><input name="name" required></div>
      <div><label>國籍（可空）</label><br><input name="nationality" placeholder="HKG"></div>
      <div style="margin-top:8px;"><button type="submit">加入</button></div>
    </form>
  `)
})

router.post('/player/matches/join', async (req, res) => {
  const body = req.is('application/json') ? req.body : req.body
  const token = (body.token || '').trim()
  const name = (body.name || '').trim()
  const nationality = (body.nationality || '').trim() || null
  if (!token || !name) return res.status(400).json({ error: 'token and name required' })
  try {
    if (db.available()) {
      const ir = await db.query('select match_id from match_invites where token = $1', [token])
      if (ir.rowCount === 0) return res.status(404).json({ error: 'invalid token' })
      const matchId = ir.rows[0].match_id
      const u2 = await ensureUser(name, nationality)
      const mr = await db.query('select player_ids from matches where id=$1', [matchId])
      const ids = mr.rows[0].player_ids || []
      if (ids.length >= 2) return res.status(400).json({ error: 'match already full' })
      ids.push(u2.id)
      await db.query('update matches set player_ids=$1, status=$2 where id=$3', [JSON.stringify(ids), 'created', matchId])
      if (req.is('application/x-www-form-urlencoded')) {
        return res.send(`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><p>加入成功，Match #${matchId}</p>`)
      }
      return res.status(200).json({ matchId })
    }
    if (!mem.invites) return res.status(404).json({ error: 'invalid token' })
    const inv = mem.invites.find(x => x.token === token)
    if (!inv) return res.status(404).json({ error: 'invalid token' })
    const u2 = await ensureUser(name, nationality)
    const m = mem.matches.find(x => x.id === inv.matchId)
    if (!m) return res.status(404).json({ error: 'match not found' })
    if (m.playerIds.length >= 2) return res.status(400).json({ error: 'match already full' })
    m.playerIds.push(u2.id)
    m.status = 'created'
    if (req.is('application/x-www-form-urlencoded')) {
      return res.send(`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><p>加入成功，Match #${m.id}</p>`)
    }
    res.json({ matchId: m.id })
  } catch (e) {
    res.status(500).json({ error: 'join error' })
  }
})

// ----- Match summary & per-frame scores (每局總分) -----
router.get('/matches/:id/summary', async (req, res) => {
  const id = parseInt(req.params.id, 10)
  if (db.available()) {
    try {
      const mr = await db.query('select id, player_ids, frames_per_match, status from matches where id=$1', [id])
      if (mr.rowCount === 0) return res.status(404).json({ error: 'match not found' })
      const match = mr.rows[0]
      const fr = await db.query('select frame_no, scores from frames where match_id=$1 order by frame_no', [id])
      return res.json({ id, playerIds: match.player_ids, framesPerMatch: match.frames_per_match, status: match.status, frames: fr.rows })
    } catch (e) {
      if (e && e.code === '42703') {
        try {
          await db.query('alter table if exists frames add column if not exists scores jsonb')
          const mr2 = await db.query('select id, player_ids, frames_per_match, status from matches where id=$1', [id])
          if (mr2.rowCount === 0) return res.status(404).json({ error: 'match not found' })
          const match2 = mr2.rows[0]
          const fr2 = await db.query('select frame_no, scores from frames where match_id=$1 order by frame_no', [id])
          return res.json({ id, playerIds: match2.player_ids, framesPerMatch: match2.frames_per_match, status: match2.status, frames: fr2.rows })
        } catch (e2) {
          return res.status(500).json({ error: 'schema missing: frames.scores', action: 'set INIT_DB=true then redeploy' })
        }
      }
      return res.status(500).json({ error: 'summary failed' })
    }
  }
  const m = mem.matches.find(x => x.id === id)
  if (!m) return res.status(404).json({ error: 'match not found' })
  const frames = mem.frames
    .filter(f => f.matchId === id)
    .sort((a,b)=>a.frameNo-b.frameNo)
    .map(f=>({ frame_no: f.frameNo, scores: f.scores||null }))
  res.json({ id, playerIds: m.playerIds, framesPerMatch: m.framesPerMatch, status: m.status, frames })
})

router.post('/matches/:id/scores', async (req, res) => {
  const id = parseInt(req.params.id, 10)
  const { frameNo, scores } = req.body || {}
  if (!frameNo || !scores || typeof scores !== 'object') return res.status(400).json({ error: 'frameNo and scores required' })
  if (db.available()) {
    try {
      const fr = await db.query('select id from frames where match_id=$1 and frame_no=$2', [id, frameNo])
      if (fr.rowCount === 0) {
        const ins = await db.query('insert into frames(match_id,frame_no,scores) values($1,$2,$3) returning id', [id, frameNo, JSON.stringify(scores)])
        return res.status(201).json({ frameId: ins.rows[0].id })
      }
      const fid = fr.rows[0].id
      await db.query('update frames set scores=$1 where id=$2', [JSON.stringify(scores), fid])
      return res.status(200).json({ frameId: fid })
    } catch (e) {
      if (e && e.code === '42703') {
        try {
          await db.query('alter table if exists frames add column if not exists scores jsonb')
          const fr2 = await db.query('select id from frames where match_id=$1 and frame_no=$2', [id, frameNo])
          if (fr2.rowCount === 0) {
            const ins2 = await db.query('insert into frames(match_id,frame_no,scores) values($1,$2,$3) returning id', [id, frameNo, JSON.stringify(scores)])
            return res.status(201).json({ frameId: ins2.rows[0].id })
          }
          const fid2 = fr2.rows[0].id
          await db.query('update frames set scores=$1 where id=$2', [JSON.stringify(scores), fid2])
          return res.status(200).json({ frameId: fid2 })
        } catch (e2) {
          return res.status(500).json({ error: 'schema missing: frames.scores', action: 'set INIT_DB=true then redeploy' })
        }
      }
      return res.status(500).json({ error: 'update scores failed' })
    }
  }
  let f = mem.frames.find(x => x.matchId === id && x.frameNo === frameNo)
  if (!f) {
    const fid = mem.frames.length + 1
    f = { id: fid, matchId: id, frameNo, scores }
    mem.frames.push(f)
    return res.status(201).json({ frameId: fid })
  }
  f.scores = scores
  res.json({ frameId: f.id })
})

router.post('/matches/:id/winner', async (req, res) => {
  const id = parseInt(req.params.id, 10)
  const { tplId, winnerPlayerId, loserPlayerId } = req.body || {}
  if (!tplId || !winnerPlayerId) return res.status(400).json({ error: 'tplId and winnerPlayerId required' })
  if (db.available()) {
    try {
      const mr = await db.query('select club_id, player_ids from matches where id=$1', [id])
      if (mr.rowCount === 0) return res.status(404).json({ error: 'match not found' })
      const clubId = mr.rows[0].club_id
      const tr = await db.query('select options from club_match_templates where id=$1 and club_id=$2', [tplId, clubId])
      if (tr.rowCount === 0) return res.status(404).json({ error: 'template not found' })
      const opts = tr.rows[0].options || {}
      const mIds = (opts.bracket && opts.bracket.matchIds) || []
      const idx = mIds.indexOf(id)
      if (idx === -1) return res.status(400).json({ error: 'match not in template bracket' })
      // 記錄勝者
      const winners = Array.isArray(opts.bracket?.winners_by_round) ? opts.bracket.winners_by_round : []
      winners[idx] = Number(winnerPlayerId)
      opts.bracket = Object.assign({}, opts.bracket || {}, { winners_by_round: winners })
      // 推進到下一場
      let nextAssigned = null
      if (idx === 0 && mIds[1]) {
        const next = await db.query('select player_ids from matches where id=$1', [mIds[1]])
        const arr = (next.rows[0] && next.rows[0].player_ids) || []
        const merged = arr.length >= 2 ? arr : [...arr, Number(winnerPlayerId)]
        await db.query('update matches set player_ids=$1 where id=$2', [JSON.stringify(merged), mIds[1]])
        nextAssigned = { matchId: mIds[1], playerIds: merged }
      } else if (idx === 1 && mIds[2]) {
        if (typeof loserPlayerId === 'number') opts.bracket.third_place = Number(loserPlayerId)
        const next = await db.query('select player_ids from matches where id=$1', [mIds[2]])
        const arr = (next.rows[0] && next.rows[0].player_ids) || []
        const merged = arr.length >= 2 ? arr : [...arr, Number(winnerPlayerId)]
        await db.query('update matches set player_ids=$1 where id=$2', [JSON.stringify(merged), mIds[2]])
        nextAssigned = { matchId: mIds[2], playerIds: merged }
      } else if (idx === 2 && mIds[3]) {
        const next = await db.query('select player_ids from matches where id=$1', [mIds[3]])
        const arr = (next.rows[0] && next.rows[0].player_ids) || []
        const merged = arr.length >= 2 ? arr : [...arr, Number(winnerPlayerId)]
        await db.query('update matches set player_ids=$1 where id=$2', [JSON.stringify(merged), mIds[3]])
        nextAssigned = { matchId: mIds[3], playerIds: merged }
      } else if (idx === 3) {
        opts.bracket.champion = Number(winnerPlayerId)
        if (typeof loserPlayerId === 'number') opts.bracket.runner_up = Number(loserPlayerId)
      }
      await db.query('update club_match_templates set options=$2 where id=$1', [tplId, opts])
      return res.json({ ok: true, nextAssigned, bracket: opts.bracket })
    } catch (e) {
      return res.status(500).json({ error: 'winner submit failed' })
    }
  }
  res.json({ ok: true })
})
// ----- Mobile match page (under /api, top-level redirect provided in index.js) -----
router.get('/m/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10)
  res.set('Content-Security-Policy', [
    "default-src 'self'",
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "connect-src 'self'",
  ].join('; '))
  res.send(`<!doctype html>
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>比賽進行 #${id}</title>
<style>
body{font-family:system-ui,Segoe UI,Roboto,Arial,sans-serif;margin:14px}
.card{border:1px solid #ddd;border-radius:8px;padding:12px;margin:10px 0}
label{display:block;margin:6px 0 4px}
input,button{padding:10px;font-size:16px}
button{cursor:pointer}
.row{display:flex;gap:12px;flex-wrap:wrap}
.row>div{flex:1;min-width:140px}
#log{background:#0b1020;color:#e8e8e8;border-radius:8px;padding:10px;white-space:pre-wrap}
</style>
<h2>比賽進行 #${id}</h2>
<div class="card" id="summary">載入中…</div>
<div class="card">
  <div class="row">
    <div><label>第幾局</label><input id="frameNo" value="1" type="number" min="1"></div>
    <div><label id="p1Label">P1 分數</label><input id="p1Score" type="number" min="0" value="0"></div>
    <div><label id="p2Label">P2 分數</label><input id="p2Score" type="number" min="0" value="0"></div>
  </div>
  <div style="margin-top:10px"><button onclick="submitFrame()">提交此局</button>
  <button onclick="refresh()">更新</button>
  <button onclick="share()">分享</button></div>
  <div class="row" style="margin-top:10px">
    <div><label>模板ID（推進用）</label><input id="tplIdWinner" type="number" min="1"></div>
    <div><button onclick="submitWinner(1)">P1勝</button> <button onclick="submitWinner(2)">P2勝</button></div>
  </div>
</div>
<div class="card"><div id="log">等待操作…</div></div>
<script>
const id=${id};
function log(x){document.getElementById('log').textContent=(typeof x==='string')?x:JSON.stringify(x,null,2)}
async function refresh(){
  const r=await fetch('/api/matches/'+id+'/summary')
  const d=await r.json()
  const s=document.getElementById('summary')
  const names=(d.playerIds||[]).join(' vs ')
  s.innerHTML='<b>Players</b>: '+names+'<br><b>局數</b>: '+(d.framesPerMatch||4)+'<br><b>已入分</b>:'+ (d.frames||[]).map(f=>'#'+f.frame_no+': '+JSON.stringify(f.scores||{})).join(' , ')
  if(d.playerIds&&d.playerIds.length>=2){
    document.getElementById('p1Label').textContent='P1(' + d.playerIds[0] + ') 分數'
    document.getElementById('p2Label').textContent='P2(' + d.playerIds[1] + ') 分數'
  }
  window._players = d.playerIds || []
}
async function submitFrame(){
  const frameNo=Number(document.getElementById('frameNo').value)
  const p1=Number(document.getElementById('p1Score').value||0)
  const p2=Number(document.getElementById('p2Score').value||0)
  const d=await fetch('/api/matches/'+id+'/scores',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({frameNo,scores:{p1:p1,p2:p2}})})
  const t=await d.text();try{log(JSON.parse(t))}catch{log(t)}
  refresh()
}
function share(){
  const url=location.href
  navigator.clipboard&&navigator.clipboard.writeText(url)
  alert('分享連結已複製：'+url)
}
async function submitWinner(sel){
  const tpl=Number(document.getElementById('tplIdWinner').value||0)
  if(!tpl){ alert('請先輸入模板ID'); return }
  const winner=(window._players||[])[sel-1]
  const loser=(window._players||[])[sel===1?1:0]
  if(!winner){ alert('尚未載入選手'); return }
  const r=await fetch('/api/matches/'+id+'/winner',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({tplId:tpl,winnerPlayerId:winner,loserPlayerId:loser})})
  const t=await r.text();try{log(JSON.parse(t))}catch{log(t)}
}
refresh()
</script>`)
})

module.exports = router

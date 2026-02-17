const express = require('express')
const crypto = require('crypto')
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

router.get('/admin/titles', async (req, res) => {
  if (db.available()) {
    const r = await db.query('select id,name,scope from titles order by id desc')
    return res.json(r.rows)
  }
  res.json(mem.titles)
})

router.post('/admin/titles', async (req, res) => {
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

router.post('/admin/roles', async (req, res) => {
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
      "script-src 'self' 'unsafe-inline'"
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

module.exports = router

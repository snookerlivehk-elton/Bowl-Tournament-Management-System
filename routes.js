const express = require('express')
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

module.exports = router

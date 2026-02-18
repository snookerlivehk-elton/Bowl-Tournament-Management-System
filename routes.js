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

// ----- One-time patch endpoint: add frames.scores column -----
router.post('/admin/patch/frames-scores', async (req, res) => {
  const key = process.env.PATCH_KEY
  const provided = req.get('x-patch-key') || req.query.key
  if (!key || !provided || provided !== key) {
    return res.status(403).json({ error: 'forbidden' })
  }
  if (!db.available()) {
    return res.status(503).json({ error: 'db unavailable' })
  }
  try {
    const check = await db.query("select 1 from information_schema.columns where table_name='frames' and column_name='scores'")
    if (check.rowCount > 0) {
      return res.status(200).json({ status: 'exists' })
    }
    await db.query('alter table if exists frames add column if not exists scores jsonb')
    return res.status(201).json({ status: 'added' })
  } catch (e) {
    return res.status(500).json({ error: 'patch failed' })
  }
})

// GET 版本（方便從瀏覽器觸發），同樣以 PATCH_KEY 保護
router.get('/admin/patch/frames-scores', async (req, res) => {
  const key = process.env.PATCH_KEY
  const provided = req.get('x-patch-key') || req.query.key
  if (!key || !provided || provided !== key) {
    return res.status(403).json({ error: 'forbidden' })
  }
  if (!db.available()) {
    return res.status(503).json({ error: 'db unavailable' })
  }
  try {
    const check = await db.query("select 1 from information_schema.columns where table_name='frames' and column_name='scores'")
    if (check.rowCount > 0) return res.status(200).json({ status: 'exists' })
    await db.query('alter table if exists frames add column if not exists scores jsonb')
    return res.status(201).json({ status: 'added' })
  } catch (e) {
    return res.status(500).json({ error: 'patch failed' })
  }
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

// ----- Mobile match page (under /api, top-level redirect provided in index.js) -----
router.get('/m/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10)
  res.set('Content-Security-Policy', [
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
refresh()
</script>`)
})

module.exports = router

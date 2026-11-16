// Bandit camp in the ruined town to the east, across the lake (Old Mole's first job).
// Keeps 15 Bandits plus 1 leader (suppressed AK-74, 25% drop) in the town, mostly in the long hall at the back.
// They only spawn while a player is nearby (so the area is loaded) but out of sight (40+ blocks from the centre),
// and the camp tops up at most once every 10 minutes. Several players can do the quest at once.
const CAMP = { x: -1233, z: 22, near: 170, minDist: 40 }
const SPAWNS = [[-1203, 68, 14], [-1217, 71, 51], [-1200, 72, 30], [-1200, 68, 39], [-1207, 71, 49], [-1210, 72, 10],
  [-1211, 69, 43], [-1207, 71, 23], [-1220, 68, 13], [-1211, 68, 25], [-1236, 69, 9], [-1244, 68, -4],
  [-1236, 68, 3], [-1243, 83, 1], [-1245, 70, 5], [-1268, 71, 38]]
const LEADER_SPAWN = [-1208, 68, 38]
const MAX = 15
const REFILL_TICKS = 20 * 60 * 10
const AREA = `x=${CAMP.x - 60},y=40,z=${CAMP.z - 60},dx=120,dy=80,dz=120`
// Awareness (blocks). Seen = clear line of sight. Heard = through walls, close by.
const SIGHT = 40, SIGHT_SNEAK = 20, HEAR = 10, HEAR_SNEAK = 4, SQUAD = 24
const DEBUG = false
let ticks = 0
let zbWarned = false
let lastRefill = -REFILL_TICKS

// Calls the first method name that exists (Mojang names on vanilla classes, SRG names on mod classes).
function zbCall(o, names) {
  for (var i = 0; i < names.length; i++) { if (typeof o[names[i]] === 'function') return o[names[i]]() }
  return undefined
}

function zbCall1(o, names, a) {
  for (var i = 0; i < names.length; i++) { if (typeof o[names[i]] === 'function') return o[names[i]](a) }
  return undefined
}

function summonBandit(server, pt, template, tag) {
  server.runCommandSilent(`execute in minecraft:overworld run summon tacznpcs:npc ${pt[0] + 0.5} ${pt[1]} ${pt[2] + 0.5} {template:"${template}",CustomName:'{"text":"Bandit"}',PersistenceRequired:1b,Tags:["zone_bandit","${tag}"]}`)
}

function awareness(server) {
  const level = server.getLevel('minecraft:overworld')
  const players = []
  server.players.forEach(p => {
    if (!String(p.level.dimension).includes('overworld') || zbCall(p, ['isCreative', 'm_7500_']) || zbCall(p, ['isSpectator', 'm_5833_']) || zbCall(p, ['isAlive', 'm_6084_']) === false) return
    if (Math.hypot(p.x - CAMP.x, p.z - CAMP.z) < 110) players.push(p)
  })
  if (players.length === 0) return
  const box = AABB.of(CAMP.x - 70, 40, CAMP.z - 70, CAMP.x + 70, 120, CAMP.z + 70)
  const bandits = []
  level.getEntitiesWithin(box).forEach(e => { if (String(e.getEncodeId()) == 'tacznpcs:npc' && String(e.name.string) == 'Bandit' && zbCall(e, ['isAlive', 'm_6084_']) !== false) bandits.push(e) })
  let set = 0, had = 0
  bandits.forEach(b => {
    const cur = zbCall(b, ['m_5448_', 'getTarget'])
    if (cur) had++
    if (cur && zbCall(cur, ['m_6084_', 'isAlive']) && !zbCall(cur, ['isCreative', 'm_7500_'])) return
    let best = null, bestD = 1e9
    players.forEach(p => {
      const d = zbCall1(b, ['m_20270_', 'distanceTo'], p)
      const sneak = zbCall(p, ['isCrouching', 'm_6047_'])
      const seen = d <= (sneak ? SIGHT_SNEAK : SIGHT) && zbCall1(b, ['m_142582_', 'hasLineOfSight'], p)
      const heard = d <= (sneak ? HEAR_SNEAK : HEAR)
      if ((seen || heard) && d < bestD) { best = p; bestD = d }
    })
    if (!best) return
    zbCall1(b, ['m_6710_', 'setTarget'], best); set++
    // shout to the squad
    bandits.forEach(o => { if (o !== b && !zbCall(o, ['m_5448_', 'getTarget']) && zbCall1(o, ['m_20270_', 'distanceTo'], b) <= SQUAD) zbCall1(o, ['m_6710_', 'setTarget'], best) })
  })
  if (DEBUG && ticks % 100 === 0) {
    const n = bandits[0]
    console.info(`[zone-debug] players=${players.length} bandits=${bandits.length} hadTarget=${had} setNow=${set}` +
      (n ? ` | nearest-ish bandit: target=${n.m_5448_() ? n.m_5448_().name.string : 'none'} dist=${n.m_20270_(players[0]).toFixed(1)} los=${n.m_142582_(players[0])} main=${n.m_21205_()}` : ''))
  }
}

ServerEvents.tick(event => {
  ticks++
  const server = event.server
  if (ticks % 10 === 0) { try { awareness(server) } catch (err) { if (!zbWarned) { zbWarned = true; console.error('[zone] bandit awareness failed: ' + err) } } }
  if (ticks % 100 !== 0) return
  let near = false, tooClose = false
  server.players.forEach(p => {
    if (!String(p.level.dimension).includes('overworld')) return
    const d = Math.hypot(p.x - CAMP.x, p.z - CAMP.z)
    if (d < CAMP.near) near = true
    if (d < CAMP.minDist) tooClose = true
  })
  if (!near || tooClose || ticks - lastRefill < REFILL_TICKS) return
  lastRefill = ticks
  const grunts = server.runCommandSilent(`execute if entity @e[type=tacznpcs:npc,name=Bandit,tag=!zone_leader,${AREA}]`) || 0
  const leaders = server.runCommandSilent(`execute if entity @e[type=tacznpcs:npc,tag=zone_leader,${AREA}]`) || 0
  const missing = Math.max(0, MAX - grunts)
  const start = Math.floor(Math.random() * SPAWNS.length)
  const order = SPAWNS.slice(start).concat(SPAWNS.slice(0, start))
  for (let i = 0; i < missing; i++) summonBandit(server, order[i % order.length], 'bandits', 'zone_grunt')
  if (leaders < 1) summonBandit(server, LEADER_SPAWN, 'bandit_leader', 'zone_leader')
  if (missing > 0 || leaders < 1) console.info(`[zone] bandit camp topped up: ${missing} bandits${leaders < 1 ? ' + leader' : ''}`)
})

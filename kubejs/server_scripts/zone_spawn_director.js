// Zone spawn director (Slade).
// Lonesome wilderness, a busy city.
//  - Wilderness: most natural zombie spawns are cancelled. You get the odd straggler, sometimes a small pack.
//  - Mutants never spawn naturally. Instead each player rolls a rare "encounter" (one mutant, or a small pack)
//    that spawns out of sight nearby. Chimeras only in the city.
//  - City: zombies spawn freely (with a cap) and it is the only place hordes happen - rare, only while you are inside.
// Test commands (op):  /kubejs custom_command zone_encounter   /kubejs custom_command zone_horde
// Everything worth tuning is in CFG.

const CFG = {
  // City bounds (from the map, centre ~ 248, 64). Anything inside is "city".
  CITY: { minX: -330, maxX: 710, minZ: -520, maxZ: 620 },
  // No encounters / hordes near the bunker.
  SAFE: [{ x: -1528, z: 94, r: 80 }],
  // No mutants at all around the bandit Town (encounters skip it, strays are removed).
  // r: removed when nobody's looking; inner: removed even if someone is (keeps them out of the Bar itself)
  NO_MUTANTS: [{ x: -1233, z: 22, r: 130 }, { x: -1524, z: 94, r: 140, inner: 45 }],

  // --- Wilderness zombies ---
  WILD_CHANCE_DAY: 0.05,     // share of natural zombie spawn attempts allowed in daylight (dark spots only, as vanilla)
  WILD_CHANCE_NIGHT: 0.06,   // ... and at night
  WILD_CAP: 3,               // max zombies within WILD_CAP_RADIUS of a new spawn
  WILD_CAP_RADIUS: 56,
  PACK_CHANCE: 0.15,         // an allowed spawn becomes a small pack this often
  PACK_SIZE: [3, 5],
  PACK_CAP: 7,

  // Hard limit, whatever spawned them: zombies within PLAYER_CAP_RADIUS of a player. Extras that are
  // far from everyone (> CULL_MIN_DIST) and not chasing anyone are quietly removed.
  PLAYER_CAP_DAY: 4,
  PLAYER_CAP_NIGHT: 7,
  PLAYER_CAP_CITY: 18,
  PLAYER_CAP_RADIUS: 96,
  CULL_MIN_DIST: 36,

  // --- City zombies ---
  CITY_CAP: 14,              // max zombies within CITY_CAP_RADIUS of a new spawn
  CITY_CAP_RADIUS: 40,

  // --- Mutant encounters (minutes of play per player between rolls) ---
  WILD_ENCOUNTER_MIN: [35, 60],
  CITY_ENCOUNTER_MIN: [14, 24],
  ENCOUNTER_DIST: [30, 46],
  WILD_POOL: [  // [mob, weight, min, max]
    ['itz:boar', 30, 1, 2],
    ['itz:snork', 25, 1, 2],
    ['itz:psydog', 25, 2, 3],
    ['itz:bloodsucker', 12, 1, 1],
    ['itz:armored_elk', 8, 1, 1]
  ],
  CITY_POOL: [
    ['itz:snork', 30, 1, 3],
    ['itz:psydog', 20, 2, 3],
    ['itz:bloodsucker', 30, 1, 1],
    ['itz:chimera', 10, 1, 1]
  ],

  // --- City hordes (minutes spent inside the city between hordes) ---
  HORDE_MIN: [35, 60],
  HORDE_SIZE: [12, 20],
  HORDE_DIST: [28, 40],

  DEBUG: false              // true = tell players in chat when the director spawns something
}

const ZOMBIES = {}
;['minecraft:zombie', 'minecraft:husk', 'minecraft:drowned', 'minecraft:zombie_villager',
  'itz:zombified_stalker', 'anomalyzone:zombified_raider'].forEach(id => { ZOMBIES[id] = true })
const MUTANTS = {}
;['itz:boar', 'itz:snork', 'itz:psydog', 'itz:bloodsucker', 'itz:chimera', 'itz:armored_elk'].forEach(id => { MUTANTS[id] = true })

const PASSABLE = {}
;['minecraft:air', 'minecraft:cave_air', 'minecraft:grass', 'minecraft:tall_grass', 'minecraft:fern', 'minecraft:large_fern',
  'minecraft:snow', 'minecraft:dead_bush', 'minecraft:vine'].forEach(id => { PASSABLE[id] = true })

let zsdTick = 0
let zsdWarned = false
const zsdState = {}           // per player: { enc: ticksUntilEncounter, horde: cityTicksUntilHorde }
let zsdPack = null            // { x, z, left, until }

// Calls the first method name that exists (KubeJS exposes Mojang names on vanilla classes, SRG names on some mod classes).
function zsdCall(o, names) {
  for (var i = 0; i < names.length; i++) { if (typeof o[names[i]] === 'function') return o[names[i]]() }
  return undefined
}
function zsdActivePlayer(p) {
  return String(p.level.dimension).includes('overworld') && !zsdCall(p, ['isCreative', 'm_7500_']) &&
    !zsdCall(p, ['isSpectator', 'm_5833_']) && zsdCall(p, ['isAlive', 'm_6084_']) !== false
}
function rnd(a, b) { return a + Math.random() * (b - a) }
function rint(a, b) { return Math.floor(rnd(a, b + 1)) }
function minutes(range) { return Math.floor(rnd(range[0], range[1]) * 60 * 20) }
function inCity(x, z) { const c = CFG.CITY; return x >= c.minX && x <= c.maxX && z >= c.minZ && z <= c.maxZ }
function inSafe(x, z) { return CFG.SAFE.some(s => Math.hypot(x - s.x, z - s.z) < s.r) || CFG.NO_MUTANTS.some(s => Math.hypot(x - s.x, z - s.z) < s.r) }
function isNight(level) {
  var t = level.dayTime
  if (t === undefined || t === null) t = zsdCall(level, ['getDayTime', 'm_46468_'])
  t = Number(t) % 24000
  return t > 12800 && t < 23200
}
function zombiesNear(level, x, y, z, r) {
  var n = 0
  level.getEntitiesWithin(AABB.of(x - r, y - 32, z - r, x + r, y + 32, z + r)).forEach(e => {
    if (ZOMBIES[String(e.getEncodeId())]) n++
  })
  return n
}
function zsdCull(p) {
  var level = p.level, r = CFG.PLAYER_CAP_RADIUS
  var city = inCity(p.x, p.z)
  var cap = city ? CFG.PLAYER_CAP_CITY : (isNight(level) ? CFG.PLAYER_CAP_NIGHT : CFG.PLAYER_CAP_DAY)
  var list = []
  level.getEntitiesWithin(AABB.of(p.x - r, p.y - 48, p.z - r, p.x + r, p.y + 48, p.z + r)).forEach(e => {
    if (!ZOMBIES[String(e.getEncodeId())]) return
    var tags = zsdCall(e, ['getTags', 'm_19880_'])
    if (tags && (tags.contains('zone_horde') || tags.contains('zone_story') || tags.contains('zone_encounter') || tags.contains('az_test_subject'))) return
    list.push(e)
  })
  if (list.length <= cap) return
  // farthest first; never remove one that is close, or chasing someone
  list.sort((a, b) => Math.hypot(b.x - p.x, b.z - p.z) - Math.hypot(a.x - p.x, a.z - p.z))
  var extra = list.length - cap, removed = 0
  for (var i = 0; i < list.length && removed < extra; i++) {
    var e = list[i]
    if (Math.hypot(e.x - p.x, e.z - p.z) < CFG.CULL_MIN_DIST) break
    if (zsdCall(e, ['getTarget', 'm_5448_'])) continue
    var nearOther = false
    p.server.players.forEach(o => { if (o !== p && Math.hypot(e.x - o.x, e.z - o.z) < CFG.CULL_MIN_DIST) nearOther = true })
    if (nearOther) continue
    zsdCall(e, ['discard', 'm_146870_'])
    removed++
  }
}
function say(p, msg) { if (CFG.DEBUG) p.tell(`[zone] ${msg}`) }

// ---------------------------------------------------------------- natural spawns
EntityEvents.checkSpawn(event => {
  if (String(event.type) !== 'NATURAL') return
  var deny = false
  try { deny = shouldDeny(event) } catch (err) {
    if (!zsdWarned) { zsdWarned = true; console.error('[zone] spawn check failed: ' + err) }
  }
  if (deny) event.cancel()
})

function shouldDeny(event) {
  var level = event.level
  if (!String(level.dimension).includes('overworld')) return false
  var id = String(event.entity.getEncodeId())
  if (MUTANTS[id]) return true      // mutants only come from the director
  if (!ZOMBIES[id]) return false
  var x = event.x, y = event.y, z = event.z
  if (inCity(x, z)) return zombiesNear(level, x, y, z, CFG.CITY_CAP_RADIUS) >= CFG.CITY_CAP
  // Part of a zsdPack that was just var through?
  if (zsdPack && zsdTick <= zsdPack.until && zsdPack.left > 0 && Math.hypot(x - zsdPack.x, z - zsdPack.z) < 12) {
    zsdPack.left--
    return zombiesNear(level, x, y, z, CFG.WILD_CAP_RADIUS) >= CFG.PACK_CAP
  }
  var chance = isNight(level) ? CFG.WILD_CHANCE_NIGHT : CFG.WILD_CHANCE_DAY
  if (Math.random() >= chance) return true
  if (zombiesNear(level, x, y, z, CFG.WILD_CAP_RADIUS) >= CFG.WILD_CAP) return true
  if (Math.random() < CFG.PACK_CHANCE) zsdPack = { x: x, z: z, left: rint(CFG.PACK_SIZE[0], CFG.PACK_SIZE[1]) - 1, until: zsdTick + 2 }
  return false
}

// ---------------------------------------------------------------- director spawns
function groundAt(level, x, yStart, z) {
  for (var dy = 24; dy >= -24; dy--) {
    var y = Math.floor(yStart) + dy
    var below = String(level.getBlock(x, y - 1, z).id)
    var feet = String(level.getBlock(x, y, z).id)
    var head = String(level.getBlock(x, y + 1, z).id)
    var airy = function (id) { return PASSABLE[id] === true }
    if (airy(feet) && airy(head) && !airy(below) && below !== 'minecraft:void_air' &&
        !below.includes('leaves') && !below.includes('water') && !below.includes('lava')) return y
  }
  return null
}

function spawnAround(p, mob, count, dist, tag) {
  var level = p.level
  for (var attempt = 0; attempt < 8; attempt++) {
    var a = Math.random() * Math.PI * 2
    var d = rnd(dist[0], dist[1])
    var x = Math.floor(p.x + Math.cos(a) * d)
    var z = Math.floor(p.z + Math.sin(a) * d)
    if (inSafe(x, z)) continue
    var y = groundAt(level, x, p.y, z)
    if (y === null) continue
    for (var i = 0; i < count; i++) {
      var ox = (Math.random() - 0.5) * 4, oz = (Math.random() - 0.5) * 4
      p.server.runCommandSilent(`execute in minecraft:overworld run summon ${mob} ${x + 0.5 + ox} ${y} ${z + 0.5 + oz} {Tags:["${tag}"]}`)
    }
    return true
  }
  return false
}

function pick(pool) {
  var total = 0
  pool.forEach(e => { total += e[1] })
  var r = Math.random() * total
  for (var i = 0; i < pool.length; i++) { r -= pool[i][1]; if (r <= 0) return pool[i] }
  return pool[0]
}

function encounter(p) {
  var city = inCity(p.x, p.z)
  var e = pick(city ? CFG.CITY_POOL : CFG.WILD_POOL)
  var n = rint(e[2], e[3])
  if (spawnAround(p, e[0], n, CFG.ENCOUNTER_DIST, 'zone_encounter')) { say(p, `encounter: ${n}x ${e[0]}`); return true }
  return false
}

function horde(p) {
  var n = rint(CFG.HORDE_SIZE[0], CFG.HORDE_SIZE[1])
  // split into 2-3 groups so it closes in from more than one side
  var groups = rint(2, 3)
  var done = 0
  for (var g = 0; g < groups; g++) {
    var size = g === groups - 1 ? n - done : Math.floor(n / groups)
    if (spawnAround(p, 'minecraft:zombie', size, CFG.HORDE_DIST, 'zone_horde')) done += size
  }
  if (done > 0) {
    p.server.runCommandSilent(`execute as ${String(p.profile.name)} at @s run playsound hordes:horde_spawn hostile @s ~ ~ ~ 1 0.8`)
    say(p, `city horde: ${done} zombies`)
  }
  return done > 0
}

ServerEvents.tick(event => {
  zsdTick++
  if (zsdTick % 100 !== 0) return   // every 5 s
  try {
    event.server.players.forEach(p => {
      var name = String(p.profile.name)
      var s = zsdState[name] || (zsdState[name] = { enc: minutes(CFG.WILD_ENCOUNTER_MIN), horde: minutes(CFG.HORDE_MIN) })
      if (String(p.level.dimension).includes('overworld')) zsdCull(p)
      if (!zsdActivePlayer(p)) return
      if (inSafe(p.x, p.z)) return
      var city = inCity(p.x, p.z)
      s.enc -= 100
      if (s.enc <= 0) {
        if (encounter(p) || s.enc < -20 * 60) s.enc = minutes(city ? CFG.CITY_ENCOUNTER_MIN : CFG.WILD_ENCOUNTER_MIN)
      }
      if (city) {
        s.horde -= 100
        if (s.horde <= 0) {
          if (horde(p) || s.horde < -20 * 60) s.horde = minutes(CFG.HORDE_MIN)
        }
      }
    })
  } catch (err) {
    if (!zsdWarned) { zsdWarned = true; console.error('[zone] spawn director failed: ' + err) }
  }
})

ServerEvents.customCommand('zone_encounter', event => {
  var p = event.entity
  if (p && p.isPlayer()) p.tell(encounter(p) ? 'Encounter spawned nearby.' : 'No spot found, try again.')
})
ServerEvents.customCommand('zone_horde', event => {
  var p = event.entity
  if (p && p.isPlayer()) p.tell(horde(p) ? 'Horde incoming.' : 'No spot found, try again.')
})

// ---------------------------------------------------------------- no mutants around the bandit Town
var zsdTownTick = 0
ServerEvents.tick(event => {
  if (++zsdTownTick % 100 !== 0) return
  try {
    CFG.NO_MUTANTS.forEach(q => {
      var box = 'x=' + (q.x - q.r) + ',dx=' + (2 * q.r) + ',z=' + (q.z - q.r) + ',dz=' + (2 * q.r) + ',y=-64,dy=420'
      Object.keys(MUTANTS).forEach(id => {
        // out of everyone's sight: dropped below the world (no loot, no corpse)
        event.server.runCommandSilent('execute in minecraft:overworld as @e[type=' + id + ',' + box + '] at @s unless entity @a[distance=..24] run tp @s ~ -250 ~')
        if (q.inner) event.server.runCommandSilent('execute in minecraft:overworld positioned ' + q.x + ' 0 ' + q.z + ' as @e[type=' + id + ',x=' + (q.x - q.inner) + ',dx=' + (2 * q.inner) + ',z=' + (q.z - q.inner) + ',dz=' + (2 * q.inner) + ',y=-64,dy=420] run tp @s ~ -250 ~')
      })
    })
  } catch (err) { console.error('[zone] town mutant sweep failed: ' + err) }
})

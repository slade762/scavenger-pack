// Zone spawn director (Slade).
// Lonesome wilderness, a busy city.
//  - Zombies are the City's doing (lore: it turns people who get too close). Far west of it (the Bar, Old Town)
//    there are no natural zombies at all. Heading east they start to appear: the odd straggler first, then more
//    and bigger packs the closer you get. Tune the ramp with CLEAN_DIST and the [far, edge] pairs in CFG.
//  - Mutants never spawn naturally. Instead each player rolls a rare "encounter" (one mutant, or a small pack)
//    that spawns out of sight nearby. Chimeras only in the city.
//  - City: zombies spawn freely (with a cap) and it is the only place hordes happen - rare, only while you are inside.
//  - Pasha's "Dead on Their Feet" (quest 11): a story group of Turned Scavengers at the Lost Patrol, south-east of the Bar.
// Test commands (op):  /kubejs custom_command zone_encounter   /kubejs custom_command zone_horde
//                      /kubejs custom_command zone_spawn_info  (zombie density where you stand)
//                      /kubejs custom_command zone_turned_here (move the Lost Patrol to where you stand)
//                      /kubejs custom_command zone_turned_status
// Everything worth tuning is in CFG.

const CFG = {
  // City bounds (from the map, centre ~ 248, 64). Anything inside is "city".
  CITY: { minX: -330, maxX: 710, minZ: -520, maxZ: 620 },
  // No encounters / hordes near the bunker.
  SAFE: [{ x: -1528, z: 94, r: 80 }],
  // No mutants at all around the bandit Town (encounters skip it, strays are removed).
  // r: removed when nobody's looking; inner: removed even if someone is (keeps them out of the Bar itself)
  NO_MUTANTS: [{ x: -1233, z: 22, r: 130 }, { x: -1524, z: 94, r: 140, inner: 45 }],

  // --- Wilderness zombies: a ramp from none (far west) to plenty (the City's edge) ---
  // t = 0 at CLEAN_DIST blocks or more from the City's edge, 1 right at the edge. Pairs are [value at t=0, value at t=1].
  // Spawn chances use t squared, so the first few hundred blocks inside CLEAN_DIST stay very quiet.
  CLEAN_DIST: 900,           // Bar, Old Town, Culverts, Tunnels, Chalet are all further out: no natural zombies there
  WILD_CHANCE_DAY: [0, 0.22],   // share of natural zombie spawn attempts allowed (dark spots only, as vanilla)
  WILD_CHANCE_NIGHT: [0, 0.30],
  WILD_CAP: [1, 8],          // max zombies within WILD_CAP_RADIUS of a new spawn
  WILD_CAP_RADIUS: 56,
  PACK_CHANCE: [0.05, 0.35], // an allowed spawn becomes a small pack this often
  PACK_SIZE_MIN: [2, 4],
  PACK_SIZE_MAX: [3, 7],
  PACK_CAP: [4, 12],

  // Hard limit, whatever spawned them: zombies within PLAYER_CAP_RADIUS of a player (ramped the same way; 0 in the
  // clean west). Extras that are far from everyone (> CULL_MIN_DIST) and not chasing anyone are quietly removed.
  PLAYER_CAP_DAY: [0, 10],
  PLAYER_CAP_NIGHT: [0, 14],
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
  HORDE_SIZE: [16, 24],
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
function zsdCityDist(x, z) {
  var c = CFG.CITY
  var dx = Math.max(c.minX - x, 0, x - c.maxX), dz = Math.max(c.minZ - z, 0, z - c.maxZ)
  return Math.hypot(dx, dz)
}
// 0 = clean west (no zombies), 1 = the City's edge
function zsdRamp(x, z) { return Math.max(0, 1 - zsdCityDist(x, z) / CFG.CLEAN_DIST) }
function zsdLerp(pair, t) { return pair[0] + (pair[1] - pair[0]) * t }
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
  var cap = city ? CFG.PLAYER_CAP_CITY : Math.round(zsdLerp(isNight(level) ? CFG.PLAYER_CAP_NIGHT : CFG.PLAYER_CAP_DAY, zsdRamp(p.x, p.z)))
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
  // Cancelling alone doesn't stop a natural spawn on Forge 1.20.1 (it only skips finalizeSpawn), so also mark the
  // mob as removed: the level then refuses to add it.
  if (deny) { event.cancel(); try { zsdCall(event.entity, ['discard', 'm_146870_']) } catch (e) {} }
})

function shouldDeny(event) {
  var level = event.level
  if (!String(level.dimension).includes('overworld')) return false
  var id = String(event.entity.getEncodeId())
  if (MUTANTS[id]) return true      // mutants only come from the director
  if (!ZOMBIES[id]) return false
  var x = event.x, y = event.y, z = event.z
  if (inCity(x, z)) return zombiesNear(level, x, y, z, CFG.CITY_CAP_RADIUS) >= CFG.CITY_CAP
  var t = zsdRamp(x, z)
  if (t <= 0) return true                                   // the clean west: none at all
  // Part of a zsdPack that was just let through?
  if (zsdPack && zsdTick <= zsdPack.until && zsdPack.left > 0 && Math.hypot(x - zsdPack.x, z - zsdPack.z) < 12) {
    zsdPack.left--
    return zombiesNear(level, x, y, z, CFG.WILD_CAP_RADIUS) >= Math.round(zsdLerp(CFG.PACK_CAP, t))
  }
  var chance = zsdLerp(isNight(level) ? CFG.WILD_CHANCE_NIGHT : CFG.WILD_CHANCE_DAY, t * t)
  if (Math.random() >= chance) return true
  if (zombiesNear(level, x, y, z, CFG.WILD_CAP_RADIUS) >= Math.round(zsdLerp(CFG.WILD_CAP, t))) return true
  if (Math.random() < zsdLerp(CFG.PACK_CHANCE, t * t)) {
    var size = rint(Math.round(zsdLerp(CFG.PACK_SIZE_MIN, t)), Math.round(zsdLerp(CFG.PACK_SIZE_MAX, t)))
    zsdPack = { x: x, z: z, left: size - 1, until: zsdTick + 2 }
  }
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
    var a = Math.random() * 3.141592653589793 * 2
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

ServerEvents.customCommand('zone_spawn_info', event => {
  var p = event.entity
  if (!p || !p.isPlayer()) return
  if (inCity(p.x, p.z)) { p.tell('[zone] Inside the City: zombies spawn freely (cap ' + CFG.CITY_CAP + ' per ' + CFG.CITY_CAP_RADIUS + ' blocks), hordes on.'); return }
  var t = zsdRamp(p.x, p.z), night = isNight(p.level)
  p.tell('[zone] ' + Math.round(zsdCityDist(p.x, p.z)) + ' blocks from the City edge, ramp ' + t.toFixed(2) +
    (t <= 0 ? ' (clean zone: no zombies)' : ': spawn chance ' + (100 * zsdLerp(night ? CFG.WILD_CHANCE_NIGHT : CFG.WILD_CHANCE_DAY, t * t)).toFixed(1) +
      '%, local cap ' + Math.round(zsdLerp(CFG.WILD_CAP, t)) + ', player cap ' + Math.round(zsdLerp(night ? CFG.PLAYER_CAP_NIGHT : CFG.PLAYER_CAP_DAY, t)) +
      (night ? ' (night)' : ' (day)')))
})

// ---------------------------------------------------------------- Pasha's "Dead on Their Feet": turned scavengers
// Natural zombies never reach the Bar now, so quest 11 gets its own: a patrol of Yarik's scavengers who went too close
// to the City and came back turned. They only exist while someone has the quest, and come back RESPAWN_SEC after
// they're all dead (so every player in a group can get their 5). They count as minecraft:zombie for the quest.
var ZTN = {
  QUEST: 11,
  SPOT: { x: -1310, z: 291 },        // default spot; move with /kubejs custom_command zone_turned_here
  COUNT: 6,
  ACTIVE: 96,                        // spawn only while a player is this close (chunks loaded)
  RESPAWN_SEC: 90,
  LEASH: 16,                         // a turned scavenger farther than this from the spot, with nobody near it, is put back
  LEASH_FREE: 20,                    // ...unless a player is this close to it (it's chasing someone)
  WAYPOINT: { name: 'Lost Patrol', color: 12 },
  DIALOGS: {
    30: "Moe sent you? Good, he's got an eye for the ones worth saving. I'm Pasha. I teach new scavengers how not to die in their first week. " +
        "Lesson one: the dead. Out here there aren't any, the City keeps them close. Get too near it and it turns you. Some of Yarik's lads found that out. " +
        "They wandered back last week and they're shambling around south-east of here. I've marked the spot on your map. Put them down. It's a mercy.",
    31: "Still at it? They were ours once. Don't let that slow your trigger finger."
  },
  QUEST_TEXT: "A patrol of Yarik's scavengers went east, too close to the City, and came back turned. They're shambling around the Lost Patrol " +
    "spot south-east of the Bar (marked on your map). Kill 5 of them, then go back to Pasha."
}
var ztnTick = 0, ztnWarned = {}, ztnTextDone = false
function ztnErr(k, e) { if (!ztnWarned[k]) { ztnWarned[k] = true; console.error('[zone] turned ' + k + ': ' + e) } }
function ztnCmd(srv, c) { return Number(srv.runCommandSilent(String(c))) || 0 }
function ztnLoad(srv) {
  // 11/19: Lost Patrol moved off the mountainside to -1310, 291 (Ward). One-time move of the saved spot.
  try { if (!srv.persistentData.getBoolean('zone_turned_moved_1119')) { srv.persistentData.putBoolean('zone_turned_moved_1119', true); srv.runCommandSilent('kill @e[type=minecraft:zombie,tag=zone_turned]'); srv.persistentData.putString('zone_turned', JSON.stringify({ x: -1310, z: 291, alive: false, next: 0 })) } } catch (e) {}
  try { var raw = String(srv.persistentData.getString('zone_turned') || ''); if (raw) return JSON.parse(raw) } catch (e) {}
  return { x: ZTN.SPOT.x, z: ZTN.SPOT.z, alive: false, next: 0 }
}
function ztnSave(srv, st) { srv.persistentData.putString('zone_turned', JSON.stringify(st)) }
function ztnWanted(p) {
  try { return typeof zstIP === 'function' && zstIP(p).hasActiveQuest(ZTN.QUEST) } catch (e) { ztnErr('quest check', e); return false }
}
function ztnSpawn(srv, st) {
  var n = 0
  for (var i = 0; i < ZTN.COUNT * 3 && n < ZTN.COUNT; i++) {
    var x = Math.floor(st.x + (Math.random() - 0.5) * 12), z = Math.floor(st.z + (Math.random() - 0.5) * 12)
    if (ztnCmd(srv, 'execute in minecraft:overworld if loaded ' + x + ' 0 ' + z) <= 0) continue
    if (typeof zpoiWet === 'function' && zpoiWet(srv, x, z)) continue
    ztnCmd(srv, 'execute in minecraft:overworld positioned ' + (x + 0.5) + ' 0 ' + (z + 0.5) + ' positioned over motion_blocking_no_leaves run summon minecraft:zombie ~ ~ ~ ' +
      '{CustomName:\'{"text":"Turned Scavenger"}\',PersistenceRequired:1b,Tags:["zone_story","zone_turned"],' +
      'ArmorItems:[{},{},{id:"itz:psz_chestplate_loner",Count:1b},{}],ArmorDropChances:[0f,0f,0f,0f]}')
    n++
  }
  return n
}
function ztnStep(srv) {
  var st = ztnLoad(srv), now = Date.now(), wanted = false, near = false
  srv.players.forEach(function (p) {
    if (!String(p.level.dimension).includes('overworld')) return
    var close = Math.hypot(p.x - st.x, p.z - st.z) < ZTN.ACTIVE
    if (close) near = true
    if (close && ztnWanted(p)) wanted = true
  })
  if (!near) return
  var have = ztnCmd(srv, 'execute in minecraft:overworld if entity @e[type=minecraft:zombie,tag=zone_turned]')
  if (have > 0) { if (!st.alive) { st.alive = true; ztnSave(srv, st) } try { ztnLeash(srv, st) } catch (e) { ztnErr('leash', e) } return }
  if (st.alive) { st.alive = false; st.next = now + ZTN.RESPAWN_SEC * 1000; ztnSave(srv, st); return }   // just cleared
  if (!wanted || now < st.next) return
  var n = ztnSpawn(srv, st)
  if (n > 0) { st.alive = true; ztnSave(srv, st); console.info('[zone] turned: ' + n + ' Turned Scavengers at ' + st.x + ', ' + st.z) }
}
// keep the patrol at the Lost Patrol spot: vanilla zombies wander off (and the Bar safe zone removes any that get near the Bar)
function ztnLeash(srv, st) {
  var players = []
  srv.players.forEach(function (p) { if (String(p.level.dimension).includes('overworld')) players.push([p.x, p.z]) })
  srv.overworld().getEntities().forEach(function (e) {
    try {
      if (!e.tags.contains('zone_turned')) return
      if (Math.hypot(e.x - st.x, e.z - st.z) <= ZTN.LEASH) return
      for (var i = 0; i < players.length; i++) if (Math.hypot(players[i][0] - e.x, players[i][1] - e.z) < ZTN.LEASH_FREE) return
      var x = Math.floor(st.x + (Math.random() - 0.5) * 10) + 0.5, z = Math.floor(st.z + (Math.random() - 0.5) * 10) + 0.5
      ztnCmd(srv, 'execute in minecraft:overworld as ' + e.uuid + ' positioned ' + x + ' 0 ' + z + ' positioned over motion_blocking_no_leaves run tp @s ~ ~ ~')
    } catch (err) {}
  })
}
// where the patrol is now (middle of the loaded ones), else the spot. Used by zone_quest_markers.js.
global.zoneTurnedWhere = function (srv) {
  var st = ztnLoad(srv), sx = 0, sz = 0, n = 0
  try { srv.overworld().getEntities().forEach(function (e) { try { if (e.tags.contains('zone_turned')) { sx += e.x; sz += e.z; n++ } } catch (err) {} }) } catch (e) {}
  return n > 0 ? [Math.floor(sx / n), Math.floor(sz / n)] : [st.x, st.z]
}
function ztnTexts() {
  var api = Java.loadClass('noppes.npcs.api.NpcAPI').Instance(), ok = 0, fail = []
  Object.keys(ZTN.DIALOGS).forEach(function (id) {
    try { var d = api.getDialogs().get(Number(id)); if (String(d.getText()) !== ZTN.DIALOGS[id]) { d.setText(ZTN.DIALOGS[id]); d.save() } ok++ } catch (e) { fail.push('dialog ' + id + ': ' + e) }
  })
  try { var q = api.getQuests().get(ZTN.QUEST); if (String(q.getLogText()) !== ZTN.QUEST_TEXT) { q.setLogText(ZTN.QUEST_TEXT); q.save() } ok++ } catch (e) { fail.push('quest: ' + e) }
  console.info('[zone] turned: Pasha text updated (' + ok + ' ok' + (fail.length ? ', failed: ' + fail.join('; ') : '') + ')')
}
function ztnWaypoint(srv) {
  if (typeof ZWP === 'undefined') return
  var st = ztnLoad(srv)
  ZWP.PLACES.turned = { name: ZTN.WAYPOINT.name, at: [st.x, '~', st.z], color: ZTN.WAYPOINT.color }
  var has = false
  ZWP.TRIGGERS.forEach(function (t) { if (t[2] === 'turned') has = true })
  if (!has) ZWP.TRIGGERS.push([ZTN.QUEST, 'active', 'turned'])
}
ServerEvents.tick(function (event) {
  if (++ztnTick % 100 !== 50) return            // every 5 s (offset from the director)
  var srv = event.server
  try { if (!ztnTextDone) { ztnTextDone = true; ztnTexts() } } catch (e) { ztnErr('text', e) }
  try { ztnWaypoint(srv) } catch (e) { ztnErr('waypoint', e) }
  try { ztnStep(srv) } catch (e) { ztnErr('spawn', e) }
})
ServerEvents.customCommand('zone_turned_here', function (event) {
  var p = event.player
  if (!p) return
  var srv = event.server, st = ztnLoad(srv)
  ztnCmd(srv, 'kill @e[type=minecraft:zombie,tag=zone_turned]')
  st.x = Math.floor(p.x); st.z = Math.floor(p.z); st.alive = false; st.next = 0
  ztnSave(srv, st)
  p.tell('[zone] Lost Patrol moved to ' + st.x + ', ' + st.z + '. Players who already got the waypoint can use zone_waypoints_reset.')
})
ServerEvents.customCommand('zone_turned_status', function (event) {
  var p = event.player
  if (!p) return
  var srv = event.server, st = ztnLoad(srv), wait = Math.max(0, Math.round((st.next - Date.now()) / 1000))
  var have = ztnCmd(srv, 'execute in minecraft:overworld if entity @e[type=minecraft:zombie,tag=zone_turned]')
  p.tell('[zone] Lost Patrol at ' + st.x + ', ' + st.z + ': ' + have + ' loaded' + (wait ? ', back in ' + wait + ' s' : '') +
    ', you ' + (ztnWanted(p) ? 'have' : "don't have") + ' quest ' + ZTN.QUEST + '.')
})

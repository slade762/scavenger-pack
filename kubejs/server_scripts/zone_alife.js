// ============================================================================
// Zone A-Life (Slade) - v1
// The Zone keeps living when nobody is watching.
//  - Smart terrains: named points (bases, camps, lairs, the city). Add your own in game: /alife poi add <name> <type>
//  - Squads: scavenger groups, bandit gangs and mutant packs. They live as data, pick destinations and travel
//    between smart terrains, rest there, and meet each other on the way.
//  - Off-screen: when two hostile squads meet far from players, the fight is resolved by numbers + luck.
//  - On-screen: within ~96 blocks of a player a squad becomes real NPCs/mutants, mid-journey. They keep walking
//    to where they were going, fight what they meet, and turn back into data when everyone leaves.
//  - PDA: fights, wipe-outs and big movements are reported to everyone ("[PDA] ...").
// Commands (op): /alife status | /alife poi list | /alife poi add <name> <type> | /alife poi remove <name>
//                /alife reset | /alife news on|off
// POI types: scav (scavenger base), bandit (bandit base), camp (anyone), lair (mutants), city (mutants + brave)
// (KubeJS shares one scope between scripts: everything here is var + zal names on purpose.)
// ============================================================================

var ZAL = {
  STEP: 100,                 // simulation step, ticks (5 s)
  SPEED: 1.1,                // off-screen travel speed, blocks per second
  SHOW: 96,                  // a squad becomes real within this many blocks of a player...
  HIDE: 128,                 // ...and goes back to data beyond this (must be inside the loaded area)
  MIN_SPAWN: 26,             // never pop in closer than this to a player
  MEET: 40,                  // off-screen squads this close to each other meet
  REST_MIN: [3, 8],          // minutes resting at a destination
  RESPAWN_MIN: 12,           // minutes between new squads appearing at a faction's base (if below its cap)
  NEWS_GAP_SEC: 90,          // at most one PDA message this often (except wipe-outs)
  FACTIONS: {
    scav:   { cap: 3, size: [2, 4], power: 1.0, name: 'Scavengers', one: 'scavenger group' },
    bandit: { cap: 3, size: [3, 4], power: 1.2, name: 'Bandits',    one: 'bandit gang' },
    mutant: { cap: 3, size: [1, 3], power: 1.0, name: 'Mutants',    one: 'mutant pack' }
  },
  // where each faction likes to go (POI type -> weight)
  LIKES: {
    scav:   { camp: 5, city: 2, scav: 2 },
    bandit: { camp: 6, city: 1, bandit: 3 },
    mutant: { lair: 6, camp: 2, city: 4 }
  },
  HOSTILE: { scav: { bandit: 1, mutant: 1 }, bandit: { scav: 1, mutant: 1 }, mutant: { scav: 1, bandit: 1 } },
  // mutant pack kinds: [entity, weight, min, max, power each]
  MUTANTS: [
    ['itz:boar', 30, 2, 4, 0.8], ['itz:psydog', 25, 2, 4, 0.9], ['itz:snork', 25, 1, 3, 1.1],
    ['itz:bloodsucker', 12, 1, 1, 3.0], ['itz:armored_elk', 8, 1, 2, 1.5]
  ],
  CITY_MUTANTS: [['itz:chimera', 1, 1, 1, 4.0]],
  NO_MUTANTS: [{ x: -1233, z: 22, r: 130 }, { x: -1524, z: 94, r: 160 }],   // mutant packs never show up around the bandit Town or the Bar
  BANDIT_SIGHT: 36,          // A-Life bandits open fire on players they can see this close
  // starting smart terrains (bunker/town/city from the map; the rest are wilderness camps and lairs)
  POIS: [
    { name: 'The Bar',       type: 'scav',   x: -1514, z: 94 },
    { name: 'Town',          type: 'bandit', x: -1233, z: 22 },
    { name: 'City West',     type: 'city',   x: -150,  z: 40 },
    { name: 'City East',     type: 'city',   x: 450,   z: 60 },
    // built locations (zone_pois.js builds them in the world)
    { name: 'Checkpoint 4',    type: 'camp', x: -1060, z: 70 },
    { name: 'Pumping Station', type: 'camp', x: -890,  z: 260 },
    { name: 'Kovalenko Farm',  type: 'camp', x: -760,  z: -200 },
    { name: 'Mi-8 Crash Site', type: 'camp', x: -620,  z: 330 },
    { name: 'Radio Mast',      type: 'camp', x: -520,  z: -60 },
    { name: 'Bone Hollow',     type: 'lair', x: -960,  z: -330 },
    { name: 'Dead Orchard',    type: 'lair', x: -470,  z: 560 },
    // unbuilt wild spots further out
    { name: 'Old Quarry',      type: 'lair', x: -450,  z: -700 },
    { name: 'Lake Shore',      type: 'camp', x: -1380, z: 260 }
  ]
}

var zalState = null       // { pois:[], squads:[], next:int, news:bool }
var zalTick = 0
var zalWarned = false
var zalLastNews = 0
var zalLastRespawn = {}

// ---------- helpers ----------
function zalCall(o, names, a, b) {
  for (var i = 0; i < names.length; i++) {
    var f = o[names[i]]
    if (typeof f === 'function') return a === undefined ? f.call(o) : (b === undefined ? f.call(o, a) : f.call(o, a, b))
  }
  return undefined
}
function zalRand(a, b) { return a + Math.random() * (b - a) }
function zalRandInt(a, b) { return Math.floor(zalRand(a, b + 1)) }
function zalDist(ax, az, bx, bz) { return Math.sqrt((ax - bx) * (ax - bx) + (az - bz) * (az - bz)) }
function zalPick(weights) {   // weights: [[item, w], ...]
  var t = 0; weights.forEach(function (w) { t += w[1] })
  var r = Math.random() * t
  for (var i = 0; i < weights.length; i++) { r -= weights[i][1]; if (r <= 0) return weights[i][0] }
  return weights[weights.length - 1][0]
}

// ---------- persistence ----------
function zalSave(server) {
  try { zalCall(server.persistentData, ['putString', 'm_128359_'], 'zone_alife', JSON.stringify(zalState)) } catch (e) {}
}
function zalLoad(server) {
  var raw = ''
  try { raw = String(zalCall(server.persistentData, ['getString', 'm_128461_'], 'zone_alife') || '') } catch (e) {}
  if (raw) raw = raw.split('"Bunker"').join('"The Bar"')   // renamed: the Bunker is the Bar now
  if (raw) { try { zalState = JSON.parse(raw) } catch (e) { zalState = null } }
  if (!zalState || !zalState.pois) {
    zalState = { pois: JSON.parse(JSON.stringify(ZAL.POIS)), squads: [], next: 1, news: true }
    // a starting population
    Object.keys(ZAL.FACTIONS).forEach(function (f) { for (var i = 0; i < ZAL.FACTIONS[f].cap; i++) zalNewSquad(f, true) })
  }
  // v1 -> v2: placeholder wilderness spots replaced by the built locations
  var OLD = ['Crossroads', 'North Ruins', 'South Fields', 'Dead Woods', 'Hollow', 'Riverbed']
  zalState.pois = zalState.pois.filter(function (p) { return OLD.indexOf(p.name) < 0 })
  ZAL.POIS.forEach(function (d) { if (!zalState.pois.some(function (p) { return p.name === d.name })) zalState.pois.push(JSON.parse(JSON.stringify(d))) })
  zalState.squads.forEach(function (s) { s.online = false })   // whatever was out there gets rebuilt
}

// ---------- world model ----------
function zalHome(faction) {
  var type = faction === 'mutant' ? 'lair' : faction
  var homes = zalState.pois.filter(function (p) { return p.type === type })
  if (homes.length === 0) homes = zalState.pois
  return homes[Math.floor(Math.random() * homes.length)]
}
function zalChooseTarget(s) {
  var likes = ZAL.LIKES[s.f], options = []
  zalState.pois.forEach(function (p) {
    var w = likes[p.type] || 0
    if (w <= 0 || p.name === s.at) return
    if (s.f === 'mutant' && (p.type === 'scav' || p.type === 'bandit')) return   // mutants keep away from bases
    if (s.f === 'bandit' && p.type === 'scav') return
    if (s.f === 'scav' && p.type === 'bandit') return
    var d = zalDist(s.x, s.z, p.x, p.z)
    options.push([p, w * (d < 1400 ? 1 : 0.3)])                                     // prefer nearer places
  })
  if (options.length === 0) return null
  return zalPick(options)
}
function zalNewSquad(faction, anywhere) {
  var F = ZAL.FACTIONS[faction]
  var home = anywhere ? zalState.pois[Math.floor(Math.random() * zalState.pois.length)] : zalHome(faction)
  if (anywhere && faction !== 'mutant' && (home.type === 'scav' || home.type === 'bandit') && home.type !== faction) home = zalHome(faction)
  var s = { id: zalState.next++, f: faction, n: zalRandInt(F.size[0], F.size[1]), x: home.x + zalRand(-20, 20), z: home.z + zalRand(-20, 20),
            at: home.name, to: null, rest: zalRandInt(0, 4) * 1200, online: false, kind: null, pw: F.power }
  if (faction === 'mutant') {
    var pool = home.type === 'city' ? ZAL.MUTANTS.concat(ZAL.CITY_MUTANTS) : ZAL.MUTANTS
    var k = zalPick(pool.map(function (m) { return [m, m[1]] }))
    s.kind = k[0]; s.n = zalRandInt(k[2], k[3]); s.pw = k[4]
  }
  zalState.squads.push(s)
  return s
}
function zalPoiNear(x, z) {
  var best = null, bd = 1e9
  zalState.pois.forEach(function (p) { var d = zalDist(x, z, p.x, p.z); if (d < bd) { bd = d; best = p } })
  return best && bd < 260 ? best.name : null
}
function zalWhere(x, z) {
  var p = zalPoiNear(x, z)
  return p ? 'near ' + p : 'in the wilds'
}
function zalLabel(s) {
  if (s.f !== 'mutant') return ZAL.FACTIONS[s.f].one
  var k = String(s.kind).replace('itz:', '').replace('_', ' ')
  return s.n > 1 ? 'pack of ' + k + 's' : k
}

// zone_pois.js: a location got built a little off its planned spot (water, cliffs)
global.zoneAlifeMovePoi = function (name, x, z) {
  if (!zalState) return
  zalState.pois.forEach(function (p) { if (p.name === name) { p.x = x; p.z = z } })
}

// ---------- news ----------
function zalNews(server, msg, urgent) {
  console.info('[alife] ' + msg)
  if (!zalState.news) return
  var now = zalTick
  if (!urgent && now - zalLastNews < ZAL.NEWS_GAP_SEC * 20) return
  zalLastNews = now
  server.players.forEach(function (p) {
    p.tell(Text.of('[PDA] ').color(0x8FB35A).append(Text.of(msg).color(0xB8B8A8)))
  })
  try { server.runCommandSilent('execute as @a at @s run playsound minecraft:block.note_block.bit master @s ~ ~ ~ 0.35 1.6') } catch (e) {}
}

// ---------- off-screen simulation ----------
function zalMoveOffline(s, dtSec) {
  if (s.rest > 0) { s.rest -= ZAL.STEP; return }
  if (!s.to) {
    var t = zalChooseTarget(s)
    if (!t) { s.rest = 2400; return }
    s.to = t.name; s.tx = t.x + zalRand(-25, 25); s.tz = t.z + zalRand(-25, 25)
  }
  var d = zalDist(s.x, s.z, s.tx, s.tz), step = ZAL.SPEED * dtSec
  if (d <= step) {
    s.x = s.tx; s.z = s.tz; s.at = s.to; s.to = null
    s.rest = zalRandInt(ZAL.REST_MIN[0] * 1200, ZAL.REST_MIN[1] * 1200)
    return
  }
  s.x += (s.tx - s.x) / d * step; s.z += (s.tz - s.z) / d * step
}
function zalFightOffline(server, a, b) {
  var pa = a.n * a.pw * zalRand(0.6, 1.4), pb = b.n * b.pw * zalRand(0.6, 1.4)
  var win = pa >= pb ? a : b, lose = win === a ? b : a
  var loss = Math.max(0, Math.ceil(lose.n * zalRand(0.2, 0.6)) - (win.n > lose.n * 2 ? 1 : 0))
  win.n = Math.max(1, win.n - loss)
  lose.n = 0
  var where = zalWhere(a.x, a.z)
  if (win.f === 'mutant') zalNews(server, 'A ' + zalLabel(lose) + ' was torn apart ' + where + '. Avoid the area.', true)
  else if (lose.f === 'mutant') zalNews(server, ZAL.FACTIONS[win.f].name + ' killed a ' + zalLabel(lose) + ' ' + where + '.', false)
  else zalNews(server, ZAL.FACTIONS[win.f].name + ' wiped out a ' + zalLabel(lose) + ' ' + where + '.', true)
}

// ---------- on-screen ----------
function zalTagOf(s) { return 'alife_sq_' + s.id }
function zalSummon(server, s, x, z) {
  var tags = '"alife","' + zalTagOf(s) + '"'
  var cmd
  if (s.f === 'scav') cmd = 'summon tacznpcs:npc ~ ~ ~ {template:"scavengers",CustomName:\'{"text":"Scavenger"}\',PersistenceRequired:1b,Tags:[' + tags + ',"alife_scav"]}'
  else if (s.f === 'bandit') cmd = 'summon tacznpcs:npc ~ ~ ~ {template:"bandits",CustomName:\'{"text":"Bandit"}\',PersistenceRequired:1b,Tags:[' + tags + ',"zone_bandit","alife_bandit"]}'
  else cmd = 'summon ' + s.kind + ' ~ ~ ~ {PersistenceRequired:1b,Tags:[' + tags + ']}'
  for (var i = 0; i < s.n; i++) {
    var ox = x + zalRand(-3, 3), oz = z + zalRand(-3, 3)
    server.runCommandSilent('execute in minecraft:overworld positioned ' + ox.toFixed(1) + ' 0 ' + oz.toFixed(1) +
      ' positioned over motion_blocking_no_leaves run ' + cmd)
  }
}
function zalMembers(level, s, r) {
  var out = [], tag = zalTagOf(s)
  r = r || 160
  level.getEntitiesWithin(AABB.of(s.x - r, -64, s.z - r, s.x + r, 320, s.z + r)).forEach(function (e) {
    var tags = zalCall(e, ['getTags', 'm_19880_'])
    if (tags && tags.contains(tag) && zalCall(e, ['isAlive', 'm_6084_']) !== false) out.push(e)
  })
  return out
}
function zalDiscard(e) { zalCall(e, ['discard', 'm_146870_']) }
function zalNearestPlayer(players, x, z) {
  var bd = 1e9
  players.forEach(function (p) { var d = zalDist(p.x, p.z, x, z); if (d < bd) bd = d })
  return bd
}
function zalMaterialize(server, s, players) {
  var x = s.x, z = s.z
  // don't pop in under someone's nose: push the spawn point away from the closest player
  players.forEach(function (p) {
    var d = zalDist(p.x, p.z, x, z)
    if (d < ZAL.MIN_SPAWN) {
      var ux = d > 0.1 ? (x - p.x) / d : 1, uz = d > 0.1 ? (z - p.z) / d : 0
      x = p.x + ux * ZAL.MIN_SPAWN; z = p.z + uz * ZAL.MIN_SPAWN
    }
  })
  zalSummon(server, s, x, z)
  s.online = true; s.x = x; s.z = z; s.spawnedAt = zalTick; s.seen = false
}
// moveTo(double,double,double,double) needs 4 args
function zalMoveTo(nav, x, y, z, speed) {
  if (typeof nav['m_26519_'] === 'function') return nav['m_26519_'](x, y, z, speed)
  if (typeof nav.moveTo === 'function') return nav.moveTo(x, y, z, speed)
}
function zalBanditEyes(level, s, members, players) {
  members.forEach(function (b) {
    var cur = zalCall(b, ['m_5448_', 'getTarget'])
    if (cur && zalCall(cur, ['isAlive', 'm_6084_']) !== false) return
    var best = null, bd = 1e9
    players.forEach(function (p) {
      if (zalCall(p, ['isCreative', 'm_7500_']) || zalCall(p, ['isSpectator', 'm_5833_'])) return
      var d = zalCall(b, ['m_20270_', 'distanceTo'], p)
      if (d < ZAL.BANDIT_SIGHT && d < bd && zalCall(b, ['m_142582_', 'hasLineOfSight'], p) === true) { best = p; bd = d }
    })
    if (best) members.forEach(function (o) { if (!zalCall(o, ['m_5448_', 'getTarget'])) zalCall(o, ['m_6710_', 'setTarget'], best) })
  })
}

// ---------- main step ----------
function zalStep(server) {
  var level = server.getLevel('minecraft:overworld')
  var players = []
  server.players.forEach(function (p) { if (String(p.level.dimension).indexOf('overworld') >= 0) players.push(p) })
  var dt = ZAL.STEP / 20

  // stray A-Life entities whose squad is off-screen or gone (e.g. saved in a chunk last session)
  var online = {}
  zalState.squads.forEach(function (s) { if (s.online) online[zalTagOf(s)] = true })
  players.forEach(function (p) {
    level.getEntitiesWithin(AABB.of(p.x - 160, -64, p.z - 160, p.x + 160, 320, p.z + 160)).forEach(function (e) {
      var tags = zalCall(e, ['getTags', 'm_19880_'])
      if (!tags || !tags.contains('alife')) return
      var mine = null
      tags.forEach(function (t) { if (String(t).indexOf('alife_sq_') === 0) mine = String(t) })
      if (!mine || !online[mine]) zalDiscard(e)
    })
  })

  zalState.squads.forEach(function (s) {
    if (s.n <= 0) return
    var near = zalNearestPlayer(players, s.x, s.z)
    if (s.online) {
      var members = zalMembers(level, s)
      if (near > ZAL.HIDE) {                                         // everyone left: back to data
        if (members.length > 0) s.n = members.length
        members.forEach(zalDiscard)
        s.online = false
        return
      }
      if (members.length === 0 && (!s.seen || near > 64)) {
        s.online = false                                             // spawn didn't take / area not loaded: stay as data
        return
      }
      if (members.length === 0) {                                    // all dead, in front of someone
        s.n = 0
        if (s.f !== 'mutant') zalNews(server, 'Lost contact with a ' + zalLabel(s) + ' ' + zalWhere(s.x, s.z) + '.', true)
        return
      }
      s.seen = true
      if (members.length < s.n && s.f !== 'mutant') {
        zalNews(server, ZAL.FACTIONS[s.f].name + ' report casualties ' + zalWhere(s.x, s.z) + '.', false)
      }
      s.n = members.length
      var cx = 0, cz = 0
      members.forEach(function (e) { cx += e.x; cz += e.z })
      s.x = cx / members.length; s.z = cz / members.length
      // still travelling? arrived?
      if (s.rest > 0) s.rest -= ZAL.STEP
      else if (!s.to) { var t = zalChooseTarget(s); if (t) { s.to = t.name; s.tx = t.x + zalRand(-25, 25); s.tz = t.z + zalRand(-25, 25) } }
      else if (zalDist(s.x, s.z, s.tx, s.tz) < 12) { s.at = s.to; s.to = null; s.rest = zalRandInt(ZAL.REST_MIN[0] * 1200, ZAL.REST_MIN[1] * 1200) }
      if (s.to && s.rest <= 0) members.forEach(function (e) {
        if (zalCall(e, ['m_5448_', 'getTarget'])) return
        var d = Math.max(0.1, zalDist(e.x, e.z, s.tx, s.tz)), st = Math.min(20, d)
        var nav = zalCall(e, ['m_21573_', 'getNavigation'])
        if (nav) zalMoveTo(nav, e.x + (s.tx - e.x) / d * st, e.y, e.z + (s.tz - e.z) / d * st, s.f === 'mutant' ? 1.0 : 0.65)
      })
      if (s.f === 'bandit') zalBanditEyes(level, s, members, players)
      return
    }
    // off-screen
    zalMoveOffline(s, dt)
    if (near < ZAL.SHOW && !(s.f === 'mutant' && ZAL.NO_MUTANTS.some(function (q) { return Math.hypot(s.x - q.x, s.z - q.z) < q.r }))) zalMaterialize(server, s, players)
  })

  // off-screen encounters
  var off = zalState.squads.filter(function (s) { return !s.online && s.n > 0 })
  for (var i = 0; i < off.length; i++) for (var j = i + 1; j < off.length; j++) {
    var a = off[i], b = off[j]
    if (a.n <= 0 || b.n <= 0 || !ZAL.HOSTILE[a.f][b.f]) continue
    if (zalDist(a.x, a.z, b.x, b.z) > ZAL.MEET) continue
    if (zalNearestPlayer(players, a.x, a.z) < ZAL.HIDE) continue      // too close to players: let it happen for real
    zalFightOffline(server, a, b)
  }

  // the dead are gone; bases send out fresh squads now and then
  zalState.squads = zalState.squads.filter(function (s) { return s.n > 0 })
  Object.keys(ZAL.FACTIONS).forEach(function (f) {
    var have = zalState.squads.filter(function (s) { return s.f === f }).length
    var last = zalLastRespawn[f] || 0
    if (have < ZAL.FACTIONS[f].cap && zalTick - last > ZAL.RESPAWN_MIN * 1200) {
      zalLastRespawn[f] = zalTick
      var s = zalNewSquad(f, false)
      if (f !== 'mutant' && Math.random() < 0.5) zalNews(server, 'A new ' + zalLabel(s) + ' set out from the ' + s.at + '.', false)
    }
  })
  zalSave(server)
}

ServerEvents.tick(function (event) {
  zalTick++
  if (zalTick % ZAL.STEP !== 0) return
  var server = event.server
  try {
    if (!zalState) zalLoad(server)
    zalStep(server)
  } catch (err) {
    if (!zalWarned) { zalWarned = true; console.error('[alife] step failed: ' + err) }
  }
})

// ---------- commands ----------
ServerEvents.commandRegistry(function (event) {
  var C = event.commands, A = event.arguments
  function ok(ctx, msg) {
    var src = ctx.source
    String(msg).split('\n').forEach(function (line) {
      var c = Text.of(line).color(0xB8B8A8)
      if (typeof src.sendSystemMessage === 'function') src.sendSystemMessage(c); else src.m_243053_(c)
    })
    return 1
  }
  function needState(ctx) { if (!zalState) zalLoad(ctx.source.server) }
  event.register(C.literal('alife').requires(function (s) { return s.hasPermission(2) })
    .then(C.literal('status').executes(function (ctx) {
      needState(ctx)
      var lines = ['A-Life: ' + zalState.squads.length + ' squads, ' + zalState.pois.length + ' smart terrains']
      zalState.squads.forEach(function (s) {
        lines.push(' #' + s.id + ' ' + zalLabel(s) + ' x' + s.n + ' at ' + Math.round(s.x) + ',' + Math.round(s.z) +
          (s.online ? ' [ON SCREEN]' : '') + (s.to ? ' -> ' + s.to : (s.rest > 0 ? ' resting at ' + s.at : '')))
      })
      return ok(ctx, lines.join('\n'))
    }))
    .then(C.literal('poi')
      .then(C.literal('list').executes(function (ctx) {
        needState(ctx)
        return ok(ctx, zalState.pois.map(function (p) { return p.name + ' (' + p.type + ') ' + p.x + ',' + p.z }).join('\n'))
      }))
      .then(C.literal('add').then(C.argument('name', A.STRING.create(event)).then(C.argument('type', A.STRING.create(event)).executes(function (ctx) {
        needState(ctx)
        var name = String(A.STRING.getResult(ctx, 'name')), type = String(A.STRING.getResult(ctx, 'type'))
        if (['scav', 'bandit', 'camp', 'lair', 'city'].indexOf(type) < 0) return ok(ctx, 'Type must be scav, bandit, camp, lair or city')
        var pos = zalCall(ctx.source, ['getPosition', 'm_81371_'])
        zalState.pois = zalState.pois.filter(function (p) { return p.name !== name })
        zalState.pois.push({ name: name, type: type, x: Math.round(pos.x()), z: Math.round(pos.z()) })
        zalSave(ctx.source.server)
        return ok(ctx, 'Smart terrain "' + name + '" (' + type + ') added here.')
      }))))
      .then(C.literal('remove').then(C.argument('name', A.STRING.create(event)).executes(function (ctx) {
        needState(ctx)
        var name = String(A.STRING.getResult(ctx, 'name')), before = zalState.pois.length
        zalState.pois = zalState.pois.filter(function (p) { return p.name !== name })
        zalSave(ctx.source.server)
        return ok(ctx, before === zalState.pois.length ? 'No smart terrain called "' + name + '"' : 'Removed "' + name + '".')
      }))))
    .then(C.literal('reset').executes(function (ctx) {
      zalState = null
      zalCall(ctx.source.server.persistentData, ['remove', 'm_128473_'], 'zone_alife')
      ctx.source.server.runCommandSilent('kill @e[tag=alife]')
      zalLoad(ctx.source.server); zalSave(ctx.source.server)
      return ok(ctx, 'A-Life reset: fresh squads at the starting smart terrains (your custom ones were cleared).')
    }))
    .then(C.literal('news')
      .then(C.literal('on').executes(function (ctx) { needState(ctx); zalState.news = true; zalSave(ctx.source.server); return ok(ctx, 'PDA news on.') }))
      .then(C.literal('off').executes(function (ctx) { needState(ctx); zalState.news = false; zalSave(ctx.source.server); return ok(ctx, 'PDA news off.') })))
  )
})

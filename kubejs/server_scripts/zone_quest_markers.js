// Quest markers + POI discovery (Slade, zone_tactical_anims 0.77).
//
//  1. Quest markers: every active Custom NPCs quest shows the amber diamond + distance on screen (same as PDA job
//     points). While the quest's goal isn't done, it points at the place to go (QUESTS[id].go); once the goal is done
//     (kills counted, items in your bag), or for "bring me" quests with no place, it points at whoever takes it in
//     (QUESTS[id].back). NPCs are found live when their chunk is loaded, else their home spot is used.
//     This replaces the old Xaero chat waypoints (zone_story / zone_a_firstday / zone_poppy / zone_scorcher skip
//     theirs while global.zoneQuestMarkers is true).
//  2. POI discovery: the first time a player walks into one of our places, it's added to their Xaero map
//     (gold waypoint, saved by their client). Already-there waypoints with the same name aren't doubled.
//
// 0.78: one marker per quest with its height and quest id/name; players pick which to show (J / Shift+J).
// Needs zone_tactical_anims 0.78+ for that format (0.77 would read the extra fields as part of the label).
// Needs zone_tactical_anims 0.77+. With an older jar this script does nothing and the old chat waypoints stay on.
// Op commands:
//   /kubejs custom_command zone_markers_status    your active quests and where their markers point
//   /kubejs custom_command zone_markers_refresh   resend markers to everyone
//   /kubejs custom_command zone_poi_rediscover    forget which places you found (they're re-added as you walk in)
var ZQM = {
  PERIOD: 40,               // ticks between marker updates (2 s)
  DISCOVER: 26,             // walk this close (horizontally) to a place's centre to discover it
  // named places: at [x, z] (fallback), poi = zone_pois.js id (its built centre wins), npc = live Custom NPC by name
  PLACES: {
    bar:        { label: 'The Bar', at: [-1530, 95] },
    moe:        { label: 'Old Moe', npc: 'Old Moe', at: [-1527, 89] },
    pasha:      { label: 'Pasha', npc: 'Pasha', at: [-1530, 95] },
    yarik:      { label: 'Yarik', npc: 'Yarik', at: [-1530, 95] },
    ilya:       { label: 'Doc Ilya', npc: 'Doc Ilya', at: [-1530, 95] },
    fedya:      { label: 'Fedya', npc: 'Fedya', at: [-1530, 95] },
    range:      { label: 'Firing Range', fd: 'range', at: [-1530, 95] },
    crate:      { label: 'Ammo crate', crate: true, at: [-1527, 89] },
    barrel:     { label: 'Sell barrel', at: [-1527, 89] },
    lostpatrol: { label: 'Lost Patrol', turned: true, at: [-1310, 291] },   // follows the patrol itself (zone_spawn_director.js)
    oldtown:    { label: 'Old Town', at: [-1233, 22] },
    kravets:    { label: 'Major Kravets', npc: 'Major Kravets', at: [-271, 315] },
    eliwood:    { label: 'Eliwood', npc: 'Eliwood', at: [-1488, -140] },
    rusak:      { label: 'Rusak', npc: 'Forgemaster Rusak', at: [264, -499] },
    hrytsenko:  { label: 'Sgt Hrytsenko', npc: 'Sergeant Hrytsenko', poi: 'checkpoint', at: [-1060, 70] },
    kostya:     { label: 'Kostya', npc: 'Kostya', poi: 'pumping', at: [-890, 260] },
    nadya:      { label: 'Baba Nadya', npc: 'Baba Nadya', poi: 'farm', at: [-760, -200] },
    lev:        { label: 'Lev', npc: 'Lev', poi: 'mast', at: [-520, -60] },
    sparrow:    { label: 'Sparrow', npc: 'Sparrow', poi: 'orchard', at: [-470, 560] },
    olya:       { label: 'Olya', npc: 'Olya', poi: 'kindergarten', at: [-700, 120] },
    pumping:    { label: 'Pumping Station', poi: 'pumping', at: [-890, 260] },
    farm:       { label: 'Kovalenko Farm', poi: 'farm', at: [-760, -200] },
    heli:       { label: 'Mi-8 Crash Site', poi: 'heli', at: [-620, 330] },
    orchard:    { label: 'Dead Orchard', poi: 'orchard', at: [-470, 560] },
    culverts:   { label: 'The Culverts', poi: 'culverts', at: [-1640, 330] },
    tunnels:    { label: 'The Tunnels', poi: 'tunnels', at: [-1760, -100] },
    crater:     { label: 'Psi crater', at: [-520, -60] },
    scorcher:   { label: 'The Scorcher', scorcher: true, at: [-540, -330] },
    poppy:      { label: 'Poppy Field', poi: 'poppy', at: [-480, 170] }
  },
  // quest id -> go (place while the goal is open), back (who takes it in). Quests not listed get no marker.
  QUESTS: {
    1:   { go: 'oldtown', back: 'moe' },       2:  { go: 'oldtown', back: 'moe' },
    9:   { go: 'moe' },                        10: { go: 'pasha' },
    11:  { go: 'lostpatrol', back: 'pasha' },  12: { back: 'pasha' },
    13:  { go: 'yarik' },
    14:  { go: 'range' },  15: { go: 'range' },  16: { go: 'crate' },  17: { go: 'barrel' },  18: { go: 'pasha' },
    20:  { go: 'culverts', back: 'yarik' },    21: { go: 'tunnels', back: 'yarik' },
    22:  { go: 'kravets' },  23: { go: 'eliwood' },  24: { go: 'rusak' },
    30:  { back: 'ilya' },  31: { back: 'ilya' },  32: { back: 'fedya' },  33: { back: 'fedya' },
    40:  { back: 'kravets' },  41: { back: 'kravets' },
    50:  { go: 'oldtown', back: 'eliwood' },   51: { back: 'eliwood' },   52: { go: 'oldtown', back: 'eliwood' },
    60:  { back: 'rusak' },  61: { back: 'rusak' },  62: { back: 'rusak' },  63: { back: 'rusak' },
    64:  { go: 'tunnels', back: 'rusak' },     65: { go: 'culverts', back: 'rusak' },
    66:  { back: 'rusak' },  67: { back: 'rusak' },
    100: { go: 'hrytsenko' },                  101: { back: 'hrytsenko' },
    102: { go: 'heli', back: 'fedya' },        103: { back: 'fedya' },
    104: { back: 'lev' },  105: { back: 'lev' },  106: { go: 'lev' },
    107: { go: 'orchard', back: 'sparrow' },   108: { go: 'yarik' },
    120: { back: 'nadya' },                    121: { go: 'farm', back: 'nadya' },
    130: { go: 'pumping', back: 'kostya' },    131: { back: 'kostya' },
    150: { back: 'lev' },  151: { go: 'crater', back: 'lev' },  152: { go: 'scorcher' },  153: { go: 'scorcher', back: 'lev' },
    270: { go: 'poppy' },  271: { go: 'poppy' },  272: { go: 'olya' }
  },
  // places that go on your map when you first walk in (zone_pois.js LIST is added on top, with its built spots)
  DISCOVER_EXTRA: [
    { name: 'The Bar', x: -1530, y: 83, z: 95 },
    { name: 'Mountainview Chalet', x: -1488, y: 111, z: -140 },
    { name: 'Military Base', x: -271, y: 66, z: 315 },
    { name: 'The Armoury', x: 259, y: 71, z: -503 },
    { name: 'Old Town', x: -1233, y: 0, z: 22 },
    { name: 'The Scorcher', x: -540, y: 121, z: -330, scorcher: true, r: 90 }
  ]
}
var zqmTick = 0, zqmWarned = {}, zqmApi = null, zqmQM = null
try {
  zqmQM = Java.loadClass('com.slade.zonetactical.quest.QuestMarkers')
  global.zoneQuestMarkers = true
} catch (e) {
  global.zoneQuestMarkers = false
  console.warn('[zone] quest markers: zone_tactical_anims is older than 0.77, keeping the old chat waypoints')
}

function zqmErr(where, e) { if (!zqmWarned[where]) { zqmWarned[where] = true; console.error('[zone] quest markers ' + where + ' failed: ' + e) } }
function zqmIP(p) { if (!zqmApi) zqmApi = Java.loadClass('noppes.npcs.api.NpcAPI').Instance(); return zqmApi.getIEntity(p) }
function zqmJson(srv, key) { try { var s = String(srv.persistentData.getString(key) || ''); return s ? JSON.parse(s) : null } catch (e) { return null } }
function zqmBuilt(srv, poi) {
  var st = zqmJson(srv, 'zone_pois')
  var b = st && st.built ? st.built[poi] : null
  return b ? [Math.floor(b.x), Math.floor(b.z), Math.floor(b.y || 0)] : null
}
function zqmScorcher(srv) {
  var c = zqmJson(srv, 'zone_scorcher')
  return c && c.x !== undefined ? [Math.floor(c.x), Math.floor(c.z)] : [-540, -330]
}
function zqmCrate(srv) {
  try {
    var tag = srv.persistentData.getCompound('zone_ammo_crates')
    var ks = typeof tag.getAllKeys === 'function' ? tag.getAllKeys() : tag['m_128431_']()
    var keys = ks.toArray()
    if (keys.length) { var f = String(keys[0]).split(','); return [Number(f[0]), Number(f[2])] }
  } catch (e) {}
  return null
}
// live Custom NPC positions by name (one pass over the overworld's loaded entities)
function zqmNpcs(srv) {
  var out = {}
  try {
    srv.overworld().getEntities().forEach(function (e) {
      try {
        if (String(e.type) !== 'customnpcs:customnpc') return
        var n = String(e.getName().getString())
        if (!out[n]) out[n] = [Math.floor(e.x), Math.floor(e.z), Math.floor(e.y) + 2]   // 0.78: y = just above the head
      } catch (err) {}
    })
  } catch (e) { zqmErr('npc scan', e) }
  return out
}
// 0.78: marker heights. Ground height from the server when the chunk is loaded, remembered (and saved) for later.
var zqmHT = null, zqmGroundCache = null, zqmGroundDirty = false
function zqmGround(srv, x, z) {
  if (!zqmGroundCache) zqmGroundCache = zqmJson(srv, 'zone_marker_y') || {}
  var k = x + ',' + z
  try {
    var lvl = srv.overworld()
    if (lvl.hasChunk(x >> 4, z >> 4)) {
      if (!zqmHT) zqmHT = Java.loadClass('net.minecraft.world.level.levelgen.Heightmap$Types')
      var h = Number(lvl.getHeight(zqmHT.MOTION_BLOCKING_NO_LEAVES, x, z))
      if (h > -60) { if (zqmGroundCache[k] !== h) { zqmGroundCache[k] = h; zqmGroundDirty = true } return h + 1 }
    }
  } catch (e) { zqmErr('ground', e) }
  return zqmGroundCache[k] !== undefined ? zqmGroundCache[k] + 1 : ''
}
function zqmWithY(srv, at, y) {
  if (!at) return null
  var yy = (y !== undefined && y !== null && y !== '' && !isNaN(y)) ? y : (at.length > 2 ? at[2] : '')
  if (yy === '' || yy === undefined) yy = zqmGround(srv, Math.floor(at[0]), Math.floor(at[1]))
  return [Math.floor(at[0]), Math.floor(at[1]), yy]
}
function zqmWhere(srv, key, npcs) {
  var at = zqmWhere0(srv, key, npcs)
  return zqmWithY(srv, at)
}
function zqmWhere0(srv, key, npcs) {
  var pl = ZQM.PLACES[key]
  if (!pl) return null
  if (pl.npc && npcs[pl.npc]) return npcs[pl.npc]
  if (pl.fd) { var f = zqmJson(srv, 'zone_fd_' + pl.fd); if (f) return f.y !== undefined ? [Math.floor(f.x), Math.floor(f.z), Math.floor(f.y) + 1] : [Math.floor(f.x), Math.floor(f.z)] }
  if (pl.crate) { var c = zqmCrate(srv); if (c) return c }
  if (pl.scorcher) return zqmScorcher(srv)
  if (pl.turned && typeof global.zoneTurnedWhere === 'function') { try { return global.zoneTurnedWhere(srv) } catch (e) {} }
  if (pl.poi) { var b = zqmBuilt(srv, pl.poi); if (b) return [b[0], b[1]] }
  return pl.at.slice(0, 2)
}
function zqmClean(s) { return String(s).replace(/[;,]/g, ' ') }
// is the quest's goal done? (kills counted / items carried / dialog read)
function zqmGoalDone(q, ip) {
  try {
    var objs = q.getObjectives(ip)
    if (!objs || objs.length === 0) return false
    for (var i = 0; i < objs.length; i++) if (!objs[i].isCompleted()) return false
    return true
  } catch (e) { return false }
}
// 0.78: one marker per quest: "x,z,place,y,questId,questName" (the client picks which quests to show)
function zqmSpecFor(srv, p, npcs) {
  var ip = zqmIP(p), parts = []
  var qs = ip.getActiveQuests()
  for (var i = 0; i < qs.length && parts.length < 24; i++) {
    var q = qs[i], def = ZQM.QUESTS[q.getId()]
    if (!def) continue
    var key = (!def.go || (def.back && zqmGoalDone(q, ip))) ? (def.back || def.go) : def.go
    if (!key) continue
    var at = zqmWhere(srv, key, npcs)
    if (!at) continue
    var qn = ''
    try { qn = zqmClean(q.getName()) } catch (e) {}
    parts.push(at[0] + ',' + at[1] + ',' + zqmClean(ZQM.PLACES[key].label) + ',' + at[2] + ',' + q.getId() + ',' + qn)
  }
  return parts.join(';')
}
function zqmUpdate(srv) {
  if (!zqmQM) return
  var npcs = null
  srv.players.forEach(function (p) {
    try {
      if (String(p.level.dimension).indexOf('overworld') < 0) { zqmQM.clear(p); return }
      if (!npcs) npcs = zqmNpcs(srv)
      zqmQM.set(p, zqmSpecFor(srv, p, npcs))
    } catch (e) { zqmErr('update', e) }
  })
  if (zqmGroundDirty) { zqmGroundDirty = false; try { srv.persistentData.putString('zone_marker_y', JSON.stringify(zqmGroundCache)) } catch (e) {} }
}

// ---------------------------------------------------------------- POI discovery
function zqmDiscoverList(srv) {
  var out = []
  if (typeof ZPOI !== 'undefined' && ZPOI.LIST) {
    ZPOI.LIST.forEach(function (d) {
      var b = zqmBuilt(srv, d.id)
      if (!b) return                                // not built yet: nothing to find there
      out.push({ name: d.name, x: b[0], y: b[2], z: b[1], r: Math.max(ZQM.DISCOVER, Math.max(d.sx, d.sz)) })
    })
  }
  ZQM.DISCOVER_EXTRA.forEach(function (d) {
    var x = d.x, z = d.z
    if (d.scorcher) { var c = zqmScorcher(srv); x = c[0]; z = c[1] }
    out.push({ name: d.name, x: x, y: d.y, z: z, r: d.r || ZQM.DISCOVER })
  })
  return out
}
function zqmDiscover(srv) {
  if (!zqmQM) return
  var list = null
  srv.players.forEach(function (p) {
    try {
      if (String(p.level.dimension).indexOf('overworld') < 0) return
      if (!list) list = zqmDiscoverList(srv)
      var pd = p.persistentData, found
      try { found = JSON.parse(String(pd.getString('zone_poi_found') || '{}')) } catch (e) { found = {} }
      var changed = false
      list.forEach(function (d) {
        if (found[d.name]) return
        if (Math.hypot(p.x - d.x, p.z - d.z) > d.r) return
        var y = d.y > 0 ? d.y : Math.floor(p.y)
        zqmQM.discover(p, d.name, Math.floor(d.x), y, Math.floor(d.z))
        found[d.name] = true; changed = true
      })
      if (changed) pd.putString('zone_poi_found', JSON.stringify(found))
    } catch (e) { zqmErr('discover', e) }
  })
}

ServerEvents.tick(function (event) {
  zqmTick++
  if (!zqmQM) return
  if (zqmTick % ZQM.PERIOD === 0) { try { zqmUpdate(event.server) } catch (e) { zqmErr('tick', e) } }
  if (zqmTick % ZQM.PERIOD === 20) { try { zqmDiscover(event.server) } catch (e) { zqmErr('discover tick', e) } }
})
// markers are only kept in memory: send them again right after joining / respawning
PlayerEvents.loggedIn(function (event) {
  if (!zqmQM) return
  event.server.scheduleInTicks(60, function () { try { zqmQM.resend(event.player) } catch (e) {} })
})
PlayerEvents.respawned(function (event) {
  if (!zqmQM) return
  try { zqmQM.resend(event.player) } catch (e) {}
})

// ---------------------------------------------------------------- op commands
ServerEvents.customCommand('zone_markers_status', function (event) {
  var p = event.player
  if (!p) return
  if (!zqmQM) { p.tell('Quest markers are off: the server has zone_tactical_anims older than 0.77.'); return }
  var ip = zqmIP(p), qs = ip.getActiveQuests(), lines = []
  for (var i = 0; i < qs.length; i++) {
    var q = qs[i], def = ZQM.QUESTS[q.getId()]
    lines.push(q.getId() + ' ' + q.getName() + (def ? ' [' + (def.go || '-') + ' / ' + (def.back || '-') + (zqmGoalDone(q, ip) ? ', goal done' : '') + ']' : ' [no marker]'))
  }
  p.tell('Active: ' + (lines.join(' | ') || 'none'))
  p.tell('Markers: ' + (String(zqmQM.get(p)) || 'none'))
})
ServerEvents.customCommand('zone_markers_refresh', function (event) {
  if (!zqmQM) return
  event.server.players.forEach(function (p) { zqmQM.clear(p) })
  zqmUpdate(event.server)
  if (event.player) event.player.tell('Quest markers resent.')
})
ServerEvents.customCommand('zone_poi_rediscover', function (event) {
  if (!event.player) return
  event.player.persistentData.putString('zone_poi_found', '{}')
  event.player.tell('Places forgotten: they go back on your map as you walk into them.')
})

// Zone lairs (Slade): places where a mutant always lives, for Yarik's hunting jobs.
//  - The Culverts (south-west of the Bar): a Snork nest in the storm drain. 3-4 Snorks, back 5 min after they're cleared.
//  - The Tunnels (north-west of the Bar): one Bloodsucker in the nest under the blockhouse, back 20 min after it dies.
// The locations themselves are in zone_pois.js; this script builds them straight away (instead of waiting for
// someone to walk past), marks them on players' maps when they take Yarik's quests, and points Yarik's lines at them.
// It also clears out "miner" zombies (Enhanced AI's digging zombies are switched off in enhancedai/common.toml).
// Op: /kubejs custom_command zone_lairs_status
// (KubeJS shares one scope between scripts: everything here is var + zlr names on purpose.)
var ZLR = {
  ACTIVE: 72,              // spawn only while a player is this close to the lair (its chunks are loaded then)
  LAIRS: [
    { poi: 'culverts', mob: 'itz:snork', size: [3, 4], cooldownMin: 5,
      spots: [[16, 1, 7], [18, 1, 7], [17, 1, 6], [19, 1, 8], [14, 1, 7]] },        // inside the pipe (template coords)
    { poi: 'tunnels', mob: 'itz:bloodsucker', size: [1, 1], cooldownMin: 20,
      spots: [[2, 3, 10]] }                                                           // the nest chamber
  ],
  WAYPOINTS: {
    culverts: { name: 'The Culverts', poi: 'culverts', at: [-1640, '~', 330], color: 4, quest: 20 },
    tunnels:  { name: 'The Tunnels',  poi: 'tunnels',  at: [-1760, '~', -100], color: 8, quest: 21 }
  },
  // Yarik's dialogs (Bar) and quests: text pointing to the new places
  DIALOGS: {
    43: "Snorks. Twisted things, they crawl on all fours and hunt in packs. They've nested in the Culverts, the old storm drain " +
        "under the road south-west of here. Kill five and I'll pay you. They'll be back tomorrow, so will the job.",
    44: "Aim for the head. They don't stay down otherwise. I've marked the Culverts on your map. They sleep inside the pipe.",
    45: "One. Something in the Tunnels is taking my people. Old service tunnels north-west of here, the way down is through a concrete " +
        "blockhouse. They come back pale, no blood in them, babbling about a shadow. Bloodsucker. You see it only when it wants you to. " +
        "Kill it and you'll never pay for a drink here again.",
    46: "Listen for the breathing. Then shoot where the breathing is. The blockhouse is on your map. Its nest is at the far end, past the stairs."
  },
  QUESTS: {
    20: "Snorks have nested in the Culverts, the old storm drain south-west of the Bar, and keep cornering scavengers. " +
        "Yarik wants their numbers down. Kill 5 Snorks there, then return to Yarik. He has this job every day.",
    21: "Two scavengers went down into the Tunnels, the old service tunnels north-west of the Bar, and came back drained white. " +
        "Yarik believes it is a Bloodsucker nesting at the far end. Go down through the blockhouse, kill it and return to Yarik."
  }
}
var zlrTick = 0, zlrWarned = {}, zlrTextDone = false, zlrBuildTries = {}, zlrForced = {}

function zlrErr(where, e) { if (!zlrWarned[where]) { zlrWarned[where] = true; console.error('[zone] lairs ' + where + ' failed: ' + e) } }
function zlrCmd(srv, c) { return Number(srv.runCommandSilent(String(c))) || 0 }
function zlrOW(c) { return 'execute in minecraft:overworld run ' + c }
function zlrState(srv) {
  try { var raw = String(srv.persistentData.getString('zone_lairs') || ''); return raw ? JSON.parse(raw) : {} } catch (e) { return {} }
}
function zlrSave(srv, st) { srv.persistentData.putString('zone_lairs', JSON.stringify(st)) }
function zlrPoi(id) {
  for (var i = 0; i < ZPOI.LIST.length; i++) if (ZPOI.LIST[i].id === id) return ZPOI.LIST[i]
  return null
}
function zlrBuilt(srv, id) {
  if (!zpoiState) zpoiLoad(srv)
  return zpoiState.built[id] || null
}
// template coords -> world coords for a built location
function zlrWorld(p, b, s) {
  var g = p.g || ZPOI.G
  return [b.x - Math.floor(p.sx / 2) + s[0] + 0.5, b.y - 1 - g + s[1], b.z - Math.floor(p.sz / 2) + s[2] + 0.5]
}

// ---------------------------------------------------------------- build both places now (forceloads the area briefly)
function zlrBuildNow(srv) {
  ['culverts', 'tunnels'].forEach(function (id) {
    if (zlrBuilt(srv, id)) {
      if (zlrForced[id]) { zlrCmd(srv, zlrOW('forceload remove ' + zlrForced[id])); delete zlrForced[id] }
      return
    }
    var p = zlrPoi(id); if (!p) return
    var tries = zlrBuildTries[id] = (zlrBuildTries[id] || 0) + 1
    if (tries > 12) {
      if (zlrForced[id]) { zlrCmd(srv, zlrOW('forceload remove ' + zlrForced[id])); delete zlrForced[id]; console.warn('[zone] lairs: gave up building ' + p.name + ' early; it will build when someone walks past') }
      return
    }
    if (!zlrForced[id]) {
      zlrForced[id] = (p.x - 48) + ' ' + (p.z - 48) + ' ' + (p.x + 48) + ' ' + (p.z + 48)
      zlrCmd(srv, zlrOW('forceload add ' + zlrForced[id]))
      return                                   // give the chunks a moment to load
    }
    if (zpoiBuild(srv, srv.getLevel('minecraft:overworld'), p)) {
      var b = zlrBuilt(srv, id)
      console.info('[zone] lairs: built ' + p.name + ' at ' + b.x + ', ' + b.y + ', ' + b.z)
      zlrCmd(srv, zlrOW('forceload remove ' + zlrForced[id])); delete zlrForced[id]
    }
  })
}

// ---------------------------------------------------------------- the mutants
function zlrLairs(srv) {
  var st = zlrState(srv), now = Date.now(), changed = false
  ZLR.LAIRS.forEach(function (L) {
    var p = zlrPoi(L.poi), b = zlrBuilt(srv, L.poi)
    if (!p || !b) return
    var near = false
    srv.players.forEach(function (pl) {
      if (String(pl.level.dimension).indexOf('overworld') >= 0 && Math.hypot(pl.x - b.x, pl.z - b.z) < ZLR.ACTIVE) near = true
    })
    if (!near) return
    var s = st[L.poi] || (st[L.poi] = { next: 0, alive: false })
    var have = zlrCmd(srv, zlrOW('execute if entity @e[type=' + L.mob + ',tag=zone_lair_' + L.poi + ']'))
    if (have > 0) { if (!s.alive) { s.alive = true; changed = true } return }
    if (s.alive) { s.alive = false; s.next = now + L.cooldownMin * 60000; changed = true; return }   // just cleared
    if (now < s.next) return
    var n = L.size[0] + Math.floor(Math.random() * (L.size[1] - L.size[0] + 1))
    for (var i = 0; i < n; i++) {
      var w = zlrWorld(p, b, L.spots[i % L.spots.length])
      zlrCmd(srv, zlrOW('summon ' + L.mob + ' ' + w[0] + ' ' + w[1] + ' ' + w[2] +
        ' {PersistenceRequired:1b,Tags:["zone_lair","zone_lair_' + L.poi + '"]}'))
    }
    s.alive = true; changed = true
    console.info('[zone] lairs: ' + n + 'x ' + L.mob + ' at ' + p.name)
  })
  if (changed) zlrSave(srv, st)
}

// ---------------------------------------------------------------- waypoints (zone_story.js sends them when the quest is taken)
function zlrWaypoints(srv) {
  if (typeof ZWP === 'undefined') return
  Object.keys(ZLR.WAYPOINTS).forEach(function (k) {
    var w = ZLR.WAYPOINTS[k]
    if (!zlrBuilt(srv, w.poi)) return          // only mark it once it's really there
    if (!ZWP.PLACES[k]) ZWP.PLACES[k] = { name: w.name, poi: w.poi, at: w.at, color: w.color }
    var has = false
    ZWP.TRIGGERS.forEach(function (t) { if (t[2] === k) has = true })
    if (!has) ZWP.TRIGGERS.push([w.quest, 'active', k])
  })
}

// ---------------------------------------------------------------- Yarik's lines
function zlrTexts() {
  var api = Java.loadClass('noppes.npcs.api.NpcAPI').Instance()
  var ok = 0, fail = []
  Object.keys(ZLR.DIALOGS).forEach(function (id) {
    try {
      var d = api.getDialogs().get(Number(id))
      if (String(d.getText()) !== ZLR.DIALOGS[id]) { d.setText(ZLR.DIALOGS[id]); d.save() }
      ok++
    } catch (e) { fail.push('dialog ' + id + ': ' + e) }
  })
  Object.keys(ZLR.QUESTS).forEach(function (id) {
    try {
      var q = api.getQuests().get(Number(id))
      if (String(q.getLogText()) !== ZLR.QUESTS[id]) { q.setLogText(ZLR.QUESTS[id]); q.save() }
      ok++
    } catch (e) { fail.push('quest ' + id + ': ' + e) }
  })
  console.info('[zone] lairs: Yarik text updated (' + ok + ' ok' + (fail.length ? ', failed: ' + fail.join('; ') : '') + ')')
}

// ---------------------------------------------------------------- digging zombies
function zlrMiners(srv) {
  zlrCmd(srv, zlrOW('kill @e[type=!minecraft:player,nbt={HandItems:[{id:"minecraft:stone_pickaxe"}]}]'))
}

ServerEvents.tick(function (event) {
  zlrTick++
  if (zlrTick % 100 !== 0) return            // every 5 s
  var srv = event.server
  if (typeof ZPOI === 'undefined') return
  try { if (!zlrTextDone) { zlrTextDone = true; zlrTexts() } } catch (e) { zlrErr('text', e) }
  try { zlrBuildNow(srv) } catch (e) { zlrErr('build', e) }
  try { zlrWaypoints(srv) } catch (e) { zlrErr('waypoints', e) }
  try { zlrLairs(srv) } catch (e) { zlrErr('spawn', e) }
  try { if (zlrTick % 600 === 0) zlrMiners(srv) } catch (e) { zlrErr('miners', e) }
})

ServerEvents.customCommand('zone_lairs_status', function (event) {
  var srv = event.server, st = zlrState(srv)
  ZLR.LAIRS.forEach(function (L) {
    var b = zlrBuilt(srv, L.poi), s = st[L.poi] || {}
    var wait = s.next ? Math.max(0, Math.round((s.next - Date.now()) / 1000)) : 0
    event.player.tell(L.poi + ': ' + (b ? 'built at ' + b.x + ', ' + b.y + ', ' + b.z : 'not built yet') +
      ', ' + L.mob + (s.alive ? ' alive' : (wait ? ' back in ' + wait + ' s' : ' spawns when you arrive')))
  })
})

// NPC combat awareness (Slade). TaCZ NPCs don't pick their own targets reliably, so this does it:
//  - Scavengers + bunker guard (tags zone_scav / zone_guard): engage mutants, zombies and bandits.
//  - Bandits (tag zone_bandit): engage mutants, zombies and scavengers (players are handled by zone_bandits.js).
// Runs every half second, only around players (where things are loaded).
// (KubeJS shares one scope between scripts: everything here is var + zncXxx names on purpose.)
var ZNC = { RANGE: 34, GUARD_RANGE: 22, GUARD_DY: 4, SCAN: 140 }
var ZNC_MUTANTS = {}
;['itz:boar', 'itz:snork', 'itz:psydog', 'itz:bloodsucker', 'itz:chimera', 'itz:armored_elk', 'minecraft:zombie'].forEach(function (id) { ZNC_MUTANTS[id] = true })
var zncTick = 0
var zncWarned = false

function zncCall(o, names, arg) {
  for (var i = 0; i < names.length; i++) {
    if (typeof o[names[i]] === 'function') return arg === undefined ? o[names[i]]() : o[names[i]](arg)
  }
  return undefined
}
function zncAlive(e) { return e && zncCall(e, ['isAlive', 'm_6084_']) !== false }

ServerEvents.tick(function (event) {
  zncTick++
  if (zncTick % 10 !== 0) return
  var zncServer = event.server
  try {
    var zncLevel = zncServer.getLevel('minecraft:overworld')
    var zncSeen = {}
    var zncNpcs = [], zncThreats = []
    zncServer.players.forEach(function (p) {
      if (String(p.level.dimension).indexOf('overworld') < 0) return
      var rr = ZNC.SCAN
      zncLevel.getEntitiesWithin(AABB.of(p.x - rr, p.y - 64, p.z - rr, p.x + rr, p.y + 64, p.z + rr)).forEach(function (e) {
        var key = String(e.getStringUuid ? e.getStringUuid() : e.toString())
        if (zncSeen[key]) return
        zncSeen[key] = true
        var id = String(e.getEncodeId())
        if (ZNC_MUTANTS[id]) { if (zncAlive(e)) zncThreats.push({ e: e, kind: 'mutant' }); return }
        if (id !== 'tacznpcs:npc') return
        var tags = zncCall(e, ['getTags', 'm_19880_'])
        if (!tags || !zncAlive(e)) return
        if (tags.contains('zone_guard')) { zncNpcs.push({ e: e, side: 'scav', guard: true }); zncThreats.push({ e: e, kind: 'scav' }) }
        else if (tags.contains('zone_scav') || tags.contains('alife_scav')) { zncNpcs.push({ e: e, side: 'scav' }); zncThreats.push({ e: e, kind: 'scav' }) }
        else if (tags.contains('zone_bandit')) { zncNpcs.push({ e: e, side: 'bandit' }); zncThreats.push({ e: e, kind: 'bandit' }) }
      })
    })
    zncNpcs.forEach(function (n) {
      var range = n.guard ? ZNC.GUARD_RANGE : ZNC.RANGE
      // Only things they can actually see (no tracking mobs through floors/walls).
      // Guards also ignore anything well above/below their floor (caves under the bunker).
      var ok = function (t) {
        if (!t || !zncAlive(t)) return false
        if (n.guard && Math.abs(t.y - n.e.y) > ZNC.GUARD_DY) return false
        return zncCall(n.e, ['m_142582_', 'hasLineOfSight'], t) === true
      }
      var cur = zncCall(n.e, ['m_5448_', 'getTarget'])
      if (cur) {
        if (ok(cur) && zncCall(n.e, ['m_20270_', 'distanceTo'], cur) < range + 6) return
        if (!ok(cur)) zncCall(n.e, ['m_6710_', 'setTarget'], null)
      }
      var best = null, bestD = 1e9
      zncThreats.forEach(function (t) {
        if (t.e === n.e || t.kind === n.side) return
        var d = zncCall(n.e, ['m_20270_', 'distanceTo'], t.e)
        if (d > range || d >= bestD) return
        if (!ok(t.e)) return
        best = t.e; bestD = d
      })
      if (best) zncCall(n.e, ['m_6710_', 'setTarget'], best)
    })
  } catch (err) {
    if (!zncWarned) { zncWarned = true; console.error('[zone] npc combat failed: ' + err) }
  }
})

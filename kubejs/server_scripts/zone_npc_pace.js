// NPC pace (Slade). The armed Scavengers around the Bar (zone_scav), the bunker regulars (zone_guard), the Military
// squad and sentries (zone_mil, zone_mil_post) and the Pacifists (zone_pac, zone_pac_post)
// stroll while nothing's going on, and get their full speed back the moment they have a target.
// TaCZ NPCs wander at their combat speed (0.3), which reads as running on the player-style model.
// Change CALM to taste (0.3 = old behaviour, lower = slower stroll). Runs every second, near players only.
var ZPACE = { CALM: 0.2, FIGHT: 0.3, TAGS: ['zone_scav', 'zone_guard', 'zone_mil', 'zone_mil_post', 'zone_pac', 'zone_pac_post'], SCAN: 140 }
var zpaceTick = 0, zpaceState = {}, zpaceWarned = false

function zpaceCall(o, names, arg) {
  for (var i = 0; i < names.length; i++) {
    if (typeof o[names[i]] === 'function') return arg === undefined ? o[names[i]]() : o[names[i]](arg)
  }
  return undefined
}

ServerEvents.tick(function (event) {
  if (++zpaceTick % 20 !== 0) return
  var srv = event.server
  try {
    var level = srv.getLevel('minecraft:overworld'), seen = {}
    srv.players.forEach(function (p) {
      if (String(p.level.dimension).indexOf('overworld') < 0) return
      var r = ZPACE.SCAN
      level.getEntitiesWithin(AABB.of(p.x - r, p.y - 64, p.z - r, p.x + r, p.y + 64, p.z + r)).forEach(function (e) {
        if (String(e.getEncodeId()) !== 'tacznpcs:npc') return
        var uuid = String(e.getStringUuid())
        if (seen[uuid]) return
        seen[uuid] = true
        var tags = zpaceCall(e, ['getTags', 'm_19880_'])
        if (!tags) return
        var mine = false
        ZPACE.TAGS.forEach(function (t) { if (tags.contains(t)) mine = true })
        if (!mine) return
        var busy = !!zpaceCall(e, ['m_5448_', 'getTarget'])
        if (!busy) zpaceCall(e, ['m_6858_', 'setSprinting'], false)
        var want = busy ? ZPACE.FIGHT : ZPACE.CALM
        if (zpaceState[uuid] === want) return
        srv.runCommandSilent('attribute ' + uuid + ' minecraft:generic.movement_speed base set ' + want)
        zpaceState[uuid] = want
      })
    })
    // forget NPCs that are gone or unloaded, so they get set again when they come back
    Object.keys(zpaceState).forEach(function (k) { if (!seen[k]) delete zpaceState[k] })
  } catch (err) {
    if (!zpaceWarned) { zpaceWarned = true; console.error('[zone] npc pace failed: ' + err) }
  }
})

// NPC calm (Slade). Custom NPCs fight back when hit, but our quest-givers and traders are invulnerable and can't fire
// their TaCZ guns, so a stray bullet from a guard (e.g. Bohdan shooting at a Snork in the Bar) left Yarik and Fedya
// walking at him forever. This:
//  - sets every quest-giver (tag zone_qnpc) to not retaliate at all (Custom NPCs "on attack: do nothing")
//  - every 2 s, clears any Custom NPC's target if it's a friendly scavenger NPC (guards, regulars, A-Life scavs) or another Custom NPC.
// Hostile targets (mutants, zombies, bandits, players for hostile NPCs) are left alone.
// (KubeJS shares one scope between scripts: everything here is var + znm names on purpose.)
var ZNM = { SCAN: 96, FRIEND_TAGS: ['zone_guard', 'zone_scav', 'alife_scav', 'zone_qnpc'] }
var znmTick = 0, znmWarned = {}, znmCalmed = {}, znmApi = null
function znmErr(k, e) { if (!znmWarned[k]) { znmWarned[k] = true; console.error('[zone] npc calm ' + k + ': ' + e) } }
function znmCall(o, names, arg) {
  for (var i = 0; i < names.length; i++) {
    if (typeof o[names[i]] === 'function') return arg === undefined ? o[names[i]]() : o[names[i]](arg)
  }
  return undefined
}
function znmFriendly(t) {
  var id = String(t.getEncodeId())
  if (id === 'customnpcs:customnpc') return true
  if (id !== 'tacznpcs:npc') return false
  var tags = znmCall(t, ['getTags', 'm_19880_'])
  if (!tags) return false
  for (var i = 0; i < ZNM.FRIEND_TAGS.length; i++) if (tags.contains(ZNM.FRIEND_TAGS[i])) return true
  return false
}
ServerEvents.tick(function (event) {
  if (++znmTick % 40 !== 0) return
  var srv = event.server
  try {
    var level = srv.getLevel('minecraft:overworld'), seen = {}
    srv.players.forEach(function (p) {
      if (String(p.level.dimension).indexOf('overworld') < 0) return
      var r = ZNM.SCAN
      level.getEntitiesWithin(AABB.of(p.x - r, p.y - 48, p.z - r, p.x + r, p.y + 48, p.z + r)).forEach(function (e) {
        if (String(e.getEncodeId()) !== 'customnpcs:customnpc') return
        var key = String(e.getStringUuid())
        if (seen[key]) return
        seen[key] = true
        var tags = znmCall(e, ['getTags', 'm_19880_'])
        if (tags && tags.contains('zone_qnpc') && !znmCalmed[key]) {
          try {
            if (!znmApi) znmApi = Java.loadClass('noppes.npcs.api.NpcAPI').Instance()
            znmApi.getIEntity(e).getAi().setRetaliateType(3)
            znmCalmed[key] = true
          } catch (err) { znmErr('retaliate', err); znmCalmed[key] = true }
        }
        var t = znmCall(e, ['getTarget', 'm_5448_'])
        if (t && znmFriendly(t)) {
          znmCall(e, ['setTarget', 'm_6710_'], null)
          try { var nav = znmCall(e, ['getNavigation', 'm_21573_']); if (nav) znmCall(nav, ['stop', 'm_26573_']) } catch (err) {}
          console.info('[zone] npc calm: ' + String(e.getName().getString()) + ' stopped chasing ' + String(t.getName().getString()))
        }
      })
    })
  } catch (err) { znmErr('tick', err) }
})

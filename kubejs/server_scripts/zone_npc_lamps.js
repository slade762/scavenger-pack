// NPC headlamps (Claude 11/25, Ward's note 6: "Give headlamps to NPCs, have them turn them on at night or in the dark").
// Every TaCZ NPC (bandits, scavengers, military, Choir ...) near a player wears zone_tactical_anims' headlamp in its Curios
// 'head' slot (slot from kubejs/data/zone/curios/entities/zone_npc_backpack.json, loads at a restart). The lamp is switched
// on when it's dark where the NPC stands (light level below ON_BELOW: night, caves, dark rooms) and off again in the light
// (OFF_FROM and up). zone_tactical_anims 0.91.0+ draws the lamp on the NPC and its light (Sodium Dynamic Lights) for
// everyone nearby. Lamps and backpacks are taken off NPCs when they die, so they don't drop as loot.
var ZNL = { EVERY: 40, RANGE: 80, ON_BELOW: 6, OFF_FROM: 8, ITEM: 'zone_tactical_anims:headlamp' }
var znlTick = 0, znlCurios = null, znlWarned = false
function znlInv(e) {
  if (!znlCurios) znlCurios = Java.loadClass('top.theillusivec4.curios.api.CuriosApi')
  return znlCurios.getCuriosInventory(e).orElse(null)
}
function znlUpdate(level, e) {
  var inv = znlInv(e)
  if (!inv) return
  var h = inv.getStacksHandler('head').orElse(null)
  if (!h) return                                           // no head slot yet (before the restart)
  var cur = h.getStacks().getStackInSlot(0), has = !cur.isEmpty() && String(cur.getId()) === ZNL.ITEM
  var on = has && cur.hasTag() && cur.getTag().getBoolean('ZtaLampOn')
  var light = level.getRawBrightness(e.blockPosition().above(), level.getSkyDarken())
  var want = on ? light < ZNL.OFF_FROM : light < ZNL.ON_BELOW
  if (has && on === want) return
  inv.setEquippedCurio('head', 0, Item.of(ZNL.ITEM, '{ZtaLampOn:' + (want ? '1b' : '0b') + '}'))
}
ServerEvents.tick(function (event) {
  if (++znlTick % ZNL.EVERY !== 7) return
  try {
    var srv = event.server, level = srv.getLevel('minecraft:overworld'), seen = {}
    srv.players.forEach(function (p) {
      if (String(p.level.dimension).indexOf('overworld') < 0) return
      var r = ZNL.RANGE
      level.getEntitiesWithin(AABB.of(p.x - r, p.y - 48, p.z - r, p.x + r, p.y + 48, p.z + r)).forEach(function (e) {
        if (String(e.getEncodeId()) !== 'tacznpcs:npc') return
        var k = String(e.getStringUuid()); if (seen[k]) return; seen[k] = true
        if (!e.isAlive()) return
        znlUpdate(level, e)
      })
    })
  } catch (err) { if (!znlWarned) { znlWarned = true; console.error('[zone] npc lamps failed: ' + err) } }
})
EntityEvents.death(function (event) {
  try {
    var e = event.entity
    if (String(e.getEncodeId()) !== 'tacznpcs:npc') return
    var inv = znlInv(e)
    if (!inv) return
    ;['head', 'back'].forEach(function (slot) { if (inv.getStacksHandler(slot).isPresent()) inv.setEquippedCurio(slot, 0, Item.of('minecraft:air')) })
  } catch (err) {}
})

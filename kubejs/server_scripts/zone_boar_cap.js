// zone_boar_cap.js (Ward 11/25 note 8: "way too many boars"). The boars are minecraft:hoglin (a mod spawns them naturally in
// the overworld; 46 loaded around 2 players on 11/25). Every hoglin that joins the world without our mark is checked once:
// KEEP of them survive, and never more than MAX within RADIUS blocks. Kept ones are marked and never checked again.
// Covers new spawns and the ones already saved in chunks (checked when their chunk loads). Overworld only. No chat.
var ZBC = { KEEP: 0.35, MAX: 3, RADIUS: 48, MARK: 'zone_boar_ok' }
var zbcCulled = 0
EntityEvents.spawned('minecraft:hoglin', function (event) {
  var cull = false
  try {
    var e = event.entity
    if (String(e.level.dimension) !== 'minecraft:overworld') return
    if (e.persistentData.getBoolean(ZBC.MARK) || e.customName) return
    var r = ZBC.RADIUS, n = 0
    e.level.getEntitiesWithin(AABB.of(e.x - r, e.y - 32, e.z - r, e.x + r, e.y + 32, e.z + r)).forEach(function (o) {
      if (o !== e && String(o.type) === 'minecraft:hoglin' && o.persistentData.getBoolean(ZBC.MARK)) n++
    })
    if (n >= ZBC.MAX || Math.random() > ZBC.KEEP) { zbcCulled++; cull = true; return }
    e.persistentData.putBoolean(ZBC.MARK, true)
  } catch (x) { console.warn('[zone] boar cap: ' + x) } finally { if (cull) event.cancel() }
})
ServerEvents.tick(function (event) {
  if (event.server.tickCount % 12000 !== 0 || zbcCulled === 0) return
  console.info('[zone] boar cap: removed ' + zbcCulled + ' hoglins in the last 10 min'); zbcCulled = 0
})

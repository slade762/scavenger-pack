// PDA waypoints (Slade): tells zone_tactical_anims (0.75.2+) where the anomaly fields and the City are, so
// Artifact Order jobs point at the nearest anomaly fields and Zombie Purge jobs point at the City edge.
// Uses zone_anomalies.js (zanField, ZAN, zanLoad) and zone_spawn_director.js (CFG.CITY). Pushed on the first tick
// after every load / reload. Op command: /kubejs custom_command zone_pda_waypoints  (re-push + count)
var ZPW = { MIN_CX: -18, MAX_CX: 8, MIN_CZ: -10, MAX_CZ: 10 }   // cells of 160: x -2880..1440, z -1600..1760
var zpwPushed = false

function zpwPush(srv) {
  var W = Java.loadClass('com.slade.zonetactical.pda.PdaWaypoints')
  if (typeof CFG !== 'undefined' && CFG.CITY) W.setCity(CFG.CITY.minX, CFG.CITY.maxX, CFG.CITY.minZ, CFG.CITY.maxZ)
  var done = {}
  try { if (typeof zanLoad === 'function') done = zanLoad(srv) || {} } catch (e) {}
  W.beginFields()
  if (typeof ZAN !== 'undefined') ZAN.STARTER.forEach(function (f) { if (done[f.key] !== 0) W.addField(f.x, f.z) })
  if (typeof zanField === 'function') {
    for (var cx = ZPW.MIN_CX; cx <= ZPW.MAX_CX; cx++) for (var cz = ZPW.MIN_CZ; cz <= ZPW.MAX_CZ; cz++) {
      var key = cx + ',' + cz
      if (done[key] === 0) continue                       // square tried and skipped (lake, cliff)
      if (done[key]) { W.addField(done[key][0], done[key][1]); continue }   // already built: its real centre
      var f = zanField(cx, cz)
      if (f) W.addField(f.x, f.z)
    }
  }
  return W.endFields()
}

ServerEvents.tick(function (event) {
  if (zpwPushed) return
  zpwPushed = true
  try { console.info('[zone] PDA waypoints: ' + zpwPush(event.server) + ' anomaly fields sent') }
  catch (e) { console.error('[zone] PDA waypoints failed: ' + e) }
})

ServerEvents.customCommand('zone_pda_waypoints', function (event) {
  var n = 0
  try { n = zpwPush(event.server) } catch (e) { if (event.player) event.player.tell('[zone] PDA waypoints failed: ' + e); return }
  if (event.player) event.player.tell('[zone] PDA waypoints: ' + n + ' anomaly fields sent to the mod.')
})

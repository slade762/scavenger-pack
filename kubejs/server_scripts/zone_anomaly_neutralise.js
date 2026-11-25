// zone_anomaly_neutralise.js (Ward 11/25 note 6): what the Anomaly Neutraliser / Stabiliser kits do (items: startup
// zone_anomaly_tools.js). Finishing the use removes the nearest anomaly within 5 blocks and uses up one kit.
//  - Neutraliser: the anomaly is saved (type, spot, dimension) and comes back after the next Emission ends, once its chunk
//    is loaded and no player stands right on it.
//  - Stabiliser: gone for good (logged to the console with who and where, in case it needs undoing).
// Never touches portal/bubble anomalies, rifts or proto-artifact clusters, or anything a story script placed.
// Sold by Kostya ("Anomalies" tab in zone_catalogues.js). Op: /kubejs custom_command zone_anomaly_pending (how many wait to reform)
var ZAT = { REACH: 5, KEY: 'zone_anom_off', SKIP_ID: ['proto', 'rift', 'bubble', 'portal'], SKIP_TAG: ['zone_story', 'zone_scripted', 'zone_keeper'] }
var zatEH = undefined, zatWasEm = false, zatTick = 0, zatWarned = {}
function zatErr(k, e) { if (!zatWarned[k]) { zatWarned[k] = true; console.warn('[zone] anomaly kits ' + k + ': ' + e) } }
function zatLoad(srv) { try { return JSON.parse(String(srv.persistentData.getString(ZAT.KEY) || '[]')) } catch (e) { return [] } }
function zatSave(srv, list) { srv.persistentData.putString(ZAT.KEY, JSON.stringify(list)) }
function zatOk(e) {
  var id = String(e.type)
  if (id.indexOf('anomalyzone:') !== 0 || id.slice(-8) !== '_anomaly') return false
  for (var i = 0; i < ZAT.SKIP_ID.length; i++) if (id.indexOf(ZAT.SKIP_ID[i]) >= 0) return false
  for (var j = 0; j < ZAT.SKIP_TAG.length; j++) if (e.tags.contains(ZAT.SKIP_TAG[j])) return false
  return e.isAlive()
}
function zatFx(srv, dim, x, y, z, perm) {
  var at = ' ' + x.toFixed(1) + ' ' + (y + 0.8).toFixed(1) + ' ' + z.toFixed(1)
  srv.runCommandSilent('execute in ' + dim + ' run particle minecraft:' + (perm ? 'end_rod' : 'cloud') + at + ' 0.6 0.8 0.6 0.04 40 force')
  srv.runCommandSilent('execute in ' + dim + ' run playsound minecraft:block.beacon.deactivate block @a' + at + ' 1 ' + (perm ? '0.6' : '1.2'))
}
global.zoneAnomalyTool = function (p, stack, perm) {
  try {
    if (!p || !p.isPlayer()) return
    var lvl = p.level, r = ZAT.REACH, best = null, bd = 1e9
    lvl.getEntitiesWithin(AABB.of(p.x - r, p.y - r, p.z - r, p.x + r, p.y + r, p.z + r)).forEach(function (e) {
      if (!zatOk(e)) return
      var d = Math.pow(e.x - p.x, 2) + Math.pow(e.y - p.y, 2) + Math.pow(e.z - p.z, 2)
      if (d <= r * r && d < bd) { bd = d; best = e }
    })
    if (!best) { p.setStatusMessage(Text.of('No anomaly within ' + r + ' blocks.').color(0xB0A070)); return }
    var srv = p.server, dim = String(lvl.dimension), id = String(best.type)
    var x = best.x, y = best.y, z = best.z, tagged = best.tags.contains('zone_anomaly')
    best.discard()
    if (!p.isCreative()) stack.shrink(1)
    zatFx(srv, dim, x, y, z, perm)
    if (perm) {
      console.info('[zone] anomaly kits: ' + p.username + ' removed ' + id + ' for good at ' + Math.floor(x) + ' ' + Math.floor(y) + ' ' + Math.floor(z) + ' (' + dim + ')')
      p.setStatusMessage(Text.of('Anomaly stabilised. It won\'t come back.').color(0x8FC8FF))
    } else {
      var list = zatLoad(srv)
      list.push({ id: id, dim: dim, x: x, y: y, z: z, t: tagged, due: false })
      zatSave(srv, list)
      p.setStatusMessage(Text.of('Anomaly collapsed. It will reform after the next Emission.').color(0x9BD86A))
    }
  } catch (e) { zatErr('use', e) }
}
ServerEvents.tick(function (event) {
  if (++zatTick % 100 !== 13) return
  var srv = event.server
  try {
    if (zatEH === undefined) { try { zatEH = Java.loadClass('com.anomalyzone.EmissionHandler') } catch (e) { zatEH = null } }
    var em = false
    try { em = zatEH ? !!zatEH.isEmissionActive() : false } catch (e) { zatErr('emission', e) }
    var list = null
    if (zatWasEm && !em) {                       // an Emission just ended: everything neutralised so far may reform
      list = zatLoad(srv)
      list.forEach(function (a) { a.due = true })
    }
    zatWasEm = em
    if (!list) { list = zatLoad(srv); if (!list.some(function (a) { return a.due })) return }
    var keep = [], BP = Java.loadClass('net.minecraft.core.BlockPos')
    list.forEach(function (a) {
      if (!a.due) { keep.push(a); return }
      var lvl = srv.getLevel(a.dim)
      if (!lvl || !lvl.isLoaded(new BP(Math.floor(a.x), Math.floor(a.y), Math.floor(a.z)))) { keep.push(a); return }
      var near = false
      srv.players.forEach(function (p) { if (String(p.level.dimension) === a.dim && Math.hypot(p.x - a.x, p.z - a.z) < 4 && Math.abs(p.y - a.y) < 4) near = true })
      if (near) { keep.push(a); return }
      srv.runCommandSilent('execute in ' + a.dim + ' run summon ' + a.id + ' ' + a.x + ' ' + a.y + ' ' + a.z + (a.t ? ' {Tags:["zone_anomaly"]}' : ''))
    })
    zatSave(srv, keep)
  } catch (e) { zatErr('tick', e) }
})
ServerEvents.customCommand('zone_anomaly_pending', function (event) {
  var p = event.player
  if (!p || !p.hasPermissions(2)) return
  var list = zatLoad(event.server)
  p.tell(Text.of(list.length + ' neutralised anomalies saved, ' + list.filter(function (a) { return a.due }).length + ' due to reform.').color(0xD8B225))
})

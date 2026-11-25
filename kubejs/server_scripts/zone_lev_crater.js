// zone_lev_crater.js (Ward 11/25 note 5): Lev's "Something That Sings" (quest 151) needs a Prism, which AZ only drops rarely.
// The psi crater north-west of the Radio Mast (sculpted 11/25, centre -544 ~60 -92, undo data in server persistentData
// 'zone_crater_undo'; 3 psi anomalies tagged zone_crater + zone_scripted so the anomaly kits leave them alone) holds one Prism
// per player: while their 151 is active and they come within 16 blocks, a glowing Prism lies on the crater floor that only they
// can pick up and that never despawns. If they lose it before handing it in, it's there again on their next visit.
// Op: /kubejs custom_command zone_crater_status
var ZLC = { X: -544, Z: -92, R: 16, Q: 151, ITEM: 'anomalyzone:prism', ANOM: ['psi_anomaly', 'psi_electro_anomaly', 'psi_morok_anomaly'] }
var zlcTick = 0, zlcApi = null, zlcWarned = false, zlcUU = null
function zlcTag(p) { return 'zlp' + String(p.uuid).replace(/-/g, '').substring(0, 12) }
function zlcFloor(lv) { return lv.getHeight(Java.loadClass('net.minecraft.world.level.levelgen.Heightmap$Types').MOTION_BLOCKING_NO_LEAVES, ZLC.X, ZLC.Z) }
function zlcHas(p) { var inv = p.inventory; for (var i = 0; i < inv.containerSize; i++) { var s = inv.getItem(i); if (!s.isEmpty() && String(s.id) === ZLC.ITEM) return true } return false }
function zlcCheck(srv, p) {
  if (!zlcApi) zlcApi = Java.loadClass('noppes.npcs.api.NpcAPI').Instance()
  if (!zlcApi.getIEntity(p).hasActiveQuest(ZLC.Q) || zlcHas(p)) return
  var lv = p.level, tag = zlcTag(p), found = false
  lv.getEntitiesWithin(AABB.of(ZLC.X - 24, 30, ZLC.Z - 24, ZLC.X + 24, 120, ZLC.Z + 24)).forEach(function (e) { if (e.tags.contains(tag)) found = true })
  if (found) return
  if (!zlcUU) zlcUU = Java.loadClass('net.minecraft.core.UUIDUtil')
  var ints = zlcUU.uuidToIntArray(p.uuid), y = zlcFloor(lv)
  srv.runCommandSilent('execute in minecraft:overworld run summon item ' + (ZLC.X + 0.5) + ' ' + (y + 0.2) + ' ' + (ZLC.Z + 0.5) +
    ' {Item:{id:"' + ZLC.ITEM + '",Count:1b},Owner:[I;' + ints[0] + ',' + ints[1] + ',' + ints[2] + ',' + ints[3] + '],PickupDelay:10,Age:-32768,Glowing:1b,Motion:[0.0,0.0,0.0],Tags:["' + tag + '","zone_crater_prism"]}')
}
function zlcAnoms(srv, lv) {   // the 3 crater anomalies are permanent; put back any that went missing
  var have = {}
  lv.getEntitiesWithin(AABB.of(ZLC.X - 12, 30, ZLC.Z - 12, ZLC.X + 12, 120, ZLC.Z + 12)).forEach(function (e) { if (e.tags.contains('zone_crater')) have[String(e.type).split(':')[1]] = true })
  for (var i = 0; i < ZLC.ANOM.length; i++) {
    if (have[ZLC.ANOM[i]]) continue
    var a = i * 2.094 + 0.4, ax = Math.round(ZLC.X + Math.cos(a) * 4), az = Math.round(ZLC.Z + Math.sin(a) * 4)
    var ay = lv.getHeight(Java.loadClass('net.minecraft.world.level.levelgen.Heightmap$Types').MOTION_BLOCKING_NO_LEAVES, ax, az)
    srv.runCommandSilent('execute in minecraft:overworld run summon anomalyzone:' + ZLC.ANOM[i] + ' ' + (ax + 0.5) + ' ' + ay + ' ' + (az + 0.5) + ' {Tags:["zone_anomaly","zone_scripted","zone_crater"]}')
  }
}
ServerEvents.tick(function (event) {
  if (++zlcTick % 40 !== 21) return
  var srv = event.server
  try {
    var near = false
    srv.players.forEach(function (p) {
      if (String(p.level.dimension) !== 'minecraft:overworld') return
      if (Math.hypot(p.x - ZLC.X, p.z - ZLC.Z) > ZLC.R) return
      near = true
      zlcCheck(srv, p)
    })
    if (near && zlcTick % 400 === 21) zlcAnoms(srv, srv.getLevel('minecraft:overworld'))
  } catch (x) { if (!zlcWarned) { zlcWarned = true; console.warn('[zone] lev crater: ' + x) } }
})
ServerEvents.customCommand('zone_crater_status', function (event) {
  var p = event.player
  if (!p || !p.hasPermissions(2)) return
  var lv = event.server.getLevel('minecraft:overworld'), a = 0, pr = 0
  lv.getEntitiesWithin(AABB.of(ZLC.X - 24, 30, ZLC.Z - 24, ZLC.X + 24, 120, ZLC.Z + 24)).forEach(function (e) { if (e.tags.contains('zone_crater')) a++; if (e.tags.contains('zone_crater_prism')) pr++ })
  p.tell(Text.of('Crater (' + ZLC.X + ', ' + zlcFloor(lv) + ', ' + ZLC.Z + '): ' + a + ' anomalies, ' + pr + ' Prisms waiting (loaded chunks only).').color(0xD8B225))
})

// Spawn inside the Bar (Slade).
// Minecraft always lifts world-spawn players up to the surface. This puts new players, and anyone who
// respawns without a bed, at the exact world spawn block instead (set it with /setworldspawn while
// standing inside the Bar).
function zspTo(p) {
  var sp = p.server.overworld().getSharedSpawnPos()
  p.server.runCommandSilent('execute in minecraft:overworld run tp ' + p.username + ' ' + (sp.x + 0.5) + ' ' + sp.y + ' ' + (sp.z + 0.5))
}
PlayerEvents.loggedIn(function (event) {
  try {
    var p = event.player
    if (p.persistentData.getBoolean('zone_spawned')) return
    p.persistentData.putBoolean('zone_spawned', true)
    zspTo(p)
  } catch (e) { console.error('[zone] first spawn failed: ' + e) }
})
PlayerEvents.respawned(function (event) {
  try {
    var p = event.player
    if (event.endConquered) return
    if (p.getRespawnPosition() != null) return   // has a bed / respawn anchor
    zspTo(p)
  } catch (e) { console.error('[zone] respawn placement failed: ' + e) }
})

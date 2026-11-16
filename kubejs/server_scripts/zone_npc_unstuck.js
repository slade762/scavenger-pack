// NPC unstuck (Slade). A-Life squads, Pacifists, Scavengers, bandits and village Stalkers that fall into a
// cave or ravine (e.g. the cavern between Checkpoint 4 and the Old Town) get lifted back to the surface.
// Rule: more than 4 blocks under the ground surface for 20 s, and no player within 24 blocks (so nobody
// sees them pop). The Bar (a cellar) is left alone.
var ZUS = {
  TAGS: ['alife', 'zone_pac', 'zone_scav', 'zone_bandit', 'zone_vil'],
  DEPTH: 4, WAIT_TICKS: 20 * 20, PLAYER_R: 24,
  SKIP: [{ x: -1524, z: 94, r: 45 }]     // the Bar
}
var zusTicks = 0, zusSince = {}, zusHM = null, zusWarned = false

ServerEvents.tick(function (event) {
  zusTicks++
  if (zusTicks % 100 !== 0) return   // every 5 s
  var srv = event.server
  try {
    if (!zusHM) zusHM = Java.loadClass('net.minecraft.world.level.levelgen.Heightmap$Types').MOTION_BLOCKING_NO_LEAVES
    var level = srv.overworld()
    var players = []
    srv.players.forEach(function (p) { if (String(p.level.dimension).indexOf('overworld') >= 0) players.push(p) })
    var seen = {}
    level.getEntities().forEach(function (e) {
      var tags = e.tags
      if (!tags || tags.isEmpty()) return
      var mine = false
      for (var i = 0; i < ZUS.TAGS.length; i++) if (tags.contains(ZUS.TAGS[i])) { mine = true; break }
      if (!mine || tags.contains('zone_guard') || tags.contains('zone_leader') || !e.isAlive()) return
      var x = e.x, y = e.y, z = e.z
      for (var k = 0; k < ZUS.SKIP.length; k++) {
        var s = ZUS.SKIP[k]
        if ((x - s.x) * (x - s.x) + (z - s.z) * (z - s.z) < s.r * s.r) return
      }
      var ground = level.getHeight(zusHM, Math.floor(x), Math.floor(z))
      var id = String(e.stringUUID)
      if (ground - y <= ZUS.DEPTH) { delete zusSince[id]; return }
      seen[id] = true
      if (zusSince[id] == null) { zusSince[id] = zusTicks; return }
      if (zusTicks - zusSince[id] < ZUS.WAIT_TICKS) return
      for (var j = 0; j < players.length; j++) {
        var p = players[j]
        if ((p.x - x) * (p.x - x) + (p.y - y) * (p.y - y) + (p.z - z) * (p.z - z) < ZUS.PLAYER_R * ZUS.PLAYER_R) return
      }
      srv.runCommandSilent('execute in minecraft:overworld run tp ' + id + ' ' + (Math.floor(x) + 0.5) + ' ' + ground + ' ' + (Math.floor(z) + 0.5))
      delete zusSince[id]
    })
    for (var key in zusSince) if (!seen[key]) delete zusSince[key]
  } catch (err) {
    if (!zusWarned) { zusWarned = true; console.error('[zone] unstuck failed: ' + err) }
  }
})

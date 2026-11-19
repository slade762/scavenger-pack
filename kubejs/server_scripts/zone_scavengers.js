// Scavengers around the Bar, Old Moe's bunker (Slade).
//  - Up to 5 armed Scavengers (tacznpcs, loadout "scavengers") who start outside the entrance and roam freely.
//  - 5 armed regulars who start inside the Bar. Nobody gets snapped back; a dead one is replaced after a while.
// They fight zombies, mutants and bandits (zone_npc_combat.js) and leave players alone.
// Ground height comes from the world heightmap (execute positioned over), no block scanning.
var ZSC = {
  HOME: { x: -1514, z: 94 },          // outside the bunker entrance
  MAX: 5,
  NEAR: 140,                          // only top up while a player is this close (area loaded)...
  MIN_DIST: 24,                       // ...but not right on top of the spawn spot
  REFILL_TICKS: 20 * 60 * 5,
  // Armed bunker defenders inside, kept indoors. (Dimka used to be a CustomNPC that could only club things.)
  GUARDS: [
    { name: 'Dimka', tag: 'zg_dimka', x: -1531.5, y: 83, z: 92.5 },
    { name: 'Guard', tag: 'zg_guard', x: -1532.5, y: 83, z: 93.5 },
    { name: 'Tolya', tag: 'zg_tolya', x: -1533.5, y: 83, z: 92.5 },
    { name: 'Vasko', tag: 'zg_vasko', x: -1534.5, y: 83, z: 94.5 },
    { name: 'Lenka', tag: 'zg_lenka', x: -1533.0, y: 83, z: 95.5 },
    // front door: these two hold their post (walked back if they wander off)
    { name: 'Bohdan', tag: 'zg_bohdan', x: -1542.5, y: 82, z: 69.5, yaw: 33, post: true },
    { name: 'Misha', tag: 'zg_misha', x: -1545.5, y: 82, z: 67.5, yaw: 33, post: true }
  ],
  GUARD_RESPAWN: 20 * 60 * 10
}
var zscTicks = 0
var zscLast = -ZSC.REFILL_TICKS
var zscWarned = false

ServerEvents.tick(function (event) {
  zscTicks++
  if (zscTicks % 200 !== 0) return   // every 10 s
  var zscServer = event.server
  try {
    var zscNear = false, zscTooClose = false
    zscServer.players.forEach(function (p) {
      if (String(p.level.dimension).indexOf('overworld') < 0) return
      var d = Math.sqrt(Math.pow(p.x - ZSC.HOME.x, 2) + Math.pow(p.z - ZSC.HOME.z, 2))
      if (d < ZSC.NEAR) zscNear = true
      if (d < ZSC.MIN_DIST) zscTooClose = true
    })
    if (!zscNear) return
    var hx = ZSC.HOME.x + 0.5, hz = ZSC.HOME.z + 0.5
    var surf = 'execute in minecraft:overworld positioned ' + hx + ' 0 ' + hz + ' positioned over motion_blocking_no_leaves '
    // regulars: exactly one of each, free to roam
    ZSC.GUARDS.forEach(function (g) {
      var gpos = g.x + ' ' + g.y + ' ' + g.z
      var sel = '@e[type=tacznpcs:npc,tag=' + g.tag
      var have = Number(zscServer.runCommandSilent('execute in minecraft:overworld if entity ' + sel + ']')) || 0
      // Killed defenders come back after GUARD_RESPAWN (fresh recruits), not instantly.
      if (have >= 1) {
        g.lostAt = null; g.seen = true
        if (g.post) zscServer.runCommandSilent('execute in minecraft:overworld positioned ' + gpos + ' as @e[type=tacznpcs:npc,tag=' + g.tag + ',distance=5..48] run tp @s ' + gpos + ' ' + g.yaw + ' 0')
        return
      }
      if (g.seen) { if (g.lostAt == null) g.lostAt = zscTicks; if (zscTicks - g.lostAt < ZSC.GUARD_RESPAWN) return }
      g.seen = true; g.lostAt = null
      {
        zscServer.runCommandSilent('execute in minecraft:overworld run summon tacznpcs:npc ' + gpos +
          ' {template:"scavengers",' + (g.yaw != null ? 'Rotation:[' + g.yaw + 'f,0f],' : '') + 'CustomName:\'{"text":"' + g.name + '"}\',PersistenceRequired:1b,Tags:["zone_guard","' + g.tag + '"]}')
        console.info('[zone] bunker defender placed: ' + g.name)
      }
    })
    // old untagged guard from the first version
    zscServer.runCommandSilent('kill @e[type=tacznpcs:npc,tag=zone_guard,tag=!zg_dimka,tag=!zg_guard,tag=!zg_tolya,tag=!zg_vasko,tag=!zg_lenka,tag=!zg_bohdan,tag=!zg_misha]')
    if (zscTooClose || zscTicks - zscLast < ZSC.REFILL_TICKS) return
    zscLast = zscTicks
    var have = Number(zscServer.runCommandSilent('execute in minecraft:overworld if entity @e[type=tacznpcs:npc,tag=zone_scav]')) || 0
    var added = 0
    for (var i = have; i < ZSC.MAX; i++) {
      var a = Math.random() * 3.141592653589793 * 2, r = 6 + Math.random() * 14
      var sx = Math.floor(ZSC.HOME.x + Math.cos(a) * r) + 0.5, sz = Math.floor(ZSC.HOME.z + Math.sin(a) * r) + 0.5
      zscServer.runCommandSilent('execute in minecraft:overworld positioned ' + sx + ' 0 ' + sz +
        ' positioned over motion_blocking_no_leaves run summon tacznpcs:npc ~ ~ ~ {template:"scavengers",CustomName:\'{"text":"Scavenger"}\',PersistenceRequired:1b,Tags:["zone_scav"]}')
      added++
    }
    if (added > 0) console.info('[zone] scavengers topped up: ' + added)
  } catch (err) {
    if (!zscWarned) { zscWarned = true; console.error('[zone] scavengers failed: ' + err) }
  }
})

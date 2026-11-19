// The Military at their base (Slade). Major Kravets' men.
// A squad of armed soldiers (tacznpcs, loadout "military") patrols the base; strays get walked back.
// Dead soldiers are replaced after a while, only while a player is near (area loaded) but not on top of the spawn.
// They fight zombies, mutants and bandits and leave players, Scavengers and Pacifists alone.
// Op commands (stand on the spot):
//   /kubejs custom_command zone_military_info    home + how many soldiers are alive
//   /kubejs custom_command zone_military_fill    top the squad up right now
//   /kubejs custom_command zone_military_home    move the squad's home here (saved with the world)
//   /kubejs custom_command zone_military_post    place a sentry who holds this spot, facing your way
var ZMIL = {
  HOME: { x: -271, y: 66, z: 315 },   // default home (Military Base), override with zone_military_home
  MAX: 6,
  PATROL_R: 34,
  SPAWN_R: [8, 22],
  NEAR: 160, MIN_DIST: 20,
  REFILL_TICKS: 20 * 60 * 5,
  NAMES: ['Soldier', 'Soldier', 'Soldier', 'Private', 'Corporal', 'Sergeant']
}
var zmilTicks = 0, zmilLastFill = -ZMIL.REFILL_TICKS, zmilWarned = false, zmilHM = null

function zmilHome(srv) {
  var h = srv.persistentData.getCompound('zone_mil_home')
  if (h && h.contains('x')) return { x: Number(h.getInt('x')), y: h.contains('y') ? Number(h.getInt('y')) : ZMIL.HOME.y, z: Number(h.getInt('z')) }
  return ZMIL.HOME
}
function zmilGround(level, x, z) {
  if (!zmilHM) zmilHM = Java.loadClass('net.minecraft.world.level.levelgen.Heightmap$Types').MOTION_BLOCKING_NO_LEAVES
  return level.getHeight(zmilHM, Math.floor(x), Math.floor(z))
}
// lowest standable spot from a few blocks under the base's level upwards (ground floor, never the roofs)
function zmilFloor(level, x, y0, z) {
  var air = function (id) { return id === 'minecraft:air' || id === 'minecraft:cave_air' || id === 'minecraft:grass' || id === 'minecraft:tall_grass' || id.indexOf('fern') >= 0 || id === 'minecraft:snow' }
  x = Math.floor(Number(x)); z = Math.floor(Number(z)); y0 = Math.floor(Number(y0))
  if (isNaN(x) || isNaN(z) || isNaN(y0)) return null
  for (var y = y0 - 6; y <= y0 + 10; y++) {
    var below = String(level.getBlock(x, y - 1, z).id), feet = String(level.getBlock(x, y, z).id), head = String(level.getBlock(x, y + 1, z).id)
    if (air(feet) && air(head) && !air(below) && below.indexOf('water') < 0 && below.indexOf('lava') < 0 && below.indexOf('leaves') < 0) return y
  }
  return null
}
function zmilSquad(level) {
  var out = []
  level.getEntities().forEach(function (e) {
    if (String(e.type) === 'tacznpcs:npc' && e.tags.contains('zone_mil') && e.isAlive()) out.push(e)
  })
  return out
}

function zmilFill(srv, level, home, want) {
  var added = 0, where = '', fails = 0
  for (var tries = 0; added < want && tries < want * 4; tries++) {
    // (zmAng/zmRad: plain a/r clash with other scripts in KubeJS' shared scope and came out NaN)
    var zmAng = Math.random() * 3.141592653589793 * 2, zmRad = ZMIL.SPAWN_R[0] + Math.random() * (ZMIL.SPAWN_R[1] - ZMIL.SPAWN_R[0])
    var sx = Math.floor(home.x + Math.cos(zmAng) * zmRad), sz = Math.floor(home.z + Math.sin(zmAng) * zmRad)
    var sy = zmilFloor(level, sx, home.y, sz)      // ground floor near the base's level (the heightmap put them on roofs)
    if (sy === null) { if (fails++ === 0) console.info('[zone] military: no floor at ' + sx + ' ' + home.y + ' ' + sz + ' (home ' + JSON.stringify(home) + ')'); continue }
    var nm = ZMIL.NAMES[Math.floor(Math.random() * ZMIL.NAMES.length)]
    srv.runCommandSilent('execute in minecraft:overworld run summon tacznpcs:npc ' + (sx + 0.5) + ' ' + sy + ' ' + (sz + 0.5) +
      ' {template:"military",CustomName:\'{"text":"' + nm + '"}\',PersistenceRequired:1b,Tags:["zone_mil"]}')
    added++; where = sx + ' ' + sy + ' ' + sz
  }
  if (added > 0 || fails > 0) console.info('[zone] military topped up: ' + added + ' (no floor: ' + fails + ', last at ' + where + ')')
  return added
}

ServerEvents.customCommand('zone_military_home', function (event) {
  var p = event.player
  if (!p) return
  var t = new (Java.loadClass('net.minecraft.nbt.CompoundTag'))()
  t.putInt('x', Math.floor(p.x)); t.putInt('y', Math.floor(p.y)); t.putInt('z', Math.floor(p.z))
  event.server.persistentData.put('zone_mil_home', t)
  zmilLastFill = -ZMIL.REFILL_TICKS
  p.tell(Text.of('The Military squad now patrols around here.').color(0x9BD86A))
})
ServerEvents.customCommand('zone_military_post', function (event) {
  var p = event.player
  if (!p) return
  var x = Math.floor(p.x) + 0.5, y = Math.floor(p.y), z = Math.floor(p.z) + 0.5
  event.server.runCommandSilent('execute in ' + p.level.dimension + ' run summon tacznpcs:npc ' + x + ' ' + y + ' ' + z +
    ' {template:"military",CustomName:\'{"text":"Sentry"}\',PersistenceRequired:1b,Rotation:[' + p.yaw + 'f,0f],Tags:["zone_mil_post"]}')
  p.tell(Text.of('Placed a Military sentry. Step off the spot.').color(0x9BD86A))
})

ServerEvents.customCommand('zone_military_info', function (event) {
  var home = zmilHome(event.server), n = zmilSquad(event.server.overworld()).length
  var msg = '[zone] military home ' + home.x + ' ' + home.y + ' ' + home.z + ', squad alive (loaded): ' + n
  if (event.player) event.player.tell(msg); else console.info(msg)
})
ServerEvents.customCommand('zone_military_fill', function (event) {
  var srv = event.server, level = srv.overworld(), home = zmilHome(srv)
  var n = zmilFill(srv, level, home, ZMIL.MAX - zmilSquad(level).length)
  if (event.player) event.player.tell('[zone] Military: ' + n + ' soldiers sent to the base.')
})

ServerEvents.tick(function (event) {
  zmilTicks++
  if (zmilTicks % 100 !== 40) return   // every 5 s
  var srv = event.server
  try {
    var home = zmilHome(srv), level = srv.overworld()
    var near = false, tooClose = false
    srv.players.forEach(function (p) {
      if (String(p.level.dimension).indexOf('overworld') < 0) return
      var d = Math.hypot(p.x - home.x, p.z - home.z)
      if (d < ZMIL.NEAR) near = true
      if (d < ZMIL.MIN_DIST) tooClose = true
    })
    if (!near) return
    var squad = zmilSquad(level)
    if (!tooClose && zmilTicks - zmilLastFill >= ZMIL.REFILL_TICKS) {
      zmilLastFill = zmilTicks
      zmilFill(srv, level, home, ZMIL.MAX - squad.length)
    }
    // patrol: wander around the base, strays get walked back
    squad.forEach(function (e) {
      if (e.getTarget && e.getTarget()) return
      var d = Math.hypot(e.x - home.x, e.z - home.z)
      if (d > ZMIL.PATROL_R || Math.random() < 0.2) {
        var zmAng = Math.random() * 3.141592653589793 * 2, zmRad = 4 + Math.random() * (ZMIL.PATROL_R - 4)
        var px = home.x + Math.cos(zmAng) * zmRad, pz = home.z + Math.sin(zmAng) * zmRad
        var py = zmilFloor(level, px, home.y, pz)
        if (py === null) return
        try { e.getNavigation().moveTo(Math.floor(px) + 0.5, py, Math.floor(pz) + 0.5, 1.0) } catch (err) { }
      }
    })
  } catch (err) {
    if (!zmilWarned) { zmilWarned = true; console.error('[zone] military failed: ' + err) }
  }
})

// TaCZ NPCs crash the server when they fire a gun of type "dmr" (tacznpcs 2.1.0: "Unexpected value: dmr").
// Any NPC that turns up holding one (old saves, loot tables) gets an AK-74 instead, the moment it loads.
var ZMIL_DMR = { 'ra1k:nl545': 'ra1k:ak74' }
EntityEvents.spawned(function (event) {
  try {
    var e = event.entity
    if (String(e.type) !== 'tacznpcs:npc') return
    var it = e.mainHandItem
    if (!it || it.isEmpty()) return
    var tag = it.nbt
    if (!tag) return
    var gid = String(tag.getString('GunId'))
    if (ZMIL_DMR[gid]) { tag.putString('GunId', ZMIL_DMR[gid]); console.info('[zone] swapped a DMR (' + gid + ') off ' + e.name.string) }
  } catch (err) { if (!zmilWarned) { zmilWarned = true; console.error('[zone] dmr swap failed: ' + err) } }
})

// The Pacifists at the Mountainview Chalet (Slade). Not actually peaceful.
// Pushed out of the Kindergarten by the Military. Armed squad (tacznpcs, loadout "pacifists") that
// patrols around the Chalet and every so often sends a few fighters down to the Old Town to hit the bandits.
// Setup, standing at the middle of the Chalet:
//   /kubejs custom_command zone_pacifists_home    sets the Chalet as their home (saved with the world)
//   /kubejs custom_command zone_pacifist_here     places a named sentry on the spot (stays at its post)
//   /kubejs custom_command zone_pacifists_raid    sends a raid to the Old Town right now (for testing)
var ZPC = {
  MAX: 6,                        // roaming fighters kept around the Chalet
  PATROL_R: 16,                  // how far they may stray from home before being walked back (was 30)
  WANDER_R: 11,                  // patrol points are picked within this radius of home
  NEAR: 160, MIN_DIST: 24,       // top up only while a player is near, but not right on top of the spawn spot
  REFILL_TICKS: 20 * 60 * 5,
  TOWN: { x: -1215, z: 30 },     // the Old Town (bandit camp)
  RAID_EVERY: 20 * 60 * 8, RAID_SIZE: 3, RAID_MAX: 20 * 60 * 4, STEP: 22,
  NAMES: ['Pacifist', 'Pacifist', 'Pacifist', 'Pacifist Veteran']
}
var zpcTicks = 0, zpcLastFill = -ZPC.REFILL_TICKS, zpcLastRaid = 0, zpcRaidStart = -1, zpcWarned = false, zpcHM = null

function zpcHome(srv) {
  var h = srv.persistentData.getCompound('zone_pac_home')
  if (!h || !h.contains('x')) return { x: -1488, y: 111, z: -140 }   // default: Mountainview Chalet
  return { x: h.getInt('x'), y: h.getInt('y'), z: h.getInt('z') }
}
function zpcGround(level, x, z) {
  if (!zpcHM) zpcHM = Java.loadClass('net.minecraft.world.level.levelgen.Heightmap$Types').MOTION_BLOCKING_NO_LEAVES
  return level.getHeight(zpcHM, Math.floor(x), Math.floor(z))
}
function zpcMove(e, x, y, z) {
  try { e.getNavigation().moveTo(x + 0.5, y, z + 0.5, 1.0) } catch (err) { }
}
function zpcSquad(level) {
  var out = []
  level.getEntities().forEach(function (e) {
    if (String(e.type) === 'tacznpcs:npc' && e.tags.contains('zone_pac') && e.isAlive()) out.push(e)
  })
  return out
}
function zpcStartRaid(srv, level, squad) {
  var n = 0
  squad.forEach(function (e) {
    if (n >= ZPC.RAID_SIZE || e.tags.contains('zone_pac_raid')) return
    e.addTag('zone_pac_raid'); n++
  })
  zpcRaidStart = zpcTicks; zpcLastRaid = zpcTicks
  if (n > 0) console.info('[zone] pacifists: ' + n + ' heading to the Old Town')
  return n
}

ServerEvents.customCommand('zone_pacifists_home', function (event) {
  var p = event.player
  if (!p) return
  var t = new (Java.loadClass('net.minecraft.nbt.CompoundTag'))()
  t.putInt('x', Math.floor(p.x)); t.putInt('y', Math.floor(p.y)); t.putInt('z', Math.floor(p.z))
  event.server.persistentData.put('zone_pac_home', t)
  p.tell(Text.of('The Pacifists now call this home. Their squad will show up within a few minutes.').color(0x9BD86A))
  zpcLastFill = -ZPC.REFILL_TICKS
})
ServerEvents.customCommand('zone_pacifist_here', function (event) {
  var p = event.player
  if (!p) return
  var x = Math.floor(p.x) + 0.5, y = Math.floor(p.y), z = Math.floor(p.z) + 0.5
  event.server.runCommandSilent('execute in ' + p.level.dimension + ' run summon tacznpcs:npc ' + x + ' ' + y + ' ' + z +
    ' {template:"pacifists",CustomName:\'{"text":"Pacifist Sentry"}\',PersistenceRequired:1b,Rotation:[' + p.yaw + 'f,0f],Tags:["zone_pac_post"]}')
  p.tell(Text.of('Placed a Pacifist sentry. Step off the spot.').color(0x9BD86A))
})
ServerEvents.customCommand('zone_pacifists_raid', function (event) {
  var level = event.server.overworld()
  var n = zpcStartRaid(event.server, level, zpcSquad(level))
  if (event.player) event.player.tell(Text.of(n + ' Pacifists are heading for the Old Town.').color(0x9BD86A))
})

ServerEvents.tick(function (event) {
  zpcTicks++
  if (zpcTicks % 100 !== 0) return   // every 5 s
  var srv = event.server
  try {
    // the bandit boss gets a proper name, so Eliwood's "Bandit Boss" job can count him
    if (zpcTicks % 600 === 0) srv.runCommandSilent('execute in minecraft:overworld run data merge entity @e[type=tacznpcs:npc,tag=zone_leader,limit=1] {CustomName:\'{"text":"Bandit Leader"}\'}')
    var home = zpcHome(srv)
    if (!home) return
    var level = srv.overworld()

    var near = false, tooClose = false
    srv.players.forEach(function (p) {
      if (String(p.level.dimension).indexOf('overworld') < 0) return
      var d = Math.sqrt(Math.pow(p.x - home.x, 2) + Math.pow(p.z - home.z, 2))
      if (d < ZPC.NEAR) near = true
      if (d < ZPC.MIN_DIST) tooClose = true
    })
    var squad = zpcSquad(level)

    // top up
    if (near && !tooClose && zpcTicks - zpcLastFill >= ZPC.REFILL_TICKS) {
      zpcLastFill = zpcTicks
      for (var i = squad.length; i < ZPC.MAX; i++) {
        var a = Math.random() * 3.141592653589793 * 2, r = 5 + Math.random() * 12
        var sx = Math.floor(home.x + Math.cos(a) * r) + 0.5, sz = Math.floor(home.z + Math.sin(a) * r) + 0.5
        var nm = ZPC.NAMES[Math.floor(Math.random() * ZPC.NAMES.length)]
        srv.runCommandSilent('execute in minecraft:overworld positioned ' + sx + ' 0 ' + sz +
          ' positioned over motion_blocking_no_leaves run summon tacznpcs:npc ~ ~ ~ {template:"pacifists",CustomName:\'{"text":"' + nm + '"}\',PersistenceRequired:1b,Tags:["zone_pac"]}')
      }
    }

    // raids: a few fighters walk down to the Old Town, fight, then come home
    var raiders = squad.filter(function (e) { return e.tags.contains('zone_pac_raid') })
    if (raiders.length === 0 && squad.length >= 4 && zpcTicks - zpcLastRaid >= ZPC.RAID_EVERY) {
      zpcStartRaid(srv, level, squad)
      raiders = zpcSquad(level).filter(function (e) { return e.tags.contains('zone_pac_raid') })
    }
    var goingHome = zpcRaidStart >= 0 && zpcTicks - zpcRaidStart > ZPC.RAID_MAX
    raiders.forEach(function (e) {
      if (e.getTarget && e.getTarget()) return   // busy fighting
      var tx = goingHome ? home.x : ZPC.TOWN.x, tz = goingHome ? home.z : ZPC.TOWN.z
      var dx = tx - e.x, dz = tz - e.z, d = Math.sqrt(dx * dx + dz * dz)
      if (goingHome && d < ZPC.PATROL_R * 0.6) { e.removeTag('zone_pac_raid'); return }
      if (!goingHome && d < 18) {   // in the town: mill about looking for trouble
        var ra = Math.random() * 3.141592653589793 * 2
        var mx = ZPC.TOWN.x + Math.cos(ra) * 20, mz = ZPC.TOWN.z + Math.sin(ra) * 20
        zpcMove(e, mx, zpcGround(level, mx, mz), mz); return
      }
      var s = Math.min(ZPC.STEP, d)
      var nx = e.x + dx / d * s, nz = e.z + dz / d * s
      zpcMove(e, nx, zpcGround(level, nx, nz), nz)
    })
    if (goingHome && raiders.length === 0) zpcRaidStart = -1

    // patrol: the rest wander around the Chalet; strays get walked back
    squad.forEach(function (e) {
      if (e.tags.contains('zone_pac_raid')) return
      if (e.getTarget && e.getTarget()) return
      var d = Math.sqrt(Math.pow(e.x - home.x, 2) + Math.pow(e.z - home.z, 2))
      if (d > ZPC.PATROL_R || Math.random() < 0.25) {
        var a = Math.random() * 3.141592653589793 * 2, r = 3 + Math.random() * (ZPC.WANDER_R - 3)
        var px = home.x + Math.cos(a) * r, pz = home.z + Math.sin(a) * r
        zpcMove(e, px, zpcGround(level, px, pz), pz)
      }
    })
  } catch (err) {
    if (!zpcWarned) { zpcWarned = true; console.error('[zone] pacifists failed: ' + err) }
  }
})

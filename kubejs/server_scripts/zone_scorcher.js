// SCAVENGER: Lev's Brain Scorcher questline (Radio Mast, quests 150-153, dialogs 213-220). Canon: the Lore Bible doc.
//
//  - Keeps 6 "Choir Keeper"s (Choir Acolyte template) around the Scorcher while a player is nearby (quest 152 kills them).
//  - Hands out the Shift Chief's Reel when a player on quest 153 opens any chest at the Scorcher.
//  - Sends the Scorcher map waypoint (Xaero's) once quest 152 is active.
//  - The psi field itself is in zone_tactical_anims (common config radiation.psiFields), and needs Lev's Psy-Helmet (300 psi).
//
// Op commands:
//   /kubejs custom_command zone_scorcher_here     the Scorcher's centre is where you stand (saved; also move psiFields to match!)
//   /kubejs custom_command zone_scorcher_status   where it is, how many keepers are up

var ZSC = {
  DEFAULT: { x: -540, z: -330 },          // until zone_scorcher_here is used
  KEEPERS: { name: 'Choir Keeper', count: 6, ring: [8, 30], near: 160, minDist: 24, refill: 20 * 60 * 6 },
  REEL: { quest: 153, item: 'zone_tactical_anims:scorcher_reel', r: 60 },
  WAYPOINT: { quest: 152, name: 'The Scorcher', color: 13 }
}
var zscTick = 0, zscLast = -999999, zscWarned = {}, zscApi = null, zscHM = null

function zscErr(where, e) { if (!zscWarned[where]) { zscWarned[where] = true; console.error('[zone] scorcher ' + where + ' failed: ' + e) } }
function zscCmd(srv, c) { return Number(srv.runCommandSilent(String(c))) || 0 }
function zscIP(p) { if (!zscApi) zscApi = Java.loadClass('noppes.npcs.api.NpcAPI').Instance(); return zscApi.getIEntity(p) }
function zscCenter(srv) {
  try { var raw = String(srv.persistentData.getString('zone_scorcher') || ''); if (raw) return JSON.parse(raw) } catch (e) {}
  return ZSC.DEFAULT
}
function zscGround(level, x, z) {
  if (!zscHM) zscHM = Java.loadClass('net.minecraft.world.level.levelgen.Heightmap$Types').MOTION_BLOCKING_NO_LEAVES
  return level.getHeight(zscHM, Math.floor(x), Math.floor(z))
}
function zscOverworld(p) { return String(p.level.dimension).indexOf('overworld') >= 0 }

// ---------------------------------------------------------------- Choir Keepers
function zscKeepers(srv) {
  var k = ZSC.KEEPERS, c = zscCenter(srv), d = 1e9
  srv.players.forEach(function (p) { if (zscOverworld(p)) d = Math.min(d, Math.hypot(p.x - c.x, p.z - c.z)) })
  if (d > k.near || d < k.minDist || zscTick - zscLast < k.refill) return
  var level = srv.getLevel('minecraft:overworld'), y0 = zscGround(level, c.x, c.z)
  if (zscCmd(srv, 'execute in minecraft:overworld if loaded ' + c.x + ' ' + y0 + ' ' + c.z) <= 0) return
  zscLast = zscTick
  var have = zscCmd(srv, 'execute in minecraft:overworld positioned ' + c.x + ' ' + y0 + ' ' + c.z + ' if entity @e[type=tacznpcs:npc,tag=zone_keeper,distance=..64]')
  if (have >= 2) return
  for (var i = have; i < k.count; i++) {
    var ang = (i / k.count) * Math.PI * 2 + Math.random() * 0.6
    var r = k.ring[0] + Math.random() * (k.ring[1] - k.ring[0])
    var x = Math.floor(c.x + Math.cos(ang) * r), z = Math.floor(c.z + Math.sin(ang) * r)
    var y = zscGround(level, x, z)
    srv.runCommandSilent('execute in minecraft:overworld run summon tacznpcs:npc ' + (x + 0.5) + ' ' + y + ' ' + (z + 0.5) +
      ' {template:"choir_acolyte",CustomName:\'{"text":"' + k.name + '"}\',PersistenceRequired:1b,Tags:["zone_story","zone_acolyte","zone_keeper"]}')
  }
  console.info('[zone] scorcher: Choir Keepers topped up (' + (k.count - have) + ')')
}

// ---------------------------------------------------------------- the reel (any chest at the Scorcher)
BlockEvents.rightClicked(function (event) {
  try {
    var p = event.player, b = event.block
    if (!p || p.level.isClientSide() || !zscOverworld(p)) return
    if (String(b.id).indexOf('chest') < 0 && String(b.id).indexOf('barrel') < 0) return
    var c = zscCenter(p.server)
    if (Math.hypot(b.x - c.x, b.z - c.z) > ZSC.REEL.r) return
    var ip = zscIP(p)
    if (!ip.hasActiveQuest(ZSC.REEL.quest)) return
    var has = false, inv = p.getInventory()
    ;[inv.items, inv.offhand].forEach(function (list) {
      for (var i = 0; i < list.size(); i++) if (String(list.get(i).id) === ZSC.REEL.item) has = true
    })
    if (has) return
    p.give(Item.of(ZSC.REEL.item))
    p.tell(Text.of('Under the duty logs: a tape reel in a tin, stamped LYUBEK. Take it to Lev.').color(0xD8B225))
  } catch (e) { zscErr('reel', e) }
})

// ---------------------------------------------------------------- map waypoint
function zscWaypoint(srv) {
  var w = ZSC.WAYPOINT, c = zscCenter(srv)
  srv.players.forEach(function (p) {
    var sent = {}
    try { sent = JSON.parse(String(p.persistentData.getString('zone_wp_sent') || '{}')) } catch (e) { sent = {} }
    if (sent.scorcher || !zscIP(p).hasActiveQuest(w.quest)) return
    p.tell(Text.of('New location on your map: ').color(0xD8B225).append(Text.of(w.name).color(0xFFFFFF)).append(Text.of('  (' + c.x + ', ' + c.z + ')').color(0x9A9A90)))
    p.tell(Text.of('xaero-waypoint:' + w.name + ':S:' + c.x + ':~:' + c.z + ':' + w.color + ':false:0:Internal-overworld-waypoints'))
    sent.scorcher = true
    p.persistentData.putString('zone_wp_sent', JSON.stringify(sent))
  })
}

ServerEvents.tick(function (event) {
  zscTick++
  if (zscTick % 100 === 0) { try { zscKeepers(event.server) } catch (e) { zscErr('keepers', e) } }
  if (zscTick % 200 === 50) { try { zscWaypoint(event.server) } catch (e) { zscErr('waypoint', e) } }
})

ServerEvents.customCommand('zone_scorcher_here', function (event) {
  var p = event.player
  if (!p) return
  var c = { x: Math.floor(p.x), z: Math.floor(p.z) }
  event.server.persistentData.putString('zone_scorcher', JSON.stringify(c))
  p.tell(Text.of('The Scorcher is now centred at ' + c.x + ', ' + c.z + '. Set zone_tactical_anims psiFields to the same centre.').color(0x9BD86A))
})
ServerEvents.customCommand('zone_scorcher_status', function (event) {
  var p = event.player, srv = event.server
  if (!p) return
  var c = zscCenter(srv)
  var n = zscCmd(srv, 'execute in minecraft:overworld positioned ' + c.x + ' 100 ' + c.z + ' if entity @e[type=tacznpcs:npc,tag=zone_keeper,distance=..200]')
  p.tell('Scorcher centre ' + c.x + ', ' + c.z + ' | Choir Keepers up: ' + n)
})

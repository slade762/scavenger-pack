// Zone points of interest (Slade).
// Hand-built locations between the bunker and Gresham. The land there regenerates as it's explored, so each one
// builds itself the first time a player comes near, fitted to the ground (dry spot nearby if it lands in water).
// They're also A-Life smart terrains (see zone_alife.js). Entering one shows its name, STALKER style.
// Templates: kubejs/data/zone/structures/<tpl>.nbt   Ground level inside a template = 3.
// Op commands: /kubejs custom_command zone_pois_status  (lists built/unbuilt)
var ZPOI = {
  G: 3,
  BUILD_DIST: 110,       // build when a player is this close (inside the loaded area)
  NAME_DIST: 22,         // show the location name when you walk in
  LIST: [
    { id: 'checkpoint', name: 'Checkpoint 4',     tpl: 'checkpoint',      x: -1060, z: 70,   sx: 19, sz: 15 },
    { id: 'pumping',    name: 'Pumping Station',  tpl: 'pumping_station', x: -890,  z: 260,  sx: 17, sz: 15 },
    { id: 'farm',       name: 'Kovalenko Farm',   tpl: 'farmstead',       x: -760,  z: -200, sx: 21, sz: 17 },
    { id: 'heli',       name: 'Mi-8 Crash Site',  tpl: 'heli_crash',      x: -620,  z: 330,  sx: 21, sz: 13 },
    { id: 'mast',       name: 'Radio Mast',       tpl: 'radio_mast',      x: -520,  z: -60,  sx: 11, sz: 11 },
    { id: 'hollow',     name: 'Bone Hollow',      tpl: 'bone_hollow',     x: -960,  z: -330, sx: 17, sz: 17 },
    { id: 'orchard',    name: 'Dead Orchard',     tpl: 'dead_orchard',    x: -470,  z: 560,  sx: 17, sz: 17 }
  ]
}
var zpoiState = null
var zpoiTick = 0
var zpoiWarned = false
var zpoiShown = {}
var zpoiStage = ''
var zpoiLastErr = -99999

function zpoiLoad(server) {
  var raw = ''
  try { raw = String(server.persistentData.getString('zone_pois') || '') } catch (e) {}
  try { zpoiState = raw ? JSON.parse(raw) : null } catch (e) { zpoiState = null }
  if (!zpoiState || !zpoiState.built) zpoiState = { built: {} }
}
function zpoiSave(server) { try { server.persistentData.putString('zone_pois', JSON.stringify(zpoiState)) } catch (e) {} }

// Everything below works through commands (no Java number conversions): the game finds the ground itself.
function zpoiCmd(server, c) { return Number(server.runCommandSilent(String(c))) || 0 }
function zpoiAt(x, z) { return 'execute in minecraft:overworld positioned ' + Math.floor(x) + ' 0 ' + Math.floor(z) + ' ' }
function zpoiLoaded(server, x, z) { return zpoiCmd(server, 'execute in minecraft:overworld if loaded ' + Math.floor(x) + ' 0 ' + Math.floor(z)) > 0 }
function zpoiWet(server, x, z) {
  return zpoiCmd(server, zpoiAt(x, z) + 'positioned over world_surface if block ~ ~-1 ~ minecraft:water') > 0 ||
         zpoiCmd(server, zpoiAt(x, z) + 'positioned over world_surface if block ~ ~-1 ~ minecraft:ice') > 0
}
// footprint corners + centre: all loaded? any water?
function zpoiCheck(server, cx, cz, p) {
  var pts = [[0, 0], [-p.sx / 2, -p.sz / 2], [p.sx / 2, -p.sz / 2], [-p.sx / 2, p.sz / 2], [p.sx / 2, p.sz / 2]]
  for (var k = 0; k < pts.length; k++) {
    var x = cx + pts[k][0], z = cz + pts[k][1]
    if (!zpoiLoaded(server, x, z)) return 'unloaded'
    if (zpoiWet(server, x, z)) return 'wet'
  }
  return 'ok'
}
// Real ground: scanning down, the first block with 6 solid, non-tree blocks under it (skips trees, bushes,
// snow and anything floating such as a misplaced build sitting on treetops).
var ZPOI_SOFT = ['air', 'leaves', '_log', '_wood', 'stem', 'vine', 'snow', 'grass', 'fern', 'flower', 'bush', 'sapling',
  'mushroom', 'moss_carpet', 'cobweb', 'roots', 'azalea', 'berry', 'lily', 'dandelion', 'poppy', 'tulip', 'orchid', 'allium', 'bluet', 'daisy', 'cornflower', 'lily_of', 'rose', 'peony', 'lilac', 'sugar_cane', 'bamboo']
function zpoiSoft(id) {
  for (var k = 0; k < ZPOI_SOFT.length; k++) if (id.indexOf(ZPOI_SOFT[k]) >= 0) return true
  return false
}
function zpoiGround(level, x, z) {
  x = Math.floor(x); z = Math.floor(z)
  var run = 0
  for (var y = 230; y > -50; y--) {
    var id = String(level.getBlock(x, y, z).id)
    if (zpoiSoft(id)) { run = 0; continue }
    run++
    if (run >= 6) return y + 6            // top of the solid run, +1 = first block above ground
  }
  return null
}
function zpoiGroundMedian(level, cx, cz, p) {
  var hs = [], pts = [[0, 0], [-p.sx / 3, -p.sz / 3], [p.sx / 3, -p.sz / 3], [-p.sx / 3, p.sz / 3], [p.sx / 3, p.sz / 3]]
  for (var k = 0; k < pts.length; k++) { var g = zpoiGround(level, cx + pts[k][0], cz + pts[k][1]); if (g !== null) hs.push(g) }
  if (hs.length === 0) return null
  hs.sort(function (a, b) { return a - b })
  return hs[Math.floor(hs.length / 2)]
}
// clear trees (and anything we placed before) out of the footprint above the ground
var ZPOI_JUNK = ['#minecraft:logs', '#minecraft:leaves', 'minecraft:green_terracotta', 'minecraft:gray_concrete', 'minecraft:light_gray_concrete',
  'minecraft:tinted_glass', 'minecraft:polished_deepslate_slab', 'minecraft:iron_bars', 'minecraft:chain', 'minecraft:iron_block',
  'minecraft:chest', 'minecraft:barrel', 'minecraft:lectern', 'minecraft:campfire', 'minecraft:coal_block', 'minecraft:gray_concrete_powder', 'minecraft:vine']
function zpoiClear(server, x0, y0, z0, x1, y1, z1, deep) {
  var box = 'execute in minecraft:overworld run fill ' + x0 + ' ' + y0 + ' ' + z0 + ' ' + x1 + ' ' + y1 + ' ' + z1 + ' minecraft:air replace '
  ZPOI_JUNK.forEach(function (b) { zpoiCmd(server, box + b) })
  if (deep) ['minecraft:coarse_dirt', 'minecraft:dirt', 'minecraft:gravel', 'minecraft:podzol'].forEach(function (b) {
    zpoiCmd(server, 'execute in minecraft:overworld run fill ' + x0 + ' ' + (y0 + 3) + ' ' + z0 + ' ' + x1 + ' ' + y1 + ' ' + z1 + ' minecraft:air replace ' + b)
  })
}
// Blend the site into the land: flat pad under the footprint, easing back to the natural ground over MARGIN blocks.
var ZPOI_MARGIN = 7
function zpoiTerraform(server, level, ox, oz, sx, sz, gy) {
  var M = ZPOI_MARGIN
  for (var x = ox - M; x < ox + sx + M; x++) for (var z = oz - M; z < oz + sz + M; z++) {
    var dx = x < ox ? ox - x : (x >= ox + sx ? x - (ox + sx - 1) : 0)
    var dz = z < oz ? oz - z : (z >= oz + sz ? z - (oz + sz - 1) : 0)
    var d = Math.sqrt(dx * dx + dz * dz)
    if (d > M) continue
    var h = zpoiGround(level, x, z)
    if (h === null) continue
    var w = d / M; w = w * w * (3 - 2 * w)                                // smoothstep 0 (pad) .. 1 (natural)
    var t = Math.round(gy + (h - gy) * w)
    if (t === h) continue
    var top = String(level.getBlock(x, h - 1, z).id)
    if (top.indexOf('water') >= 0 || top.indexOf('air') >= 0) top = 'minecraft:coarse_dirt'
    if (h > t) {                                                          // cut down
      zpoiCmd(server, 'execute in minecraft:overworld run fill ' + x + ' ' + t + ' ' + z + ' ' + x + ' ' + (h + 2) + ' ' + z + ' minecraft:air')
      zpoiCmd(server, 'execute in minecraft:overworld run setblock ' + x + ' ' + (t - 1) + ' ' + z + ' ' + top)
    } else {                                                              // build up
      if (t - 2 >= h) zpoiCmd(server, 'execute in minecraft:overworld run fill ' + x + ' ' + h + ' ' + z + ' ' + x + ' ' + (t - 2) + ' ' + z + ' minecraft:dirt')
      zpoiCmd(server, 'execute in minecraft:overworld run setblock ' + x + ' ' + (t - 1) + ' ' + z + ' ' + top)
    }
  }
}
function zpoiPlaceAt(server, level, p, cx, cz, deep) {
  var gy = zpoiGroundMedian(level, cx, cz, p)
  if (gy === null) return false
  var ox = cx - Math.floor(p.sx / 2), oz = cz - Math.floor(p.sz / 2), oy = gy - 1 - ZPOI.G
  var M = ZPOI_MARGIN
  zpoiClear(server, ox - M, gy - 2, oz - M, ox + p.sx + M, gy + 40, oz + p.sz + M, false)   // trees on and around the site
  if (deep) zpoiClear(server, ox - 1, gy, oz - 1, ox + p.sx, gy + 40, oz + p.sz, true)       // an older copy of this build
  zpoiStage = 'terraform'
  zpoiTerraform(server, level, ox, oz, p.sx, p.sz, gy)
  zpoiStage = 'place ' + ox + ' ' + oy + ' ' + oz
  var ok = zpoiCmd(server, 'execute in minecraft:overworld run place template zone:' + p.tpl + ' ' + ox + ' ' + oy + ' ' + oz)
  if (!ok) { console.warn('[zone] could not place ' + p.name + ' at ' + ox + ' ' + oy + ' ' + oz); return false }
  zpoiState.built[p.id] = { x: cx, z: cz, y: gy }
  zpoiSave(server)
  console.info('[zone] built ' + p.name + ' at ' + ox + ' ' + oy + ' ' + oz)
  if (global.zoneAlifeMovePoi) global.zoneAlifeMovePoi(p.name, cx, cz)
  return true
}
var zpoiWhy = {}
function zpoiReport(p, msg) {
  if (zpoiWhy[p.id] === msg) return
  zpoiWhy[p.id] = msg
  console.info('[zone] ' + p.name + ': ' + msg)
}
function zpoiBuild(server, level, p) {
  var tries = [[0, 0]]
  var rings = [16, 32, 48, 64, 80, 96]
  for (var r = 0; r < rings.length; r++) for (var a = 0; a < 12; a++)
    tries.push([Math.round(Math.cos(a * Math.PI / 6) * rings[r]), Math.round(Math.sin(a * Math.PI / 6) * rings[r])])
  var wet = 0, unloaded = 0, noGround = 0
  for (var t = 0; t < tries.length; t++) {
    var cx = Math.floor(p.x + tries[t][0]), cz = Math.floor(p.z + tries[t][1])
    zpoiStage = 'check ' + cx + ',' + cz
    var st = zpoiCheck(server, cx, cz, p)
    if (st === 'unloaded') { unloaded++; continue }
    if (st === 'wet') { wet++; continue }
    if (zpoiPlaceAt(server, level, p, cx, cz, false)) return true
    noGround++
  }
  zpoiReport(p, 'not built yet - spots checked: ' + tries.length + ', water: ' + wet + ', not loaded: ' + unloaded + ', no ground/place failed: ' + noGround)
  return false
}

ServerEvents.tick(function (event) {
  zpoiTick++
  if (zpoiTick % 40 !== 0) return
  var server = event.server
  try {
    if (!zpoiState) zpoiLoad(server)
    var level = server.getLevel('minecraft:overworld')
    var players = []
    server.players.forEach(function (pl) { if (String(pl.level.dimension).indexOf('overworld') >= 0) players.push(pl) })
    ZPOI.LIST.forEach(function (p) {
     try {
      var built = zpoiState.built[p.id]
      var cx = built ? built.x : p.x, cz = built ? built.z : p.z
      players.forEach(function (pl) {
        var d = Math.sqrt((pl.x - cx) * (pl.x - cx) + (pl.z - cz) * (pl.z - cz))
        if (!built && d < ZPOI.BUILD_DIST && zpoiTick % 100 === 0) { if (zpoiBuild(server, level, p)) built = zpoiState.built[p.id] }
        if (built && d < ZPOI.NAME_DIST) {
          var key = pl.username + '|' + p.id
          if (!zpoiShown[key] || zpoiTick - zpoiShown[key] > 20 * 60 * 5) {
            zpoiShown[key] = zpoiTick
            server.runCommandSilent('title ' + pl.username + ' times 10 50 20')
            server.runCommandSilent('title ' + pl.username + ' subtitle {"text":"' + p.name + '","color":"#D8B225"}')
            server.runCommandSilent('title ' + pl.username + ' title {"text":""}')
          }
        }
      })
     } catch (e1) {
      if (zpoiTick - zpoiLastErr > 400) { zpoiLastErr = zpoiTick; console.error('[zone] POI ' + p.name + ' failed at [' + zpoiStage + ']: ' + e1) }
     }
    })
  } catch (err) {
    if (!zpoiWarned) { zpoiWarned = true; console.error('[zone] POI builder failed at [' + zpoiStage + ']: ' + err) }
  }
})

ServerEvents.customCommand('zone_pois_status', function (event) {
  if (!zpoiState) zpoiLoad(event.server)
  ZPOI.LIST.forEach(function (p) {
    var b = zpoiState.built[p.id]
    event.player.tell(p.name + ': ' + (b ? 'built around ' + b.x + ', ' + b.z : 'not built yet (around ' + p.x + ', ' + p.z + ')'))
  })
})

// Stand at a built location and run this to rebuild it on the real ground (removes the old copy and trees in the way).
ServerEvents.customCommand('zone_poi_redo', function (event) {
  if (!zpoiState) zpoiLoad(event.server)
  var pl = event.player, best = null, bd = 1e9
  ZPOI.LIST.forEach(function (p) {
    var b = zpoiState.built[p.id]; if (!b) return
    var d = Math.sqrt((pl.x - b.x) * (pl.x - b.x) + (pl.z - b.z) * (pl.z - b.z))
    if (d < bd) { bd = d; best = p }
  })
  if (!best || bd > 80) { pl.tell('No built location within 80 blocks.'); return }
  var b = zpoiState.built[best.id]
  var level = event.server.getLevel('minecraft:overworld')
  var ok = zpoiPlaceAt(event.server, level, best, b.x, b.z, true)
  pl.tell(ok ? 'Rebuilt ' + best.name + ' on the ground.' : 'Could not rebuild ' + best.name + ' (stand closer so it is loaded).')
})

// Stand where you want it: builds the nearest not-yet-built location right here (any distance).
ServerEvents.customCommand('zone_poi_here', function (event) {
  if (!zpoiState) zpoiLoad(event.server)
  var pl = event.player, best = null, bd = 1e9
  ZPOI.LIST.forEach(function (p) {
    if (zpoiState.built[p.id]) return
    var d = Math.sqrt((pl.x - p.x) * (pl.x - p.x) + (pl.z - p.z) * (pl.z - p.z))
    if (d < bd) { bd = d; best = p }
  })
  if (!best) { pl.tell('Every location is already built. Use zone_poi_redo to rebuild one.'); return }
  var ok = zpoiPlaceAt(event.server, event.server.getLevel('minecraft:overworld'), best, Math.floor(pl.x), Math.floor(pl.z), false)
  pl.tell(ok ? 'Built ' + best.name + ' here.' : 'Could not build ' + best.name + ' here.')
})

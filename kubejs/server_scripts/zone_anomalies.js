// Anomaly fields (Slade): clusters of Anomaly Zone anomalies all over the map, like STALKER.
//  - The map is split into CELL x CELL squares. Each square may hold one field (decided by a fixed hash, so the
//    layout never changes). Sparse in the west, denser heading east, very dense around and inside the City.
//  - A field is built the first time a player comes near it, then it's just saved entities (no further cost).
//  - Anomalies drop artifacts on their own (anomalyzone-settings.json "artifact.*"), so every field is an artifact spot.
//  - Never inside the Bar, the Old Town, POIs, camps or story places (EXCLUDE + ZPOI list).
// Op commands: /kubejs custom_command zone_anomaly_info     (fields near you)
//              /kubejs custom_command zone_anomaly_here     (build a field where you stand)
//              /kubejs custom_command zone_anomaly_clear    (remove script-placed anomalies within 40 blocks)
var ZAN = {
  CELL: 160,
  BUILD_DIST: 110,                   // build a field when a player is this close to its centre
  CHANCE: [0.16, 0.65],              // chance a square has a field: [clean west, City edge] (ramp from zone_spawn_director)
  CHANCE_CITY: 0.85,
  COUNT: [[2, 3], [4, 6]],           // anomalies per field: [west min,max], [edge min,max]
  COUNT_CITY: [5, 8],
  SPREAD: [9, 16],                   // field radius
  FAMILIES: {
    thermo: ['thermo_anomaly', 'thermo_flare_anomaly', 'thermo_geyser_anomaly', 'thermo_pop_anomaly'],
    bio:    ['bio_anomaly', 'bio_bog_anomaly', 'bio_leech_anomaly', 'bio_spore_anomaly'],
    psi:    ['psi_anomaly', 'psi_electro_anomaly', 'psi_launch_anomaly', 'psi_morok_anomaly', 'psi_omut_anomaly'],
    rad:    ['rad_haze_anomaly', 'rad_rot_anomaly', 'rad_spark_anomaly', 'rad_vent_anomaly'],
    stasis: ['stasis_anomaly', 'psi_stasis_anomaly']
  },
  // family weights: west / east (ramp > 0.5) / city
  WEIGHTS: {
    west: { thermo: 35, bio: 35, rad: 20, stasis: 10 },
    east: { thermo: 25, bio: 20, rad: 25, psi: 20, stasis: 10 },
    city: { thermo: 20, bio: 10, rad: 30, psi: 30, stasis: 10 }
  },
  PROTO_CHANCE_CITY: 0.08,           // a city field sometimes holds a proto-artifact cluster too
  EXCLUDE: [
    { x: -1528, z: 94, r: 230 },      // the Bar
    { x: -1233, z: 22, r: 170 },      // Old Town
    { x: -1488, z: -140, r: 80 },     // Mountainview Chalet
    { x: -1380, z: 260, r: 70 },      // Lake Shore
    { x: -1400, z: 180, r: 60 },      // Lost Patrol
    { x: -271, z: 315, r: 90 },       // Military Base
    { x: 259, z: -503, r: 90 },       // The Armoury
    { x: -450, z: -700, r: 60 }       // Old Quarry
  ],
  POI_MARGIN: 70,
  // fixed starter fields 250-330 m from the Bar (the hashed layout leaves the starter area empty), one per direction
  STARTER: [
    { key: 's_ne', x: -1268, z: 244, n: 3, family: 'thermo' },
    { key: 's_s',  x: -1528, z: 394, n: 3, family: 'bio' },
    { key: 's_w',  x: -1828, z: 94,  n: 2, family: 'thermo' },
    { key: 's_n',  x: -1606, z: -196, n: 3, family: 'bio' }
  ],
  SEED: 7177
}
var zanTick = 0, zanWarned = {}, zanDone = null, zanFails = {}

function zanErr(k, e) { if (!zanWarned[k]) { zanWarned[k] = true; console.error('[zone] anomalies ' + k + ' failed: ' + e) } }
function zanCmd(srv, c) { return Number(srv.runCommandSilent(String(c))) || 0 }
function zanLoad(srv) {
  if (zanDone) return zanDone
  try { var raw = String(srv.persistentData.getString('zone_anomalies') || ''); zanDone = raw ? JSON.parse(raw) : {} } catch (e) { zanDone = {} }
  // one-off: squares visited while Math.PI was undefined (NaN positions) were wrongly saved as empty; forget them
  if (!srv.persistentData.getBoolean('zone_anomalies_pifix')) {
    Object.keys(zanDone).forEach(function (k) { if (zanDone[k] === 0) delete zanDone[k] })
    srv.persistentData.putBoolean('zone_anomalies_pifix', true); zanSave(srv)
  }
  return zanDone
}
function zanSave(srv) { srv.persistentData.putString('zone_anomalies', JSON.stringify(zanDone)) }
function zanHash(a, b, s) {
  var h = (Math.imul(a, 374761393) + Math.imul(b, 668265263) + Math.imul(s + ZAN.SEED, 1442695041)) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  h = h ^ (h >>> 16)
  return (h >>> 0) / 4294967296
}
function zanCity(x, z) { return typeof inCity === 'function' ? inCity(x, z) : false }
function zanRamp(x, z) { return typeof zsdRamp === 'function' ? zsdRamp(x, z) : 0 }
function zanExcluded(x, z) {
  for (var i = 0; i < ZAN.EXCLUDE.length; i++) { var e = ZAN.EXCLUDE[i]; if (Math.hypot(x - e.x, z - e.z) < e.r) return true }
  if (typeof ZPOI !== 'undefined') {
    for (var j = 0; j < ZPOI.LIST.length; j++) { var p = ZPOI.LIST[j]; if (Math.hypot(x - p.x, z - p.z) < ZAN.POI_MARGIN) return true }
  }
  return false
}
// the field of a square (or null): { key, x, z, n, family, proto }
function zanField(cx, cz) {
  var x = cx * ZAN.CELL + 20 + Math.floor(zanHash(cx, cz, 1) * (ZAN.CELL - 40))
  var z = cz * ZAN.CELL + 20 + Math.floor(zanHash(cx, cz, 2) * (ZAN.CELL - 40))
  var city = zanCity(x, z), t = zanRamp(x, z)
  var chance = city ? ZAN.CHANCE_CITY : ZAN.CHANCE[0] + (ZAN.CHANCE[1] - ZAN.CHANCE[0]) * t
  if (zanHash(cx, cz, 3) >= chance) return null
  if (zanExcluded(x, z)) return null
  var range = city ? ZAN.COUNT_CITY : [Math.round(ZAN.COUNT[0][0] + (ZAN.COUNT[1][0] - ZAN.COUNT[0][0]) * t),
                                       Math.round(ZAN.COUNT[0][1] + (ZAN.COUNT[1][1] - ZAN.COUNT[0][1]) * t)]
  var n = range[0] + Math.floor(zanHash(cx, cz, 4) * (range[1] - range[0] + 1))
  var w = ZAN.WEIGHTS[city ? 'city' : (t > 0.5 ? 'east' : 'west')]
  var total = 0, keys = Object.keys(w)
  keys.forEach(function (k) { total += w[k] })
  var r = zanHash(cx, cz, 5) * total, family = keys[0]
  for (var i = 0; i < keys.length; i++) { r -= w[keys[i]]; if (r <= 0) { family = keys[i]; break } }
  return { key: cx + ',' + cz, x: x, z: z, n: n, family: family, proto: city && zanHash(cx, cz, 6) < ZAN.PROTO_CHANCE_CITY }
}

function zanBuild(srv, f, refY) {
  var level = srv.getLevel('minecraft:overworld')
  if (zanCmd(srv, 'execute in minecraft:overworld if loaded ' + f.x + ' 0 ' + f.z) <= 0) return 0
  var list = ZAN.FAMILIES[f.family], placed = 0
  var spread = ZAN.SPREAD[0] + Math.random() * (ZAN.SPREAD[1] - ZAN.SPREAD[0])
  var want = f.n + (f.proto ? 1 : 0)
  for (var tries = 0; tries < want * 4 && placed < want; tries++) {
    var a = Math.random() * 3.141592653589793 * 2, d = Math.sqrt(Math.random()) * spread
    var x = Math.floor(f.x + Math.cos(a) * d), z = Math.floor(f.z + Math.sin(a) * d)
    if (zanCmd(srv, 'execute in minecraft:overworld if loaded ' + x + ' 0 ' + z) <= 0) continue
    var y = typeof groundAt === 'function' ? groundAt(level, x, refY, z) : null
    if (y === null) continue
    var mob = (f.proto && placed === 0) ? 'proto_artifact_cluster_anomaly' : list[Math.floor(Math.random() * list.length)]
    zanCmd(srv, 'execute in minecraft:overworld run summon anomalyzone:' + mob + ' ' + (x + 0.5) + ' ' + y + ' ' + (z + 0.5) + ' {Tags:["zone_anomaly"]}')
    placed++
  }
  return placed
}

function zanStep(srv) {
  var done = zanLoad(srv), changed = false
  srv.players.forEach(function (p) {
    if (!String(p.level.dimension).includes('overworld')) return
    var pcx = Math.floor(p.x / ZAN.CELL), pcz = Math.floor(p.z / ZAN.CELL)
    ZAN.STARTER.forEach(function (f) {
      if (done[f.key] !== undefined || Math.hypot(p.x - f.x, p.z - f.z) > ZAN.BUILD_DIST) return
      var n = zanBuild(srv, f, p.y)
      if (n > 0) { done[f.key] = [f.x, f.z, n, f.family]; changed = true; console.info('[zone] anomalies: ' + n + 'x ' + f.family + ' starter field at ' + f.x + ', ' + f.z) }
      else if ((zanFails[f.key] = (zanFails[f.key] || 0) + 1) > 12) { done[f.key] = 0; changed = true }
    })
    for (var dx = -1; dx <= 1; dx++) for (var dz = -1; dz <= 1; dz++) {
      var cx = pcx + dx, cz = pcz + dz, key = cx + ',' + cz
      if (done[key] !== undefined) continue
      var f = zanField(cx, cz)
      if (!f) { done[key] = 0; changed = true; continue }
      if (Math.hypot(p.x - f.x, p.z - f.z) > ZAN.BUILD_DIST) continue
      var n = zanBuild(srv, f, p.y)
      if (n > 0) {
        done[key] = [f.x, f.z, n, f.family]; changed = true
        console.info('[zone] anomalies: ' + n + 'x ' + f.family + ' field at ' + f.x + ', ' + f.z)
      } else if ((zanFails[key] = (zanFails[key] || 0) + 1) > 12) {
        done[key] = 0; changed = true                // nowhere to stand (lake, cliff): skip this square
      }
    }
  })
  if (changed) zanSave(srv)
}

ServerEvents.tick(function (event) {
  if (++zanTick % 100 !== 75) return       // every 5 s, offset from the other scripts
  try { zanStep(event.server) } catch (e) { zanErr('step', e) }
})

ServerEvents.customCommand('zone_anomaly_info', function (event) {
  var p = event.player
  if (!p) return
  var done = zanLoad(event.server), fields = 0, near = []
  Object.keys(done).forEach(function (k) {
    var v = done[k]
    if (!v) return
    fields++
    var d = Math.round(Math.hypot(p.x - v[0], p.z - v[1]))
    if (d < 400) near.push(v[3] + ' (' + v[2] + ') at ' + v[0] + ', ' + v[1] + ' - ' + d + ' m')
  })
  p.tell('[zone] ' + fields + ' anomaly fields built so far. Within 400 m: ' + (near.length ? near.join('; ') : 'none'))
})
ServerEvents.customCommand('zone_anomaly_here', function (event) {
  var p = event.player
  if (!p) return
  var t = zanRamp(p.x, p.z), city = zanCity(p.x, p.z)
  var fam = city ? 'psi' : (t > 0.5 ? 'rad' : 'thermo')
  var n = zanBuild(event.server, { x: Math.floor(p.x), z: Math.floor(p.z), n: 4, family: fam, proto: false }, p.y)
  p.tell('[zone] Built a ' + fam + ' field with ' + n + ' anomalies around you. Step back!')
})
ServerEvents.customCommand('zone_anomaly_clear', function (event) {
  var p = event.player
  if (!p) return
  var n = zanCmd(event.server, 'execute in minecraft:overworld positioned ' + p.x + ' ' + p.y + ' ' + p.z + ' run kill @e[tag=zone_anomaly,distance=..40]')
  p.tell('[zone] Removed ' + n + ' placed anomalies within 40 blocks.')
})

// The Deep: infected (Slade, 11/23). Extinction Z mobs live ONLY down here, in the dark parts of the facility level.
//  - Areas (AREAS): while a survival player is inside an area box, one spawn try every EVERY ticks: a dark spot
//    (block light <= MAX_LIGHT) on the floor, MIN_DIST..MAX_DIST blocks from every player in the area, until CAP
//    infected are alive in it. Weighted picks per area; boomers capped at 1 per area. Runners sometimes come in pairs.
//  - All of ours carry zone_scripted + zone_deep_inf (+ zdi_<kind>), stats set on summon (STATS).
//  - Clickers are near-blind (follow range 6) and hunt by sound: every half second each player in the Deep makes
//    noise (gunshot 28, sprint 14, walk 6, crouch 2, still 0). Clickers inside that radius get the player as target
//    and their follow range opens to 32 for HEAR_TICKS; then they go blind again. Gunshots also pull runners,
//    stalkers and boomers within 16 that have no target.
//  - Patient Zero (patient_zero_i, the big one) waits in wing A's lair: when a survival player comes into the
//    corridor in front of it and none is alive, he and two runners spawn at the back of the lair with a screech.
//    Cooldown PZ.COOLDOWN_MIN real minutes after he spawns (saved, survives restarts).
//  - Cleanup every 30 s: ours with no player within 96 blocks are removed (a Patient Zero removed that way is
//    available again after 5 min).
//  - Idles quietly if the Extinction Z mod isn't installed. Nothing in chat ever.
// Op: /kubejs custom_command zone_deep_inf_status   (counts per area, PZ timer)
//     /kubejs custom_command zone_deep_inf_clear    (removes all of ours)
//     /kubejs custom_command zone_deep_pz_reset     (Patient Zero available now)
var ZDI = {
  AREAS: [
    { name: 'maze', box: [207, -53, -637, 280, -45, -577], cap: 10, every: 100,
      pool: [['runner', 45], ['stalker', 25], ['clicker', 20], ['boomer', 10]] },
    { name: 'wing A', box: [213, -53, -570, 248, -45, -550], cap: 4, every: 160,
      pool: [['runner', 50], ['stalker', 30], ['clicker', 20]] }
  ],
  DEEP: [195, -64, -650, 310, -40, -470],   // where noise counts and cleanup looks
  MIN_DIST: 14, MAX_DIST: 36, MAX_LIGHT: 4, TRIES: 30, PAIR: 0.4,
  HEAR_TICKS: 200, BLIND: 6, HEARING: 32,
  NOISE: { shot: 28, sprint: 14, walk: 6, crouch: 2 },
  TAG: 'zone_deep_inf'
}
// health, attack damage, speed, follow range (vanilla zombie 20 / 3 / 0.23 / 35)
var ZDI_STATS = {
  runner:  { id: 'extinction:runner',          hp: 20,  dmg: 5, speed: 0.30, follow: 24 },
  stalker: { id: 'extinction:stalker',         hp: 35,  dmg: 7, speed: 0.29, follow: 20 },
  clicker: { id: 'extinction:soldier_clicker', hp: 40,  dmg: 8, speed: 0.24, follow: 6 },
  boomer:  { id: 'extinction:boomer',          hp: 50,  dmg: 5, speed: 0.20, follow: 16 },
  pz:      { id: 'extinction:patient_zero_i',  hp: 170, dmg: 9, speed: 0.26, follow: 32 }
}
var ZDI_PZ = {
  trigger: [214, -53, -562, 230, -45, -557],   // corridor in front of the lair
  lair: [220, -54, -556, 224, -46, -550],      // PZ + runners stand on the free floor spots nearest the back (z -550)
  COOLDOWN_MIN: 60, KEY: 'zone_deep_pz_next'
}
var zdiTick = 0, zdiWarned = false, zdiHasMod = null, zdiMade = 0
var zdiLast = {}          // player uuid -> { ammo, x, z }
var zdiHeard = {}         // clicker uuid -> tick it last heard something
var ZDI_ATTR = null, ZDI_LIGHT = null, ZDI_POS = null
function zdiErr(e) { if (!zdiWarned) { zdiWarned = true; console.error('[zone] deep infected: ' + e) } }
function zdiIn(b, x, y, z) { return x >= b[0] && x <= b[3] + 1 && y >= b[1] && y <= b[4] + 1 && z >= b[2] && z <= b[5] + 1 }
function zdiDist(a, b) { return Math.sqrt((a.x - b.x) * (a.x - b.x) + (a.y - b.y) * (a.y - b.y) + (a.z - b.z) * (a.z - b.z)) }
function zdiPlayable(p) {
  try { return String(p.level.dimension).indexOf('overworld') >= 0 && !p.isSpectator() && !p.isCreative() } catch (e) { return false }
}
function zdiModOk() {
  if (zdiHasMod !== null) return zdiHasMod
  try { zdiHasMod = !!Platform.isLoaded('extinction') } catch (e) { zdiHasMod = false }
  if (!zdiHasMod) console.info('[zone] deep infected: Extinction Z not installed, waiting')
  return zdiHasMod
}
function zdiInit() {
  if (ZDI_ATTR) return
  ZDI_ATTR = Java.loadClass('net.minecraft.world.entity.ai.attributes.Attributes')
  ZDI_LIGHT = Java.loadClass('net.minecraft.world.level.LightLayer')
  ZDI_POS = Java.loadClass('net.minecraft.core.BlockPos')
}
function zdiAir(level, x, y, z) {
  var id = String(level.getBlock(x, y, z).id)
  return id === 'minecraft:air' || id === 'minecraft:cave_air'
}
function zdiSolid(level, x, y, z) {
  var bl = level.getBlock(x, y, z), id = String(bl.id)
  if (id === 'minecraft:air' || id === 'minecraft:cave_air' || id.indexOf('water') >= 0 || id.indexOf('lava') >= 0) return false
  try { return bl.blockState.isSolidRender(level, bl.pos) } catch (e) { return true }
}
function zdiDark(level, x, y, z) {
  try { return level.getBrightness(ZDI_LIGHT.BLOCK, new ZDI_POS(x, y, z)) <= ZDI.MAX_LIGHT } catch (e) { return true }
}
function zdiNbt(kind) {
  var s = ZDI_STATS[kind]
  return '{Tags:["zone_scripted","' + ZDI.TAG + '","zdi_' + kind + '"],PersistenceRequired:' + (kind === 'pz' ? '1b' : '0b') +
    ',Health:' + s.hp + 'f,Attributes:[{Name:"minecraft:generic.max_health",Base:' + s.hp + 'd},' +
    '{Name:"minecraft:generic.attack_damage",Base:' + s.dmg + 'd},{Name:"minecraft:generic.movement_speed",Base:' + s.speed + 'd},' +
    '{Name:"minecraft:generic.follow_range",Base:' + s.follow + 'd}]}'
}
function zdiSummon(srv, kind, x, y, z) {
  srv.runCommandSilent('execute in minecraft:overworld run summon ' + ZDI_STATS[kind].id + ' ' + x + ' ' + y + ' ' + z + ' ' + zdiNbt(kind))
  zdiMade++
}
function zdiPick(pool, boomers) {
  var tot = 0, i
  for (i = 0; i < pool.length; i++) if (!(pool[i][0] === 'boomer' && boomers > 0)) tot += pool[i][1]
  var r = Math.random() * tot
  for (i = 0; i < pool.length; i++) {
    if (pool[i][0] === 'boomer' && boomers > 0) continue
    r -= pool[i][1]
    if (r <= 0) return pool[i][0]
  }
  return pool[0][0]
}
function zdiOurs(level, b) {
  var out = []
  level.getEntitiesWithin(AABB.of(b[0], b[1], b[2], b[3] + 1, b[4] + 1, b[5] + 1)).forEach(function (e) {
    try { if (e.isAlive() && e.getTags().contains(ZDI.TAG)) out.push(e) } catch (x) {}
  })
  return out
}
function zdiKind(e) {
  var k = ''
  try { e.getTags().forEach(function (t) { t = String(t); if (t.indexOf('zdi_') === 0) k = t.substring(4) }) } catch (x) {}
  return k
}
function zdiSpawnArea(srv, level, area) {
  var b = area.box, inside = []
  srv.players.forEach(function (p) { if (zdiPlayable(p) && zdiIn(b, p.x, p.y, p.z)) inside.push(p) })
  if (inside.length === 0) return
  var ours = zdiOurs(level, b)
  if (ours.length >= area.cap) return
  var boomers = 0
  ours.forEach(function (e) { if (zdiKind(e) === 'boomer') boomers++ })
  for (var t = 0; t < ZDI.TRIES; t++) {
    var x = b[0] + Math.floor(Math.random() * (b[3] - b[0] + 1))
    var z = b[2] + Math.floor(Math.random() * (b[5] - b[2] + 1))
    var near = 1e9
    inside.forEach(function (p) { var d = Math.hypot(p.x - x - 0.5, p.z - z - 0.5); if (d < near) near = d })
    if (near < ZDI.MIN_DIST || near > ZDI.MAX_DIST) continue
    for (var y = b[1]; y <= b[4] - 2; y++) {
      if (!zdiSolid(level, x, y, z) || !zdiAir(level, x, y + 1, z) || !zdiAir(level, x, y + 2, z)) continue
      if (!zdiDark(level, x, y + 1, z)) break
      var kind = zdiPick(area.pool, boomers)
      zdiSummon(srv, kind, x + 0.5, y + 1, z + 0.5)
      if (kind === 'runner' && ours.length + 1 < area.cap && Math.random() < ZDI.PAIR) {
        var dx = [1, -1, 0, 0], dz = [0, 0, 1, -1]
        for (var k = 0; k < 4; k++) {
          var x2 = x + dx[k], z2 = z + dz[k]
          if (zdiSolid(level, x2, y, z2) && zdiAir(level, x2, y + 1, z2) && zdiAir(level, x2, y + 2, z2)) { zdiSummon(srv, 'runner', x2 + 0.5, y + 1, z2 + 0.5); break }
        }
      }
      return
    }
  }
}
function zdiAmmo(p) {
  try {
    var st = p.mainHandItem
    if (!st || st.isEmpty()) return -1
    var tag = st.getTag()
    if (!tag || !tag.contains('GunCurrentAmmoCount')) return -1
    return tag.getInt('GunCurrentAmmoCount') + (tag.getBoolean('HasBulletInBarrel') ? 1 : 0)
  } catch (e) { return -1 }
}
// noise radius a player made since the last check
function zdiNoise(p) {
  var id = String(p.uuid), last = zdiLast[id], ammo = zdiAmmo(p), r = 0
  var moved = last ? Math.hypot(p.x - last.x, p.z - last.z) : 0
  if (last && ammo >= 0 && last.ammo >= 0 && ammo < last.ammo && String(p.mainHandItem.id) === last.item) r = ZDI.NOISE.shot
  else if (p.isSprinting()) r = ZDI.NOISE.sprint
  else if (moved > 0.6) r = p.isCrouching() ? ZDI.NOISE.crouch : ZDI.NOISE.walk
  zdiLast[id] = { ammo: ammo, x: p.x, z: p.z, item: String(p.mainHandItem.id) }
  return r
}
function zdiHearing(srv, level) {
  var loud = []
  srv.players.forEach(function (p) {
    if (!zdiPlayable(p) || !zdiIn(ZDI.DEEP, p.x, p.y, p.z)) return
    var r = zdiNoise(p)
    if (r > 0) loud.push({ p: p, r: r, shot: r === ZDI.NOISE.shot })
  })
  var ours = null
  if (loud.length > 0 || Object.keys(zdiHeard).length > 0) ours = zdiOurs(level, ZDI.DEEP)
  if (!ours) return
  ours.forEach(function (e) {
    var kind = zdiKind(e), id = String(e.uuid)
    if (kind === 'clicker') {
      var best = null, bd = 1e9
      loud.forEach(function (n) { var d = zdiDist(e, n.p); if (d <= n.r && d < bd) { bd = d; best = n.p } })
      var fr = e.getAttribute(ZDI_ATTR.FOLLOW_RANGE)
      if (best) {
        if (fr && fr.getBaseValue() < ZDI.HEARING) fr.setBaseValue(ZDI.HEARING)
        e.setTarget(best)
        zdiHeard[id] = zdiTick
      } else if (zdiHeard[id] !== undefined && zdiTick - zdiHeard[id] > ZDI.HEAR_TICKS) {
        if (fr) fr.setBaseValue(ZDI.BLIND)
        delete zdiHeard[id]
      }
    } else if (kind !== 'pz') {
      var tgt = null
      try { tgt = e.getTarget() } catch (x) {}
      if (tgt) return
      loud.forEach(function (n) { if (!tgt && n.shot && zdiDist(e, n.p) <= 16) { tgt = n.p; e.setTarget(n.p) } })
    }
  })
}
function zdiPz(srv, level) {
  var t = ZDI_PZ.trigger, hit = false
  srv.players.forEach(function (p) { if (zdiPlayable(p) && zdiIn(t, p.x, p.y, p.z)) hit = true })
  if (!hit) return
  var pd = srv.persistentData, now = Date.now()
  if (pd.contains(ZDI_PZ.KEY) && now < pd.getDouble(ZDI_PZ.KEY)) return
  var alive = false
  zdiOurs(level, ZDI.DEEP).forEach(function (e) { if (zdiKind(e) === 'pz') alive = true })
  if (alive) return
  var spots = zdiFloorSpots(level, ZDI_PZ.lair)
  if (spots.length === 0) { zdiErr('no floor in the lair'); return }
  spots.sort(function (a, b) { return b[2] - a[2] })
  pd.putDouble(ZDI_PZ.KEY, now + ZDI_PZ.COOLDOWN_MIN * 60000)
  var s = spots[0]
  zdiSummon(srv, 'pz', s[0], s[1], s[2])
  for (var i = 1; i < spots.length && i <= 2; i++) zdiSummon(srv, 'runner', spots[i][0], spots[i][1], spots[i][2])
  srv.runCommandSilent('execute in minecraft:overworld positioned ' + s[0] + ' ' + s[1] + ' ' + s[2] + ' run playsound scavenger:deep.screech hostile @a[distance=..48] ~ ~ ~ 1.6 0.8')
  console.info('[zone] deep infected: Patient Zero woke up in the lair')
}
// every free standing spot (solid below, 2 air) in a box, as [x+.5, y, z+.5]; one per column, the lowest
function zdiFloorSpots(level, b) {
  var out = []
  for (var x = b[0]; x <= b[3]; x++) for (var z = b[2]; z <= b[5]; z++) {
    for (var y = b[1]; y <= b[4] - 2; y++) {
      if (zdiSolid(level, x, y, z) && zdiAir(level, x, y + 1, z) && zdiAir(level, x, y + 2, z)) { out.push([x + 0.5, y + 1, z + 0.5]); break }
    }
  }
  return out
}
function zdiCleanup(srv, level) {
  var gone = 0
  zdiOurs(level, ZDI.DEEP).forEach(function (e) {
    var near = false
    srv.players.forEach(function (p) { if (zdiPlayable(p) && zdiDist(e, p) < 96) near = true })
    if (near) return
    if (zdiKind(e) === 'pz') srv.persistentData.putDouble(ZDI_PZ.KEY, Date.now() + 5 * 60000)
    delete zdiHeard[String(e.uuid)]
    e.discard(); gone++
  })
  if (gone > 0) console.info('[zone] deep infected: removed ' + gone + ' with nobody near')
}
ServerEvents.tick(function (event) {
  zdiTick++
  if (zdiTick % 10 !== 3) return
  try {
    if (!zdiModOk()) return
    zdiInit()
    var srv = event.server, level = srv.getLevel('minecraft:overworld')
    if (!level) return
    var anyone = false
    srv.players.forEach(function (p) { if (zdiPlayable(p) && zdiIn(ZDI.DEEP, p.x, p.y, p.z)) anyone = true })
    if (zdiTick % 600 === 3) zdiCleanup(srv, level)
    if (zdiTick % 1200 === 3 && zdiMade > 0) { console.info('[zone] deep infected: ' + zdiMade + ' spawned in the last minute'); zdiMade = 0 }
    if (!anyone) return
    zdiHearing(srv, level)
    if (zdiTick % 20 === 13) zdiPz(srv, level)
    ZDI.AREAS.forEach(function (a) { if (zdiTick % a.every < 10) zdiSpawnArea(srv, level, a) })
  } catch (err) { zdiErr(err) }
})
ServerEvents.customCommand('zone_deep_inf_status', function (event) {
  var p = event.player
  if (!p || !p.hasPermissions(2)) return
  try {
    var level = event.server.getLevel('minecraft:overworld'), parts = []
    ZDI.AREAS.forEach(function (a) { parts.push(a.name + ' ' + zdiOurs(level, a.box).length + '/' + a.cap) })
    var pd = event.server.persistentData, left = pd.contains(ZDI_PZ.KEY) ? Math.max(0, Math.round((pd.getDouble(ZDI_PZ.KEY) - Date.now()) / 60000)) : 0
    parts.push('PZ ' + (left > 0 ? 'in ' + left + ' min' : 'ready'))
    p.statusMessage = Text.of('Deep infected: ' + parts.join(', ')).color(0x8A8A8A)
  } catch (e) { zdiErr(e) }
})
ServerEvents.customCommand('zone_deep_inf_clear', function (event) {
  var p = event.player
  if (!p || !p.hasPermissions(2)) return
  var n = 0
  zdiOurs(event.server.getLevel('minecraft:overworld'), ZDI.DEEP).forEach(function (e) { e.discard(); n++ })
  zdiHeard = {}
  p.statusMessage = Text.of('Removed ' + n + ' infected').color(0x8A8A8A)
})
ServerEvents.customCommand('zone_deep_pz_reset', function (event) {
  var p = event.player
  if (!p || !p.hasPermissions(2)) return
  event.server.persistentData.remove(ZDI_PZ.KEY)
  p.statusMessage = Text.of('Patient Zero ready').color(0x8A8A8A)
})

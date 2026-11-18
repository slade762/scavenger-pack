// The Bar safe zone (Slade): no hostile mobs near the Bar, whatever brings them.
//  - Any hostile (monster-type mob, zombie or mutant) that tries to spawn within RADIUS of the Bar is stopped,
//    whatever the spawn reason (natural, mod spawners, reinforcements, conversions...). Ops' /summon and spawn eggs still work.
//  - Any hostile that walks in (drawn by gunfire, wandering over from the Lost Patrol, old saved zombies) is removed.
//  - Traders, scavengers and other NPCs (Custom NPCs, TaCZ NPCs) are never touched.
//  - Removals are logged to the console once a minute ("[zone] bar safe: removed ..."), so we can see what was getting in.
// Op: /kubejs custom_command zone_bar_safe_info
var ZBS = {
  CENTER: { x: -1528, z: 94 },
  RADIUS: 120,                  // Lost Patrol (-1400, 180) is ~155 away, just outside
  SWEEP_TICKS: 40,              // every 2 s
  KEEP_NS: ['customnpcs:', 'tacznpcs:', 'minecraft:player'],
  KEEP_TAGS: ['zone_keep'],
  ALLOW_TYPES: ['COMMAND', 'SPAWN_EGG'],
  EXTRA_HOSTILE: ['minecraft:zombie', 'minecraft:husk', 'minecraft:drowned', 'minecraft:zombie_villager', 'itz:zombified_stalker',
    'anomalyzone:zombified_raider', 'itz:boar', 'itz:snork', 'itz:psydog', 'itz:bloodsucker', 'itz:chimera', 'itz:armored_elk']
}
var zbsTick = 0, zbsWarned = {}, zbsLog = {}, zbsTotal = 0

function zbsCall(o, names) {
  for (var i = 0; i < names.length; i++) { if (o && typeof o[names[i]] === 'function') return o[names[i]]() }
  return undefined
}
function zbsErr(k, e) { if (!zbsWarned[k]) { zbsWarned[k] = true; console.error('[zone] bar safe ' + k + ' failed: ' + e) } }
function zbsInside(x, z) { return Math.hypot(x - ZBS.CENTER.x, z - ZBS.CENTER.z) < ZBS.RADIUS }
function zbsHostile(e) {
  var id = String(zbsCall(e, ['getEncodeId', 'm_20078_']))
  if (!id || id === 'null') return false
  for (var i = 0; i < ZBS.KEEP_NS.length; i++) if (id.indexOf(ZBS.KEEP_NS[i]) === 0) return false
  if (ZBS.EXTRA_HOSTILE.indexOf(id) >= 0) return true
  try {
    var cat = String(zbsCall(zbsCall(e, ['getType', 'm_6095_']), ['getCategory', 'm_20674_'])).toLowerCase()
    if (cat.indexOf('monster') >= 0) return true
  } catch (err) { zbsErr('category', err) }
  return false
}
function zbsKept(e) {
  try {
    var tags = zbsCall(e, ['getTags', 'm_19880_'])
    for (var i = 0; i < ZBS.KEEP_TAGS.length; i++) if (tags.contains(ZBS.KEEP_TAGS[i])) return true
  } catch (err) {}
  return false
}

// ---------------------------------------------------------------- stop spawns
EntityEvents.checkSpawn(function (event) {
  var deny = false
  try {
    if (!String(event.level.dimension).includes('overworld')) return
    if (ZBS.ALLOW_TYPES.indexOf(String(event.type)) >= 0) return
    if (!zbsInside(event.x, event.z)) return
    if (zbsHostile(event.entity)) { deny = true; zbsCall(event.entity, ['discard', 'm_146870_']) }   // discard: cancel alone doesn't stop natural spawns
  } catch (err) { zbsErr('spawn check', err) }
  if (deny) event.cancel()          // outside the try: cancel() works by throwing
})

// ---------------------------------------------------------------- stop them joining the world
// checkSpawn doesn't see every natural spawn (cave spawns got through), so this is the real gate: any untagged hostile
// entering the world inside the Bar zone (fresh spawn or loaded from a saved chunk) is refused. Script-summoned mobs
// carry zone_* tags and are left to the sweep below. Also: untagged zombies anywhere in the clean west (no zombies
// there by design, see zone_spawn_director.js CLEAN_DIST).
var zbsJoinLog = 0
EntityEvents.spawned(function (event) {
  var deny = false
  try {
    var e = event.entity
    if (!String(event.level.dimension).includes('overworld')) return
    var tags = zbsCall(e, ['getTags', 'm_19880_'])
    if (tags && !tags.isEmpty()) return
    var id = String(zbsCall(e, ['getEncodeId', 'm_20078_']))
    var x = Number(zbsCall(e, ['getX', 'm_20185_'])), z = Number(zbsCall(e, ['getZ', 'm_20189_']))
    if (zbsInside(x, z)) deny = zbsHostile(e)
    else if (typeof ZOMBIES !== 'undefined' && ZOMBIES[id] && typeof zsdRamp === 'function' && typeof inCity === 'function' &&
             !inCity(x, z) && zsdRamp(x, z) <= 0) deny = true
  } catch (err) { zbsErr('join gate', err) }
  if (deny) { zbsJoinLog++; event.cancel() }   // outside the try: cancel() works by throwing
})

// ---------------------------------------------------------------- remove walk-ins
ServerEvents.tick(function (event) {
  if (++zbsTick % ZBS.SWEEP_TICKS !== 0) return
  var srv = event.server
  try {
    var near = false
    srv.players.forEach(function (p) {
      if (String(p.level.dimension).includes('overworld') && Math.hypot(p.x - ZBS.CENTER.x, p.z - ZBS.CENTER.z) < ZBS.RADIUS + 160) near = true
    })
    if (near) {
      var level = srv.getLevel('minecraft:overworld'), c = ZBS.CENTER, r = ZBS.RADIUS
      var gone = []
      level.getEntitiesWithin(AABB.of(c.x - r, -64, c.z - r, c.x + r, 320, c.z + r)).forEach(function (e) {
        if (!zbsInside(e.x, e.z) || !zbsHostile(e) || zbsKept(e)) return
        gone.push(e)
      })
      gone.forEach(function (e) {
        var key = String(zbsCall(e, ['getEncodeId', 'm_20078_'])) + ' @ ' + Math.round(e.x / 8) * 8 + ' ' + Math.round(e.y / 8) * 8 + ' ' + Math.round(e.z / 8) * 8
        try { var t = zbsCall(e, ['getTags', 'm_19880_']); if (t.contains('zone_turned')) key += ' (Lost Patrol)'; else if (t.contains('zone_encounter')) key += ' (encounter)'; else if (t.contains('zone_lair')) key += ' (lair)' } catch (err) {}
        zbsLog[key] = (zbsLog[key] || 0) + 1
        zbsTotal++
        zbsCall(e, ['discard', 'm_146870_'])
      })
    }
    if (zbsTick % 1200 === 0) {
      if (zbsJoinLog) { console.info('[zone] bar safe: blocked ' + zbsJoinLog + ' hostiles from spawning'); zbsJoinLog = 0 }
      var keys = Object.keys(zbsLog)
      if (keys.length) {
        console.info('[zone] bar safe: removed ' + keys.map(function (k) { return zbsLog[k] + 'x ' + k }).join(', ').slice(0, 600))
        zbsLog = {}
      }
    }
  } catch (err) { zbsErr('sweep', err) }
})

ServerEvents.customCommand('zone_bar_safe_info', function (event) {
  var p = event.player
  if (!p) return
  var d = Math.round(Math.hypot(p.x - ZBS.CENTER.x, p.z - ZBS.CENTER.z))
  p.tell('[zone] Bar safe zone: radius ' + ZBS.RADIUS + ', you are ' + d + ' blocks from the centre (' + (d < ZBS.RADIUS ? 'inside' : 'outside') +
    '). Hostiles removed since restart: ' + zbsTotal + '.')
})

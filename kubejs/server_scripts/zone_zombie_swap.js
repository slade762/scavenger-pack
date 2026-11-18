// Zone: modded zombies become plain vanilla zombies (their textures live on as zombie variants in the zone_ui pack).
// BadMobs stops them spawning naturally; this catches any that still appear (old chunks, structures, commands).
// Where zombies aren't allowed (the Bar safe zone, and the clean west where the spawn director allows none) the
// modded zombie is simply removed instead of being replaced.
// Once a minute the console logs what was swapped/dropped: "[zone] zombie swap: ..."
const ZZS_SWAP = { 'itz:zombified_stalker': true, 'anomalyzone:zombified_raider': true }
var zzsLog = {}, zzsTick = 0

function zzsCall(o, names) {
  for (var i = 0; i < names.length; i++) { if (typeof o[names[i]] === 'function') return o[names[i]]() }
  return undefined
}
function zzsAllowed(dim, x, z) {
  if (dim.indexOf('overworld') < 0) return true
  if (typeof zbsInside === 'function' && zbsInside(x, z)) return false          // zone_bar_safe.js
  if (typeof inCity === 'function' && inCity(x, z)) return true                // zone_spawn_director.js
  if (typeof zsdRamp === 'function' && zsdRamp(x, z) <= 0) return false
  return true
}

EntityEvents.spawned(event => {
  const e = event.entity
  const id = String(e.type)
  if (!ZZS_SWAP[id]) return
  // Anomaly Zone's PDA jobs spawn tagged ones (lab test subjects): leave those alone, or the job keeps
  // spawning replacements forever (it counts its tagged subjects, and the swapped zombies have no tag).
  const zzsTags = zzsCall(e, ['getTags', 'm_19880_'])
  if (zzsTags && !zzsTags.isEmpty()) return
  const x = Number(zzsCall(e, ['getX', 'm_20185_'])), y = Number(zzsCall(e, ['getY', 'm_20186_'])), z = Number(zzsCall(e, ['getZ', 'm_20189_']))
  const dim = String(event.level.dimension)
  const server = event.server
  var ok = true
  try { ok = zzsAllowed(dim, x, z) } catch (err) {}
  var key = id + (ok ? ' swapped' : ' dropped') + ' near ' + Math.round(x / 50) * 50 + ',' + Math.round(z / 50) * 50
  zzsLog[key] = (zzsLog[key] || 0) + 1
  if (ok) {
    server.scheduleInTicks(1, () => {
      server.runCommandSilent(`execute in ${dim} run summon minecraft:zombie ${x.toFixed(2)} ${y.toFixed(2)} ${z.toFixed(2)}`)
    })
  }
  event.cancel()
})

ServerEvents.tick(event => {
  if (++zzsTick % 1200 !== 0) return
  var keys = Object.keys(zzsLog)
  if (!keys.length) return
  console.info('[zone] zombie swap: ' + keys.map(k => zzsLog[k] + 'x ' + k).join(', '))
  zzsLog = {}
})

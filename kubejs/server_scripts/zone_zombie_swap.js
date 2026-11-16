// Zone: modded zombies become plain vanilla zombies (their textures live on as zombie variants in the zone_ui pack).
// BadMobs stops them spawning naturally; this catches any that still appear (old chunks, structures, commands).
const ZZS_SWAP = { 'itz:zombified_stalker': true, 'anomalyzone:zombified_raider': true }

function zzsCall(o, names) {
  for (var i = 0; i < names.length; i++) { if (typeof o[names[i]] === 'function') return o[names[i]]() }
  return undefined
}

EntityEvents.spawned(event => {
  const e = event.entity
  if (!ZZS_SWAP[String(e.type)]) return
  const x = Number(zzsCall(e, ['getX', 'm_20185_'])), y = Number(zzsCall(e, ['getY', 'm_20186_'])), z = Number(zzsCall(e, ['getZ', 'm_20189_']))
  const dim = String(event.level.dimension)
  const server = event.server
  server.scheduleInTicks(1, () => {
    server.runCommandSilent(`execute in ${dim} run summon minecraft:zombie ${x.toFixed(2)} ${y.toFixed(2)} ${z.toFixed(2)}`)
  })
  event.cancel()
})

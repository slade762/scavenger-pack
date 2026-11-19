// Zone: swap the city's jungle biome for plains (lighter on performance). Slade.
// Run from the panel console:  kubejs custom_command zone_city_biome
// Dead grass for the level-4 City:  kubejs custom_command zone_city_deadgrass  (whole box -> zone:dead_city, brown-green grass)
// Works in 64x64 tiles: forceload a tile, fillbiome it, unload it. ~1 tile per second.

var ZCB = { minX: -336, maxX: 719, minZ: -528, maxZ: 623, size: 64, biome: 'minecraft:plains' }
let zcbJob = null

function zcbTiles() {
  var out = []
  for (let x = ZCB.minX; x <= ZCB.maxX; x += ZCB.size)
    for (let z = ZCB.minZ; z <= ZCB.maxZ; z += ZCB.size)
      out.push([x, z, Math.min(x + ZCB.size - 1, ZCB.maxX), Math.min(z + ZCB.size - 1, ZCB.maxZ)])
  return out
}

function zcbStep(server) {
  var j = zcbJob, tiles = j.tiles, i = j.i
  var fl = (q, mode) => server.runCommandSilent('execute in minecraft:overworld run forceload ' + mode + ' ' + q[0] + ' ' + q[1] + ' ' + q[2] + ' ' + q[3])
  if (i < tiles.length) fl(tiles[i], 'add')
  if (i >= 1 && i - 1 < tiles.length) {
    var tt = tiles[i - 1]
    var r = server.runCommandSilent('execute in minecraft:overworld run fillbiome ' + tt[0] + ' -64 ' + tt[1] + ' ' + tt[2] + ' 319 ' + tt[3] + ' ' + j.biome + (j.filter ? ' replace ' + j.filter : ''))
    var n = Number(r) || 0
    if (n > 0) { j.ok++; j.changed += n } else j.failed.push(tt)
  }
  if (i >= 2 && i - 2 < tiles.length) fl(tiles[i - 2], 'remove')
  j.i++
  if (j.i % 25 === 0) console.info('[ZCB] pass ' + j.pass + ': ' + Math.min(j.i, tiles.length) + '/' + tiles.length + ' tiles, ' + j.ok + ' changed')
  if (j.i > tiles.length + 1) {
    console.info('[ZCB] pass ' + j.pass + ' done: ' + j.ok + ' tiles changed (' + j.changed + ' cells), ' + j.failed.length + ' unchanged')
    if (j.failed.length && j.pass < 2) zcbJob = { tiles: j.failed, i: 0, ok: 0, changed: 0, failed: [], pass: j.pass + 1, wait: 0, biome: j.biome, filter: j.filter }
    else {
      server.runCommandSilent('gamerule commandModificationBlockLimit 32768')
      zcbJob = null
      console.info('[ZCB] finished. Rejoin to see the new biome colours.')
    }
  }
}

ServerEvents.tick(e => {
  if (!zcbJob) return
  if (++zcbJob.wait < 20) return
  zcbJob.wait = 0
  try { zcbStep(e.server) } catch (err) { console.error('[ZCB] failed: ' + err); zcbJob = null }
})

ServerEvents.customCommand('zone_city_biome_stop', e => { zcbJob = null; console.info('[ZCB] stopped') })

ServerEvents.customCommand('zone_city_biome', e => {
  if (zcbJob) { console.info('[ZCB] already running'); return }
  e.server.runCommandSilent('gamerule commandModificationBlockLimit 2000000')
  var tiles = zcbTiles()
  zcbJob = { tiles: tiles, i: 0, ok: 0, changed: 0, failed: [], pass: 1, wait: 0, biome: ZCB.biome, filter: '#minecraft:is_jungle' }
  console.info('[ZCB] starting: ' + tiles.length + ' tiles -> ' + ZCB.biome)
})

ServerEvents.customCommand('zone_city_deadgrass', e => {
  if (zcbJob) { console.info('[ZCB] already running'); return }
  e.server.runCommandSilent('gamerule commandModificationBlockLimit 2000000')
  var tiles = zcbTiles()
  zcbJob = { tiles: tiles, i: 0, ok: 0, changed: 0, failed: [], pass: 1, wait: 0, biome: 'zone:dead_city', filter: null }
  console.info('[ZCB] starting: ' + tiles.length + ' tiles -> zone:dead_city')
})

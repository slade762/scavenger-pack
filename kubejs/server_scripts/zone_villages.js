// Villages (Slade): no villagers or iron golems in the Zone. Every villager becomes an armed Stalker
// (TaCZ NPC, Scavenger loadout - friendly to players) and iron golems never appear.
// Works on new villages and on old ones as their chunks load.
var ZVL = { NAMES: ['Stalker', 'Stalker', 'Stalker', 'Drifter', 'Loner'] }

EntityEvents.spawned(function (event) {
  var e = event.entity, type = String(e.type)
  if (type === 'minecraft:iron_golem') { event.cancel(); return }
  if (type !== 'minecraft:villager') return
  var x = e.x, y = e.y, z = e.z
  var dim = String(event.level.dimension)
  var server = event.server
  var nm = ZVL.NAMES[Math.floor(Math.random() * ZVL.NAMES.length)]
  server.scheduleInTicks(1, function () {
    server.runCommandSilent('execute in ' + dim + ' run summon tacznpcs:npc ' + x.toFixed(2) + ' ' + y.toFixed(2) + ' ' + z.toFixed(2) +
      ' {template:"scavengers",CustomName:\'{"text":"' + nm + '"}\',PersistenceRequired:1b,Tags:["zone_vil"]}')
  })
  event.cancel()
})

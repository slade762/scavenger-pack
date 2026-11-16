// Anomaly Zone traders at the Bar (Slade).
// Stand on the spot, face the way the trader should face, then run one of:
//   /kubejs custom_command zone_trader_seller     (sells gear, ammo, meds)
//   /kubejs custom_command zone_trader_buyer      (buys loot and artifacts)
//   /kubejs custom_command zone_trader_barter     (swaps items)
//   /kubejs custom_command zone_trader_gunsmith   (guns and upgrades)
//   /kubejs custom_command zone_trader_remove     (removes the trader within 2 blocks of you)
// They're invulnerable, never despawn and count as Scavengers.
var ZTR = { seller: 0, buyer: 1, barter: 2, gunsmith: 3 }
Object.keys(ZTR).forEach(function (role) {
  ServerEvents.customCommand('zone_trader_' + role, function (event) {
    var p = event.player
    if (!p) return
    var x = Math.floor(p.x) + 0.5, y = Math.floor(p.y), z = Math.floor(p.z) + 0.5
    var yaw = Math.round(p.yaw * 10) / 10
    event.server.runCommandSilent('execute in ' + p.level.dimension + ' run summon anomalyzone:trader_npc ' + x + ' ' + y + ' ' + z +
      ' {TraderRole:' + ZTR[role] + ',PersistenceRequired:1b,Invulnerable:1b,Rotation:[' + yaw + 'f,0f],Tags:["zone_trader"]}')
    p.tell(Text.of('Placed a ' + role + ' at ' + Math.floor(x) + ' ' + y + ' ' + Math.floor(z) + '. Step off the spot.').color(0x9BD86A))
  })
})
ServerEvents.customCommand('zone_trader_remove', function (event) {
  var p = event.player
  if (!p) return
  event.server.runCommandSilent('execute as ' + p.username + ' at @s run kill @e[type=anomalyzone:trader_npc,distance=..2,limit=1,sort=nearest]')
  p.tell(Text.of('Removed the nearest trader (if there was one within 2 blocks).').color(0xD8B225))
})

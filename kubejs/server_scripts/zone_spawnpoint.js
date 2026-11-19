// Spawn inside the Bar (Slade).
// Minecraft always lifts world-spawn players up to the surface. This puts new players, and anyone who
// respawns without a bed, at the exact world spawn block instead (set it with /setworldspawn while
// standing inside the Bar).
function zspTo(p) {
  var sp = p.server.overworld().getSharedSpawnPos()
  p.server.runCommandSilent('execute in minecraft:overworld run tp ' + p.username + ' ' + (sp.x + 0.5) + ' ' + sp.y + ' ' + (sp.z + 0.5))
}
PlayerEvents.loggedIn(function (event) {
  try {
    var p = event.player
    if (p.persistentData.getBoolean('zone_spawned')) return
    p.persistentData.putBoolean('zone_spawned', true)
    zspTo(p)
    zspStarterKit(p)
  } catch (e) { console.error('[zone] first spawn failed: ' + e) }
})

// Starter kit for brand-new players: Rookie chest, legs and boots worn, plus a loaded PM
// with two spare mags (16 rounds of 9x18; TaCZ 1.1.8 has no separate magazine items).
function zspStarterKit(p) {
  var n = p.username
  var run = function (c) { p.server.runCommandSilent(c) }
  run('item replace entity ' + n + ' armor.chest with itz:rookie_chestplate')
  run('item replace entity ' + n + ' armor.legs with itz:rookie_leggings')
  run('item replace entity ' + n + ' armor.feet with itz:rookie_boots')
  run('give ' + n + ' tacz:modern_kinetic_gun{GunId:"ra1k:pm",GunFireMode:"SEMI",GunCurrentAmmoCount:8,HasBulletInBarrel:1b} 1')
  run('give ' + n + ' tacz:ammo{AmmoId:"tacz:9x18"} 16')
}

// One-off gifts, given once per player the next time they log in.
var ZSP_GIFTS = {
  'Laverabby': { flag: 'zone_gift_bunny_mask', item: 'zone_tactical_anims:bunny_mask' }
}
PlayerEvents.loggedIn(function (event) {
  try {
    var p = event.player
    var g = ZSP_GIFTS[p.username]
    if (!g || p.persistentData.getBoolean(g.flag)) return
    p.persistentData.putBoolean(g.flag, true)
    p.server.runCommandSilent('give ' + p.username + ' ' + g.item + ' 1')
    p.tell(Text.lightPurple('A gift for you: your Mask-1Sh (Bunny).'))
  } catch (e) { console.error('[zone] gift failed: ' + e) }
})
PlayerEvents.respawned(function (event) {
  try {
    var p = event.player
    if (event.endConquered) return
    if (p.getRespawnPosition() != null) return   // has a bed / respawn anchor
    zspTo(p)
  } catch (e) { console.error('[zone] respawn placement failed: ' + e) }
})

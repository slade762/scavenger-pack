// Plentiful ammo (Slade) - early-game setting so new players can spray and still stay stocked.
// 1) Killing a bandit/NPC drops ammo for the gun the killer is holding.
// 2) Killing a zombie sometimes drops a little ammo for it.
// 3) The ammo crate at the Bar (any block tagged by /kubejs custom_command zone_ammo_crate_here) hands out mags.
// Tune the numbers below; lower them later when ammo should get scarce.
var ZAMMO = {
  NPC_MAGS: 1,          // magazines' worth per NPC kill (a full mag again, Ward 11/21; was 0.5)
  ZOMBIE_CHANCE: 0.35,  // chance a zombie drops ammo
  ZOMBIE_MAGS: 0.5,     // magazines' worth per zombie drop
  CRATE_MAGS: 4,        // magazines per crate use
  CRATE_COOLDOWN: 20 * 60 * 5, // ticks between crate uses per player (5 min)
  SHOTGUN_MULT: 2,      // shotgun drops under a full mag count double (small tubes made half a mag ~2 shells)
  SHOTGUN_MIN: 4,       // and never fewer than this many shells per drop (crate excluded)
  // per-caliber tuning for DROPS from kills (not the crate): ammo id without the namespace -> multiplier. Ward tunes these from feedback.
  CALIBER: { '545x39': 0.5 }
}
var zammoJ = null
function zammoJava() {
  if (!zammoJ) zammoJ = {
    api: Java.loadClass('com.tacz.guns.api.TimelessAPI'),
    iGun: Java.loadClass('com.tacz.guns.api.item.IGun'),
    builder: Java.loadClass('com.tacz.guns.api.item.builder.AmmoItemBuilder')
  }
  return zammoJ
}
// Ammo stacks for the gun in this player's main hand, about `mags` magazines' worth. [] if not a gun.
function zammoFor(p, mags, drop) {
  var out = []
  try {
    var J = zammoJava()
    var stack = p.getMainHandItem()
    var gun = J.iGun.getIGunOrNull(stack)
    if (gun == null) return out
    var idx = J.api.getCommonGunIndex(gun.getGunId(stack))
    if (!idx.isPresent()) return out
    var data = idx.get().getGunData()
    var per = Math.max(1, data.getAmmoAmount())
    var ammoId = String(data.getAmmoId())
    if (drop) { var cal = ZAMMO.CALIBER[ammoId.substring(ammoId.indexOf(':') + 1)]; if (cal !== undefined) mags = mags * cal }
    var total = Math.max(1, Math.round(per * mags))
    var shotgun = String(idx.get().getType()) === 'shotgun' || ammoId.indexOf('12g') >= 0
    if (shotgun && mags < ZAMMO.CRATE_MAGS) total = Math.max(ZAMMO.SHOTGUN_MIN, total)
    if (shotgun && mags < 1) total = Math.max(ZAMMO.SHOTGUN_MIN, Math.round(per * mags * ZAMMO.SHOTGUN_MULT))
    while (total > 0) {
      var n = Math.min(total, 64)
      out.push(J.builder.create().setId(data.getAmmoId()).setCount(n).build())
      total -= n
    }
  } catch (e) { console.error('[zone] ammo lookup failed: ' + e) }
  return out
}
function zammoDrop(entity, stacks) {
  stacks.forEach(function (s) { entity.block.popItem(s) })
}
EntityEvents.death(function (event) {
  try {
    var e = event.entity
    var src = event.source.player
    if (!src) return
    var type = String(e.type)
    if (type.indexOf('tacznpcs:') === 0 || type.indexOf('customnpcs:') === 0 || type.indexOf('itz:bandit') >= 0) {
      zammoDrop(e, zammoFor(src, ZAMMO.NPC_MAGS, true))
    } else if (type.indexOf('zombie') >= 0 || type === 'minecraft:husk' || type === 'minecraft:drowned') {
      if (Math.random() < ZAMMO.ZOMBIE_CHANCE) zammoDrop(e, zammoFor(src, ZAMMO.ZOMBIE_MAGS, true))
    }
  } catch (err) { console.error('[zone] ammo drop failed: ' + err) }
})
// Ammo crate: right-click a block marked as one.
BlockEvents.rightClicked(function (event) {
  var cancel = false   // cancelling throws; doing it inside the try logged an error on every use, so it happens in finally
  try {
    if (String(event.hand) != 'MAIN_HAND') return
    var b = event.block
    var key = b.x + ',' + b.y + ',' + b.z
    var crates = event.server.persistentData.getCompound('zone_ammo_crates')
    if (!crates.contains(key)) return
    var p = event.player
    var now = event.server.tickCount
    var last = p.persistentData.getInt('zone_ammo_crate_t')
    if (last > 0 && now - last < ZAMMO.CRATE_COOLDOWN && now >= last) {
      var mins = Math.ceil((ZAMMO.CRATE_COOLDOWN - (now - last)) / 1200)
      p.statusMessage = Text.of('The crate is picked clean. Try again in ' + mins + ' min.').color(0xD8B225)
      cancel = true; return
    }
    var stacks = zammoFor(p, ZAMMO.CRATE_MAGS)
    if (stacks.length === 0) { p.statusMessage = Text.of('Hold the gun you want ammo for.').color(0xD8B225); cancel = true; return }
    stacks.forEach(function (s) { p.give(s) })
    p.persistentData.putInt('zone_ammo_crate_t', now)
    p.statusMessage = Text.of('You grab a few mags from the crate.').color(0x9BD86A)
    cancel = true
  } catch (err) { console.error('[zone] ammo crate failed: ' + err) }
  finally { if (cancel) event.cancel() }
})
// Mark the block you're looking at as an ammo crate: /kubejs custom_command zone_ammo_crate_here
ServerEvents.customCommand('zone_ammo_crate_here', function (event) {
  var p = event.player
  if (!p) return
  var hit = p.rayTrace(6, false)
  if (!hit || !hit.block) { p.tell('Look at the crate block first.'); return }
  var b = hit.block
  var crates = event.server.persistentData.getCompound('zone_ammo_crates')
  crates.putBoolean(b.x + ',' + b.y + ',' + b.z, true)
  event.server.persistentData.put('zone_ammo_crates', crates)
  p.tell('Ammo crate set at ' + b.x + ' ' + b.y + ' ' + b.z)
})

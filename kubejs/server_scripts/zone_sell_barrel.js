// Old Mole's Sell Barrel (Slade).
// A real barrel: put loot in (straight from your backpack with Backpack Side GUI), close it,
// and Old Mole pays rubles (PDA balance) for everything he buys; anything he doesn't buy stays.
var ZSB = {
  POS: { x: -1527, y: 83, z: 93 },
  RATE: 500,                        // rubles per coupon (prices below are in coupons)
  AZ_SHARE: 0.75,                   // artifacts/junk: Old Mole pays 75% of the Valhalla buyer's base price
  // item id (+ GunId for TaCZ guns) -> coupons
  GUNS: { 'ra1k:pm': 60, 'fzbe:izh18_0_0': 50, 'ra1k:m870_obrez': 64, 'ra1k:mp155': 100, 'ra1k:aks74u': 150,
          'ra1k:ak74': 250, 'ra1k:fort12': 100, 'tacz:sks_tactical': 250 },
  ITEMS: { 'itz:rookie_respirator': 30, 'itz:rookie_chestplate': 30, 'itz:rookie_leggings': 30, 'itz:rookie_boots': 30 }
}

function zsbCall(o, names, a, b) {
  for (var i = 0; i < names.length; i++) {
    var f = o[names[i]]
    if (typeof f === 'function') return a === undefined ? f.call(o) : (b === undefined ? f.call(o, a) : f.call(o, a, b))
  }
  return undefined
}
var zsbAz = null
function zsbPrice(stack) {          // rubles for ONE item, 0 = not bought
  var id = String(stack.id)
  if (ZSB.ITEMS[id] !== undefined) return ZSB.ITEMS[id] * ZSB.RATE
  if (id === 'tacz:modern_kinetic_gun') {
    var tag = stack.nbt
    var gid = tag ? String(zsbCall(tag, ['getString', 'm_128461_'], 'GunId')) : ''
    if (ZSB.GUNS[gid] !== undefined) return ZSB.GUNS[gid] * ZSB.RATE
  }
  try {
    if (!zsbAz) zsbAz = Java.loadClass('com.anomalyzone.npc.TraderNpcEntity')
    var base = zsbAz.getSellBasePrice(stack)
    if (base !== null && base !== undefined && Number(base) > 0) return Math.floor(Number(base) * ZSB.AZ_SHARE)
  } catch (e) {}
  return 0
}
function zsbName(stack) {
  try { return String(stack.hoverName.string) } catch (e) { return String(stack.id) }
}

BlockEvents.rightClicked(event => {
  var b = event.block
  if (b.x !== ZSB.POS.x || b.y !== ZSB.POS.y || b.z !== ZSB.POS.z) return
  if (String(b.id) !== 'minecraft:barrel') return
  event.player.tell(Text.gray('Sell barrel: put guns, Rookie gear, artifacts or junk in and close it. Old Mole pays rubles to your PDA.'))
})

PlayerEvents.inventoryClosed(event => {
  try {
    var p = event.player
    var lvl = p.level
    if (String(lvl.dimension).indexOf('overworld') < 0) return
    if (Math.abs(p.x - ZSB.POS.x) > 8 || Math.abs(p.z - ZSB.POS.z) > 8) return
    var blk = lvl.getBlock(ZSB.POS.x, ZSB.POS.y, ZSB.POS.z)
    if (String(blk.id) !== 'minecraft:barrel') return
    var be = blk.entity
    if (!be) return
    var menu = event.inventoryContainer
    var cont = zsbCall(menu, ['getContainer', 'm_39261_'])
    if (cont !== be) return
    var size = zsbCall(be, ['getContainerSize', 'm_6643_'])
    var total = 0, sold = []
    for (var i = 0; i < size; i++) {
      var s = zsbCall(be, ['getItem', 'm_8020_'], i)
      if (!s || s.isEmpty()) continue
      var price = zsbPrice(s)
      if (price <= 0) continue
      var n = s.count
      total += price * n
      sold.push(n + 'x ' + zsbName(s))
      s.setCount(0)                    // take it out of the barrel
    }
    if (total <= 0) return
    zsbCall(be, ['setChanged', 'm_6596_'])
    var bal = global.zoneAddRubles(p, total)
    var fmt = function (n) { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',') }
    p.tell(Text.gold('Old Mole: ').append(Text.white('Sold ' + sold.join(', ') + ' for ' + fmt(total) + ' \u20BD. Balance: ' + fmt(bal) + ' \u20BD.')))
    try { p.server.runCommandSilent('playsound minecraft:entity.villager.trade player ' + p.username + ' ' + ZSB.POS.x + ' ' + ZSB.POS.y + ' ' + ZSB.POS.z + ' 0.8 1') } catch (e2) {}
  } catch (err) {
    console.error('[zone] sell barrel failed: ' + err)
  }
})

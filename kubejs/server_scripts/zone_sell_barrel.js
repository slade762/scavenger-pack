// Old Moe's Sell Barrel (Slade).
// A real barrel: put loot in (straight from your backpack with Backpack Side GUI), close it,
// and Old Moe pays cash: ruble notes appear in the barrel for you to take (bank them at the ATM).
// 11/21 (Ward): he buys EVERYTHING now, even if it's for pennies. Only cash, the starter gun and bags/containers stay in the barrel.
// If the barrel is too full for the notes, they go in your pockets.
var ZSB = {
  POS: { x: -1527, y: 83, z: 89 },
  RATE: 500,                        // rubles per coupon (prices below are in coupons)
  AZ_SHARE: 0.75,                   // artifacts/junk: Old Moe pays 75% of the Valhalla buyer's base price
  CAT_SHARE: 0.2,                   // anything our traders sell (zone_catalogues.js): 20% of the cheapest price
  // everything else, rubles each
  OTHER: { gun: 20000, attachment: 3000, armor: 2000, ammo: 10, food: 50, block: 2, item: 10, starter: 10 },
  // never bought (bags and containers would take their contents with them)
  KEEP: ['sophisticatedbackpacks:', 'survival_essentials:', 'anomalyzone:pda'],
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
var zsbAz = null, zsbJ = null
function zsbKinds() {
  if (!zsbJ) zsbJ = {
    armor: Java.loadClass('net.minecraft.world.item.ArmorItem'),
    block: Java.loadClass('net.minecraft.world.item.BlockItem')
  }
  return zsbJ
}
// rubles for ONE of an item Old Moe has no price for
function zsbOther(stack, id) {
  var O = ZSB.OTHER
  if (id === 'tacz:modern_kinetic_gun') return O.gun
  if (id === 'tacz:attachment') return O.attachment
  if (id === 'tacz:ammo') return O.ammo
  try {
    var J = zsbKinds(), item = stack.item
    if (item instanceof J.armor) return O.armor
    if (zsbCall(item, ['isEdible', 'm_41472_'])) return O.food
    if (item instanceof J.block) return O.block
  } catch (e) {}
  return O.item
}
function zsbPrice(stack) {          // rubles for ONE item, 0 = not bought
  var id = String(stack.id)
  try { var st0 = stack.nbt; if (st0 && zsbCall(st0, ['getBoolean', 'm_128471_'], 'zone_starter')) return id === 'tacz:modern_kinetic_gun' ? 0 : ZSB.OTHER.starter } catch (e0) {}   // starter clothes are free at the footlocker: pennies only; the starter gun is never bought
  if (global.zoneNoteValue && global.zoneNoteValue[id]) return 0     // never buys back his own cash
  for (var k = 0; k < ZSB.KEEP.length; k++) if (id.indexOf(ZSB.KEEP[k]) === 0) return 0
  try {                               // anything holding other items stays put
    var tg = stack.nbt
    if (tg && (zsbCall(tg, ['contains', 'm_128441_'], 'BlockEntityTag') || zsbCall(tg, ['contains', 'm_128441_'], 'Items') || zsbCall(tg, ['contains', 'm_128441_'], 'contentsUuid'))) return 0
  } catch (e1) {}
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
  var cat = global.zoneCatPrice ? global.zoneCatPrice[id] : 0
  if (cat > 0) return Math.max(1, Math.floor(cat * ZSB.CAT_SHARE))
  return zsbOther(stack, id)
}
function zsbName(stack) {
  try { return String(stack.hoverName.string) } catch (e) { return String(stack.id) }
}

BlockEvents.rightClicked(event => {
  var b = event.block
  if (b.x !== ZSB.POS.x || b.y !== ZSB.POS.y || b.z !== ZSB.POS.z) return
  if (String(b.id) !== 'minecraft:barrel') return
  event.player.tell(Text.gray('Sell barrel: put anything in and close it. Old Moe buys it all (guns, gear and artifacts pay best, junk pays pennies) and leaves your cash in the barrel. Bags and backpacks are not for sale.'))
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
    total = Math.floor(total)
    var change = total % 1000                // notes are 1,000 only: the change goes to the bank
    total -= change
    if (change > 0) global.zoneAddRubles(p, change)
    var pocket = 0
    global.zoneNoteStacks(total).forEach(function (st) {      // notes go into the barrel's free slots
      for (var j = 0; j < size; j++) {
        var cur = zsbCall(be, ['getItem', 'm_8020_'], j)
        if (cur && !cur.isEmpty()) continue
        zsbCall(be, ['setItem', 'm_6836_'], j, Item.of(st[0], st[1]))
        return
      }
      pocket += global.zoneNoteValue[st[0]] * st[1]
      p.give(Item.of(st[0], st[1]))
    })
    zsbCall(be, ['setChanged', 'm_6596_'])
    var fmt = global.zoneFmt
    if (sold.length > 8) sold = sold.slice(0, 8).concat(['and ' + (sold.length - 8) + ' more'])
    p.tell(Text.gold('Old Moe: ').append(Text.white('Sold ' + sold.join(', ') + ' for ' + fmt(total + change) + ' \u20BD' + (change > 0 ? ' (' + fmt(change) + ' \u20BD of it to your bank)' : '') + '. ' +
      (pocket > 0 ? 'Barrel was full, so ' + fmt(pocket) + ' \u20BD went in your pockets.' : (total > 0 ? 'Your cash is in the barrel.' : '')))))
    try { p.server.runCommandSilent('playsound minecraft:entity.villager.trade player ' + p.username + ' ' + ZSB.POS.x + ' ' + ZSB.POS.y + ' ' + ZSB.POS.z + ' 0.8 1') } catch (e2) {}
  } catch (err) {
    console.error('[zone] sell barrel failed: ' + err)
  }
})

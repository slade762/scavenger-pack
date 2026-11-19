// One currency: rubles (Slade).
// Cash and the bank are separate now (STALKER/Tarkov tension):
//  - CASH: Tarkov ruble notes (100 / 1,000 / 5,000) are real items. They stay in your pockets, you pay traders
//    with them, and whatever you carry drops on your body when you die.
//  - BANK: the Anomaly Zone PDA balance. Only the ATM at the Bar moves money in or out (zone_atm.js);
//    PDA contract rewards are paid straight into it. It is never lost on death.
//  - Coupons are gone from the economy. Any Into The Zone coupon, Coupon Pack or old Wallet that turns up
//    is swapped for notes on the spot (1 coupon = 500 rubles), so nothing ever pays out in coupons again.
// Rate reference: a pistol ~30,000, an AK-74 ~125,000; artifacts sell for 40,000-150,000.
var ZRUB = {
  RATE: 500, PACK: 50,
  NOTES: [[5000, 'tarkovdayz:rubble_5000'], [1000, 'tarkovdayz:rubble_1000'], [100, 'tarkovdayz:rubble_100']],
  VALUE: { 'tarkovdayz:rubble_100': 100, 'tarkovdayz:rubble_1000': 1000, 'tarkovdayz:rubble_5000': 5000 }
}
var zrubTick = 0
var zrubWarned = false
var zrubJ = null

function zrubJava() {
  if (!zrubJ) zrubJ = {
    cur: Java.loadClass('com.anomalyzone.PlayerCurrency'),
    net: Java.loadClass('com.anomalyzone.CurrencyNetwork'),
    empty: Java.loadClass('net.minecraft.world.item.ItemStack').EMPTY
  }
  return zrubJ
}
function zrubFmt(n) { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',') }
global.zoneFmt = zrubFmt
global.zoneNoteValue = ZRUB.VALUE

// ---- bank (PDA balance)
global.zoneBank = function (p) { return Number(zrubJava().cur.get(p)) }
global.zoneAddRubles = function (p, amount) {      // into the bank
  var J = zrubJava()
  J.cur.add(p, amount)
  J.net.sendBalance(p)
  return Number(J.cur.get(p))
}
global.zoneTakeRubles = function (p, amount) {     // out of the bank; false if not enough
  var J = zrubJava()
  var ok = J.cur.subtract(p, amount)
  J.net.sendBalance(p)
  return !!ok
}

// ---- cash (notes)
// rubles -> list of [itemId, count] stacks (max 64 each), rounded down to 100
global.zoneNoteStacks = function (rub) {
  rub = Math.floor(rub / 100) * 100
  var out = []
  ZRUB.NOTES.forEach(function (n) {
    var c = Math.floor(rub / n[0])
    rub -= c * n[0]
    while (c > 0) { var k = Math.min(64, c); out.push([n[1], k]); c -= k }
  })
  return out
}
global.zoneGiveCash = function (p, rub) {          // notes into the player's pockets (dropped at their feet if full)
  global.zoneNoteStacks(rub).forEach(function (s) { p.give(Item.of(s[0], s[1])) })
}
// cash the player is carrying (main inventory + offhand). take=true also removes it.
global.zoneCash = function (p, take) {
  var inv = p.getInventory(), total = 0
  ;[inv.items, inv.offhand].forEach(function (list) {
    for (var i = 0; i < list.size(); i++) {
      var s = list.get(i), v = ZRUB.VALUE[String(s.id)]
      if (!v) continue
      total += v * s.count
      if (take) list.set(i, zrubJava().empty)
    }
  })
  return total
}

// ---- coupons -> notes (they no longer exist in the economy)
ServerEvents.tick(function (event) {
  zrubTick++
  if (zrubTick % 20 !== 0) return
  event.server.players.forEach(function (p) {
    try {
      var inv = p.getInventory(), coupons = 0
      ;[inv.items, inv.offhand].forEach(function (list) {
        for (var i = 0; i < list.size(); i++) {
          var s = list.get(i), id = String(s.id)
          if (id === 'itz:coupon') coupons += s.count
          else if (id === 'kubejs:coupon_pack') coupons += s.count * ZRUB.PACK
          else if (id === 'kubejs:wallet') {
            var t = s.nbt
            if (t === undefined && typeof s.m_41783_ === 'function') t = s.m_41783_()
            coupons += t ? Number(t.getInt('Coupons')) || 0 : 0
          } else continue
          list.set(i, zrubJava().empty)
        }
      })
      if (coupons <= 0) return
      var rub = coupons * ZRUB.RATE
      global.zoneGiveCash(p, rub)
      p.statusMessage = Text.of('Coupons swapped for ' + zrubFmt(rub) + ' ₽ in cash').color(0xD8B225)
    } catch (err) {
      if (!zrubWarned) { zrubWarned = true; console.error('[zone] rubles failed: ' + err) }
    }
  })
})

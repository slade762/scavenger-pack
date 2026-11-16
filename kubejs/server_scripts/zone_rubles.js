// One currency: rubles (Slade).
// Anomaly Zone keeps rubles as a balance on your PDA. Everything else feeds into it:
//  - Into The Zone coupons and Coupon Packs turn into rubles the moment they're in your pockets (loot still drops them)
//  - old Wallets pay out their balance and disappear
//  - Tarkov ruble notes (100 / 1,000 / 5,000) are paid in at face value
//  - the bunker sell barrel pays rubles (zone_sell_barrel.js)
// Rate: 1 coupon = 500 rubles (a pistol ~30,000, an AK-74 ~125,000; artifacts sell for 40,000-150,000).
var ZRUB = { RATE: 500, PACK: 50, NOTES: { 'tarkovdayz:rubble_100': 100, 'tarkovdayz:rubble_1000': 1000, 'tarkovdayz:rubble_5000': 5000 } }
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
// shared with the sell barrel
global.zoneAddRubles = function (p, amount) {
  var J = zrubJava()
  J.cur.add(p, amount)
  J.net.sendBalance(p)
  return Number(J.cur.get(p))
}

ServerEvents.tick(function (event) {
  zrubTick++
  if (zrubTick % 20 !== 0) return
  event.server.players.forEach(function (p) {
    try {
      var inv = p.getInventory(), lists = [inv.items, inv.offhand], coupons = 0, notes = 0
      lists.forEach(function (list) {
        for (var i = 0; i < list.size(); i++) {
          var s = list.get(i), id = String(s.id)
          if (id === 'itz:coupon') coupons += s.count
          else if (id === 'kubejs:coupon_pack') coupons += s.count * ZRUB.PACK
          else if (id === 'kubejs:wallet') {
            var t = s.nbt
            if (t === undefined && typeof s.m_41783_ === 'function') t = s.m_41783_()
            coupons += t ? Number(t.getInt('Coupons')) || 0 : 0
          } else if (ZRUB.NOTES[id]) notes += ZRUB.NOTES[id] * s.count
          else continue
          list.set(i, zrubJava().empty)
        }
      })
      if (coupons <= 0 && notes <= 0) return
      var rub = coupons * ZRUB.RATE + notes
      var bal = global.zoneAddRubles(p, rub)
      p.statusMessage = Text.of('+' + zrubFmt(rub) + ' ₽   (balance ' + zrubFmt(bal) + ' ₽)').color(0xD8B225)
    } catch (err) {
      if (!zrubWarned) { zrubWarned = true; console.error('[zone] rubles failed: ' + err) }
    }
  })
})

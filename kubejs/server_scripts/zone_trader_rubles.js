// Custom NPCs traders: coupons -> ruble notes (Slade).
// Old Moe (and any other Custom NPCs trader) still had coupon / Coupon Pack prices. Every 10 s this checks the
// traders that are loaded and rewrites any trade that uses coupons into notes at 1 coupon = 500 rubles
// (Coupon Pack = 25,000). Trades that SELL coupons or packs (the old coupon <-> pack swap) are removed.
// It works on the live NPCs, so no restart is needed, and they save with the world as usual.
// Op: /kubejs custom_command zone_trades   lists the trades of the trader you're looking at (within 6 blocks).
var ZTRR = {
  RATE: { 'itz:coupon': 500, 'kubejs:coupon_pack': 25000 },
  NOTES: [[5000, 'tarkovdayz:rubble_5000'], [1000, 'tarkovdayz:rubble_1000'], [100, 'tarkovdayz:rubble_100']],
  VALUE: { 'tarkovdayz:rubble_100': 100, 'tarkovdayz:rubble_1000': 1000, 'tarkovdayz:rubble_5000': 5000 }
}
var ztrrTick = 0, ztrrWarned = {}, ztrrRT = null, ztrrEmpty = null
function ztrrErr(k, e) { if (!ztrrWarned[k]) { ztrrWarned[k] = true; console.error('[zone] trader rubles ' + k + ': ' + e) } }
function ztrrFmt(n) { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',') }

// a price in rubles -> at most two note stacks (each <= 64). Rounds to the nearest note it can make.
function ztrrPrice(rub) {
  var N = ZTRR.NOTES
  for (var i = 0; i < N.length; i++) {             // one stack of a single note?
    if (rub % N[i][0] === 0 && rub / N[i][0] <= 64 && rub / N[i][0] >= 1) return [[N[i][1], rub / N[i][0]]]
  }
  for (var a = 0; a < N.length; a++) {             // big note + smaller note
    for (var b = a + 1; b < N.length; b++) {
      var hi = Math.floor(rub / N[a][0]), rest = rub - hi * N[a][0], lo = Math.round(rest / N[b][0])
      if (hi >= 1 && hi <= 64 && lo <= 64) return lo > 0 ? [[N[a][1], hi], [N[b][1], lo]] : [[N[a][1], hi]]
    }
  }
  return [[N[0][1], Math.max(1, Math.min(64, Math.round(rub / N[0][0])))]]
}
function ztrrRub(stack) {
  if (!stack || stack.isEmpty()) return 0
  var r = ZTRR.RATE[String(stack.id)] || ZTRR.VALUE[String(stack.id)]
  return r ? r * stack.count : 0
}
function ztrrHasCoupon(stack) { return stack && !stack.isEmpty() && ZTRR.RATE[String(stack.id)] !== undefined }

// Custom NPCs trader API (IItemStack wrappers) - plain container access doesn't work from KubeJS
var ztrrApi = null
function ztrrMC(is) { return is ? is.getMCItemStack() : null }
function ztrrI(mc) { if (!ztrrApi) ztrrApi = Java.loadClass('noppes.npcs.api.NpcAPI').Instance(); return ztrrApi.getIItemStack(mc) }
function ztrrTrades(role) {                          // [{i, c1, c2, sold}] as MC ItemStacks
  var out = []
  for (var i = 0; i < 18; i++) {
    var s = ztrrMC(role.getSold(i))
    if (!s || s.isEmpty()) continue
    out.push({ i: i, c1: ztrrMC(role.getCurrency1(i)), c2: ztrrMC(role.getCurrency2(i)), sold: s })
  }
  return out
}
function ztrrIsTrader(e) {
  try { return e.role && typeof e.role.getSold === 'function' && typeof e.role.getCurrency1 === 'function' } catch (x) { return false }
}

// returns how many trades it changed
function ztrrFix(npc) {
  if (!ztrrIsTrader(npc)) return 0
  var role = npc.role, changed = 0
  if (!ztrrEmpty) ztrrEmpty = Java.loadClass('net.minecraft.world.item.ItemStack').EMPTY
  ztrrTrades(role).forEach(function (t) {
    if (ztrrHasCoupon(t.sold)) { role.remove(t.i); changed++; return }   // trader hands out coupons/packs: drop it
    if (!ztrrHasCoupon(t.c1) && !ztrrHasCoupon(t.c2)) return
    var money = 0, other = null
    ;[t.c1, t.c2].forEach(function (c) {
      if (!c || c.isEmpty()) return
      var v = ztrrRub(c)
      if (v > 0) money += v; else other = c.copy()
    })
    var stacks = ztrrPrice(money)
    if (other && stacks.length > 1) stacks = ztrrPrice(Math.round(money / 5000) * 5000 || 5000).slice(0, 1)
    var n1 = Item.of(stacks[0][0], stacks[0][1])
    var n2 = other ? other : (stacks[1] ? Item.of(stacks[1][0], stacks[1][1]) : ztrrEmpty)
    role.set(t.i, ztrrI(n1), ztrrI(n2), ztrrI(t.sold.copy()))
    changed++
  })
  if (changed > 0) {
    try {
      var m = role.marketName ? String(role.marketName) : ''
      if (m) { if (!ztrrRT) ztrrRT = Java.loadClass('noppes.npcs.roles.RoleTrader'); ztrrRT.save(role, m) }
    } catch (e) { ztrrErr('market', e) }
  }
  return changed
}

ServerEvents.tick(function (event) {
  if (++ztrrTick % 200 !== 0) return
  var srv = event.server
  srv.players.forEach(function (p) {
    try {
      p.level.getEntitiesWithin(AABB.of(p.x - 96, p.y - 48, p.z - 96, p.x + 96, p.y + 48, p.z + 96)).forEach(function (e) {
        if (String(e.getEncodeId()) !== 'customnpcs:customnpc') return
        var n = ztrrFix(e)
        if (n > 0) console.info('[zone] trader rubles: ' + e.name.string + ' - ' + n + ' coupon trade(s) now in ruble notes')
      })
    } catch (err) { ztrrErr('scan', err) }
  })
})

ServerEvents.customCommand('zone_trades', function (event) {
  var p = event.player
  if (!p) return
  var best = null, bd = 99
  p.level.getEntitiesWithin(AABB.of(p.x - 6, p.y - 3, p.z - 6, p.x + 6, p.y + 3, p.z + 6)).forEach(function (e) {
    if (String(e.getEncodeId()) !== 'customnpcs:customnpc') return
    var d = e.distanceToEntity(p)
    if (d < bd) { bd = d; best = e }
  })
  if (!best || !ztrrIsTrader(best)) { p.tell(Text.red('No Custom NPCs trader within 6 blocks.')); return }
  var r = best.role, lines = []
  ztrrTrades(r).forEach(function (t) {
    var price = [t.c1, t.c2].filter(function (c) { return c && !c.isEmpty() }).map(function (c) {
      var v = ztrrRub(c); return v > 0 ? ztrrFmt(v) + ' \u20BD' : c.count + 'x ' + c.hoverName.string
    }).join(' + ')
    lines.push((t.i + 1) + '. ' + t.sold.count + 'x ' + t.sold.hoverName.string + '  for  ' + price)
  })
  p.tell(Text.gold(best.name.string + ' (' + lines.length + ' trades)' + (r.marketName ? ', market ' + r.marketName : '')))
  lines.forEach(function (l) { p.tell(Text.gray(l)) })
})

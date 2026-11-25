// Bandits carry cash: Tarkov ruble notes drop when a Bandit dies (STALKER-style "loot the body").
// Same value as the old coupons (1 coupon = 500 rubles): grunts 2,000-6,000, the leader 30,000-37,500.
// Notes go onto your PDA balance when picked up (zone_rubles.js), or can be handed to a trader directly.
function zlootNotes(e, rub) {
  rub = Math.round(rub / 100) * 100
  var notes = [[5000, 'tarkovdayz:rubble_5000'], [1000, 'tarkovdayz:rubble_1000'], [100, 'tarkovdayz:rubble_100']]
  notes.forEach(function (n) {
    var c = Math.floor(rub / n[0])
    if (c > 0) { e.block.popItem(Item.of(n[1], c)); rub -= c * n[0] }
  })
}
EntityEvents.death(event => {
  const e = event.entity
  if (String(e.getEncodeId()) !== 'tacznpcs:npc' || (String(e.name.string) !== 'Bandit' && !e.tags.contains('zn_bandit'))) return
  const leader = e.tags.contains('zone_leader')
  const rub = leader ? 30000 + Math.floor(Math.random() * 16) * 500 : 2000 + Math.floor(Math.random() * 9) * 500
  zlootNotes(e, rub)
})

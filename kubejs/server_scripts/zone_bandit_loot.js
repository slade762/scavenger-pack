// Bandits carry cash: coupons drop when a Bandit dies (STALKER-style "loot the body").
// Grunts drop 4-12 coupons, the leader drops 1 Coupon Pack + 10-25 coupons.
EntityEvents.death(event => {
  const e = event.entity
  if (String(e.getEncodeId()) !== 'tacznpcs:npc' || String(e.name.string) !== 'Bandit') return
  const leader = e.tags.contains('zone_leader')
  const n = leader ? 10 + Math.floor(Math.random() * 16) : 4 + Math.floor(Math.random() * 9)
  e.block.popItem(Item.of('itz:coupon', n))
  if (leader) e.block.popItem(Item.of('kubejs:coupon_pack', 1))
})

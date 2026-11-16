// Artifacts (Slade) - one artifact system: Anomaly Zone's (the ones that go in containers).
//  - Into The Zone artifacts that turn up anywhere (old loot, old saves) become a random Anomaly Zone artifact.
//  - The Heart of Gresham (ITZ's Heart of Chernobyl, renamed) is the one exception: a legendary find.
//    It can't be crafted from shards any more. Picking up an artifact inside the City of Gresham has a
//    small chance to turn out to be the Heart instead.
var ZART = {
  ITZ: ['itz:snowflake', 'itz:crust', 'itz:bubble', 'itz:magma', 'itz:sapphire', 'itz:sparkler', 'itz:broken_rock',
        'itz:jellyfish', 'itz:shop_class', 'itz:lyre', 'itz:goldfish', 'itz:chocolate_bar', 'itz:glare', 'itz:spring'],
  HEART: 'itz:heart_of_chernobyl',
  HEART_CHANCE: 0.015,                                  // per artifact picked up in the city
  CITY: { minX: -330, minZ: -520, maxX: 710, maxZ: 620 }
}
var zartAz = null
function zartAzList() {
  if (!zartAz) {
    zartAz = []
    try { Ingredient.of('#anomalyzone:artifacts').itemIds.forEach(function (id) { zartAz.push(String(id)) }) } catch (e) {}
    if (zartAz.length === 0) zartAz = ['anomalyzone:raisin', 'anomalyzone:bracelet', 'anomalyzone:prism', 'anomalyzone:spiral']
  }
  return zartAz
}
function zartRandomAz() { var l = zartAzList(); return l[Math.floor(Math.random() * l.length)] }

ServerEvents.recipes(function (event) {
  event.remove({ id: 'itz:heart_of_chernobyl' })
})

var zartTick = 0
ServerEvents.tick(function (event) {
  if (++zartTick % 40 !== 0) return
  event.server.players.forEach(function (p) {
    try {
      var inv = p.getInventory()
      var lists = [inv.items, inv.offhand]
      var swapped = 0
      lists.forEach(function (list) {
        for (var i = 0; i < list.size(); i++) {
          var s = list.get(i)
          if (s.isEmpty() || ZART.ITZ.indexOf(String(s.id)) < 0) continue
          list.set(i, Item.of(zartRandomAz(), s.count))
          swapped++
        }
      })
      if (swapped) inv.setChanged()
    } catch (err) { console.error('[zone] artifact swap failed: ' + err) }
  })
})

ItemEvents.pickedUp(function (event) {
  try {
    var p = event.player, it = event.item
    if (!p || !it) return
    if (!it.hasTag('anomalyzone:artifacts')) return
    var c = ZART.CITY
    if (p.x < c.minX || p.x > c.maxX || p.z < c.minZ || p.z > c.maxZ) return
    if (Math.random() >= ZART.HEART_CHANCE) return
    var ent = event.itemEntity
    if (ent) ent.discard()
    p.give(Item.of(ZART.HEART))
    p.tell(Text.of('The artifact pulses like a heartbeat in your hand...').color(0xC23B3B).italic())
    event.cancel()
  } catch (err) { console.error('[zone] heart roll failed: ' + err) }
})

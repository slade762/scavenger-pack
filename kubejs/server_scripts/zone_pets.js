// zone_pets.js — SCAVENGER pet tweaks (Ward, 11/19)
//  - Tamed wolves take no fall damage (they follow you off ledges and died a lot).
//  Wild wolves still take fall damage as normal.

EntityEvents.hurt('minecraft:wolf', function (event) {
  try {
    var e = event.entity
    if (!e.isTame()) return
    var src = event.source
    var fall = false
    try { fall = String(src.getMsgId()) === 'fall' } catch (err) {}
    if (!fall) { try { fall = String(src.getType()) === 'fall' } catch (err) {} }
    if (fall) event.cancel()
  } catch (err) {
    console.error('[zone] pets: ' + err)
  }
})

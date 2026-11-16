// Mutant gate (Slade). Mutants only come from our own systems: A-Life packs (tag alife) and the spawn
// director's encounters (tag zone_encounter), both of which are rare and capped. Any mutant that shows up
// without a tag - Into The Zone's own night spawning, old saved chunks, structures - is removed.
var ZMG = { 'itz:boar': 1, 'itz:snork': 1, 'itz:psydog': 1, 'itz:bloodsucker': 1, 'itz:chimera': 1, 'itz:armored_elk': 1 }

EntityEvents.spawned(function (event) {
  var e = event.entity
  if (!ZMG[String(e.type)]) return
  var tags = e.tags
  if (tags && !tags.isEmpty()) return
  event.cancel()
})

// Extinction Z (Slade, 11/23). The mod is in the pack ONLY for its infected, which our scripts spawn in the Deep.
//  - Natural spawning is off by datapack (kubejs/data/extinction/forge/biome_modifier/*.json = forge:none); this script
//    also refuses any natural/chunk/spawner spawn of an extinction: mob as a backup.
//  - Its structures never generate (kubejs/data/extinction/worldgen/structure/*.json point at the empty tag #zone:none).
//  - Its biome is kept out of terrain generation by zone_tactical_anims 0.88.10 (ExtinctionBiomeOffMixin).
//  - Its crafting recipes are removed (weapons/armour/gear stay out of the economy; blocks can still be placed by ops).
// only world spawning is refused; /summon, spawn eggs and our own scripts (they use /summon) go through.
// (Forge 1.20.1 runs this check for /summon too, so the spawn type matters.)
var ZEXT_DENY = { NATURAL: 1, CHUNK_GENERATION: 1, SPAWNER: 1, STRUCTURE: 1, PATROL: 1, REINFORCEMENT: 1, JOCKEY: 1 }
EntityEvents.checkSpawn(function (event) {
  var id = '', type = ''
  try { id = String(event.entity.type) } catch (e) {}
  if (id.indexOf('extinction:') !== 0) return
  try { type = String(event.type) } catch (e) {}
  if (!ZEXT_DENY[type]) return
  try { event.entity.discard() } catch (e) {}
  event.cancel()
})
ServerEvents.recipes(function (event) {
  event.remove({ mod: 'extinction' })
})

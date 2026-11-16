// Zone modpack: no baby zombies.
// When any zombie-type mob spawns as a baby, turn it into an adult instead.
// (Turning them into adults instead of deleting them keeps zombie numbers the same.)

EntityEvents.spawned(event => {
  const mob = event.entity

  // Only mobs that can be babies have these two methods.
  if (typeof mob.isBaby !== 'function' || typeof mob.setBaby !== 'function') return
  if (!mob.isBaby()) return

  // Which kind of mob is it? e.g. "minecraft:zombie"
  const id = String(mob.encodeId)

  if (id.includes('zombie') || id === 'minecraft:husk' || id === 'minecraft:drowned') {
    mob.setBaby(false)
  }
})

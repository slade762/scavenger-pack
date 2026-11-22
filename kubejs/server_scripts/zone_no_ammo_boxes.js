// No TaCZ ammo boxes (Slade, 11/22): the ammo bag from Survival Essentials is how you carry spare ammo now.
// Survival Essentials 0.9.1 takes ammo boxes out of all loot (diamond ones become ammo bags); this removes the three
// crafting recipes so they can't simply be made instead. Recipes are re-read on /reload or a restart.
ServerEvents.recipes(function (event) {
  ;['tacz:iron_ammo_box', 'tacz:gold_ammo_box', 'tacz:diamond_ammo_box'].forEach(function (id) { event.remove({ id: id }) })
  event.remove({ output: 'tacz:ammo_box' })   // any other recipe that makes one
})

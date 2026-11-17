// Fracture Point backpacks (Slade).
// Sophisticated Backpacks is the only real backpack in SCAVENGER; it wears Fracture Point's models
// via the Zone Backpack Skins mod. So Fracture Point's own backpacks and tier upgrades can't be crafted.
ServerEvents.recipes(function (event) {
  event.remove({ id: /^fracturepoint:ballistics_bench\/armor\/.*backpack.*/ })
  event.remove({ id: /^fracturepoint:ballistics_bench\/backpacks\/.*/ })
})

// zone_body_cosmetic.js (Ward 11/25 note 8): any chestplate can go in the Curios 'body' slot as a cosmetic.
// Curios gives no armour stats for it (vanilla armour points only count in the real chest slot); zta's BodyArmorRenderer
// draws it like worn chest armour. Fracture Point backpacks (chestplate items) are left out. Tags load on /reload.
ServerEvents.tags('item', function (event) {
  var ArmorItem = Java.loadClass('net.minecraft.world.item.ArmorItem')
  var Reg = Java.loadClass('net.minecraftforge.registries.ForgeRegistries')
  var n = 0
  Reg.ITEMS.getValues().forEach(function (it) {
    try {
      if (!(it instanceof ArmorItem) || String(it.getEquipmentSlot()) !== 'CHEST') return
      var id = String(Reg.ITEMS.getKey(it))
      if (id.indexOf('backpack') >= 0) return
      event.add('curios:body', id)
      n++
    } catch (x) {}
  })
  console.info('[zone] body cosmetic: ' + n + ' chestplates allowed in the Curios body slot')
})

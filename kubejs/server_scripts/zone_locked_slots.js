// Locked pocket guard (Slade).
// Inventory Free leaves you 9 pocket slots, but some moves (shift-clicking into a full hotbar, mods that add items
// straight to your inventory) can still drop items into the 27 locked slots, where they're stuck and invisible.
// Every half second anything found there is moved into your backpack, or dropped at your feet if it won't fit.
// 11/22 (Survival Essentials 1.0): a worn Zone backpack OPENS those 27 slots - they are the backpack. Players wearing
// one are left alone completely; the guard only acts on players without one (old Sophisticated packs still get the items).
var ZLS = { FIRST: 9, LAST: 35 }
var zlsTick = 0
var zlsWarned = false
var zlsCaps = null

function zlsJava() {
  if (!zlsCaps) zlsCaps = {
    caps: Java.loadClass('net.minecraftforge.common.capabilities.ForgeCapabilities'),
    helper: Java.loadClass('net.minecraftforge.items.ItemHandlerHelper'),
    curios: Java.loadClass('top.theillusivec4.curios.api.CuriosApi')
  }
  return zlsCaps
}
function zlsIsPack(stack) { return !stack.isEmpty() && String(stack.id).indexOf('backpack') >= 0 }
function zlsIsZonePack(stack) { return !stack.isEmpty() && String(stack.id).indexOf('survival_essentials:backpack') === 0 }
// true while the player wears a Survival Essentials backpack, or their inventory is still marked as that pack's contents
function zlsZonePackOn(p) {
  try { if (p.persistentData.getBoolean('se_pack_open')) return true } catch (e) {}
  try {
    var h = zlsJava().curios.getCuriosInventory(p).resolve()
    if (h.isPresent() && h.get().findFirstCurio(function (s) { return zlsIsZonePack(s) }).isPresent()) return true
  } catch (e) {}
  return false
}
function zlsBackpack(p, inv) {
  var J = zlsJava()
  try {
    var h = J.curios.getCuriosInventory(p).resolve()
    if (h.isPresent()) {
      var r = h.get().findFirstCurio(function (s) { return zlsIsPack(s) && !zlsIsZonePack(s) })
      if (r.isPresent()) return r.get().stack()
    }
  } catch (e) {}
  var chest = p.getItemBySlot(Java.loadClass('net.minecraft.world.entity.EquipmentSlot').CHEST)
  if (zlsIsPack(chest) && !zlsIsZonePack(chest)) return chest
  for (var i = 0; i < 9; i++) { var s = inv.items.get(i); if (zlsIsPack(s) && !zlsIsZonePack(s)) return s }
  return null
}
function zlsInsert(pack, stack) {
  var J = zlsJava()
  var cap = pack.getCapability(J.caps.ITEM_HANDLER).resolve()
  if (!cap.isPresent()) return stack
  return J.helper.insertItemStacked(cap.get(), stack, false)
}

ServerEvents.tick(function (event) {
  zlsTick++
  if (zlsTick % 10 !== 0) return
  event.server.players.forEach(function (p) {
    try {
      if (p.isCreative() || p.isSpectator()) return
      if (zlsZonePackOn(p)) return
      var inv = p.getInventory(), pack = null, moved = 0, dropped = 0
      for (var i = ZLS.FIRST; i <= ZLS.LAST; i++) {
        var s = inv.items.get(i)
        if (s.isEmpty()) continue
        var left = s.copy()
        inv.items.set(i, Java.loadClass('net.minecraft.world.item.ItemStack').EMPTY)
        if (pack === null) pack = zlsBackpack(p, inv) || false
        if (pack) { try { left = zlsInsert(pack, left) } catch (e) {} }
        if (!left.isEmpty()) { p.drop(left, false); dropped++ } else moved++
      }
      if (moved || dropped) {
        p.statusMessage = Text.of(dropped ? 'Pockets full - ' + (moved ? 'some went in your backpack, the rest' : 'it') + ' fell at your feet' : 'Pockets full - moved to your backpack').color(0xD8B225)
        inv.setChanged()
      }
    } catch (err) {
      if (!zlsWarned) { zlsWarned = true; console.error('[zone] locked slot guard failed: ' + err) }
    }
  })
})

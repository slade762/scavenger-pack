// Fedya's backpack quests (Slade, 11/21). Ward: one quest that introduces backpacks, a follow-up for upgrades.
// Custom NPCs (category Bar), offered from Fedya's greeting (dialog 57) once Pasha's tutorial is done (quest 18):
//   306 "A Proper Pack"   (dialog 630 starts it, Fedya GIVES a leather backpack once, flag zone_bq_pack): wear it (chest slot or Curios back) -> dialog 631
//   307 "Fitting It Out"  (dialog 632, after 306): any upgrade fitted in a worn or carried backpack           -> dialog 633
// Both are Dialog quests: reading the "done" dialog finishes them (rewards + 15 Scavenger rep via zone_rep.js).
// This script only notices the condition and shows that dialog (again after 20 s if it was closed unread).
var ZBQ = { Q1: 306, Q2: 307, D1: 631, D2: 633, NPC: 'Fedya' }
var zbqTick = 0, zbqApi = null, zbqCap = null, zbqCurios = null, zbqWarned = {}, zbqShown = {}
function zbqErr(k, e) { if (!zbqWarned[k]) { zbqWarned[k] = true; console.error('[zone] backpack quests ' + k + ': ' + e) } }
// 11/22: the pack is Survival Essentials' own backpack now (old Sophisticated ones still count until they are converted)
function zbqIsPack(st) { return st && !st.isEmpty() && (String(st.id).indexOf('survival_essentials:backpack') === 0 || (String(st.id).indexOf('sophisticatedbackpacks:') === 0 && String(st.id).indexOf('backpack') >= 0)) }
function zbqWorn(p) {
  var out = []
  var chest = p.getItemBySlot(Java.loadClass('net.minecraft.world.entity.EquipmentSlot').CHEST)
  if (zbqIsPack(chest)) out.push(chest)
  try {
    if (!zbqCurios) zbqCurios = Java.loadClass('top.theillusivec4.curios.api.CuriosApi')
    var inv = zbqCurios.getCuriosInventory(p).resolve()
    if (inv.isPresent()) {
      // 11/22 19:33: read Survival Essentials' Curios "back" slot directly (findFirstCurio with a JS predicate is unreliable in KubeJS)
      var bh = inv.get().getStacksHandler('back')
      if (bh.isPresent()) {
        var bs = bh.get().getStacks()
        for (var i = 0; i < bs.getSlots(); i++) { var s = bs.getStackInSlot(i); if (zbqIsPack(s)) out.push(s) }
      }
      if (out.length === 0) { var r = inv.get().findFirstCurio(function (s) { return zbqIsPack(s) }); if (r.isPresent()) out.push(r.get().stack()) }
    }
  } catch (e) { zbqErr('curios', e) }
  return out
}
// 11/22: quest 307 is now "strap an accessory on your pack" (the Backpack Accessory slot, Curios id medbag)
function zbqHasUpgrade(p) {
  try {
    if (!zbqCurios) zbqCurios = Java.loadClass('top.theillusivec4.curios.api.CuriosApi')
    var ci = zbqCurios.getCuriosInventory(p).resolve()
    if (ci.isPresent()) {
      var sh = ci.get().getStacksHandler('medbag')
      if (sh.isPresent() && sh.get().getStacks().getSlots() > 0 && !sh.get().getStacks().getStackInSlot(0).isEmpty()) return true
    }
  } catch (e) { zbqErr('accessory', e) }
  return false
}
function zbqHasUpgradeOld(p) {
  var packs = zbqWorn(p)
  p.inventory.items.forEach(function (s) { if (zbqIsPack(s)) packs.push(s) })
  if (!zbqCap) zbqCap = Java.loadClass('net.p3pp3rf1y.sophisticatedbackpacks.api.CapabilityBackpackWrapper').getCapabilityInstance()
  for (var i = 0; i < packs.length; i++) {
    try {
      var w = packs[i].getCapability(zbqCap).resolve()
      if (w.isPresent() && w.get().getUpgradeHandler().getSlotWrappers().size() > 0) return true
    } catch (e) { zbqErr('upgrades', e) }
  }
  return false
}
function zbqShow(p, ip, did) {
  if (ip.hasReadDialog(did)) return
  var key = String(p.uuid) + did, now = Date.now()
  if (zbqShown[key] && now - zbqShown[key] < 20000) return
  zbqShown[key] = now
  ip.showDialog(did, ZBQ.NPC)
}
ServerEvents.tick(function (event) {
  if (++zbqTick % 40 !== 13) return
  event.server.players.forEach(function (p) {
    try {
      if (!zbqApi) zbqApi = Java.loadClass('noppes.npcs.api.NpcAPI').Instance()
      var ip = zbqApi.getIEntity(p)
      if (ip.hasActiveQuest(ZBQ.Q1) && !p.persistentData.getBoolean('zone_bq_pack')) {
        p.persistentData.putBoolean('zone_bq_pack', true)
        p.give(Item.of('survival_essentials:backpack'))
      }
      if (ip.hasActiveQuest(ZBQ.Q1) && zbqWorn(p).length > 0) zbqShow(p, ip, ZBQ.D1)
      if (ip.hasActiveQuest(ZBQ.Q2) && zbqHasUpgrade(p)) zbqShow(p, ip, ZBQ.D2)
    } catch (e) { zbqErr('tick', e) }
  })
})

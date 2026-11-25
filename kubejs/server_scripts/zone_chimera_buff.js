// zone_chimera_buff.js (Ward 11/25 note 10: "Chimeras are too easy to kill"). Into the Zone's Chimera had 80 HP and no armour
// (same as a Bloodsucker). Every Chimera that joins the world without our mark gets the values below once and is healed to full.
// Covers new spawns, lair respawns (zone_duga_lair.js) and old ones in saved chunks. Change a value + reload: new Chimeras only.
var ZCB = { HP: 240, ARMOR: 10, TOUGH: 4, KB: 0.8, DMG: 10, MARK: 'zone_chim_v1' }
var zcbA = null
EntityEvents.spawned('itz:chimera', function (event) {
  try {
    var e = event.entity
    if (e.persistentData.getBoolean(ZCB.MARK)) return
    if (!zcbA) zcbA = Java.loadClass('net.minecraft.world.entity.ai.attributes.Attributes')
    var set = function (a, v) { var i = e.getAttribute(a); if (i) i.setBaseValue(v) }
    set(zcbA.MAX_HEALTH, ZCB.HP); set(zcbA.ARMOR, ZCB.ARMOR); set(zcbA.ARMOR_TOUGHNESS, ZCB.TOUGH)
    set(zcbA.KNOCKBACK_RESISTANCE, ZCB.KB); set(zcbA.ATTACK_DAMAGE, ZCB.DMG)
    e.setHealth(ZCB.HP)
    e.persistentData.putBoolean(ZCB.MARK, true)
  } catch (x) { console.warn('[zone] chimera buff: ' + x) }
})

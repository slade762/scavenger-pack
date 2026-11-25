// Elite bandits (Claude 11/25, Ward's note 2: rare enemy NPCs with better loadouts).
// About CHANCE of every Bandit that spawns (camp, A-Life squads, jobs, ambushes ...) becomes an elite: real armour,
// a suppressed rifle, and more cash on the body (zone_bandit_loot.js). Leaders are left alone. Each Bandit is rolled
// once (tag zone_elite_roll); elites get tag zone_elite. Test: summon a Bandit with tag zone_elite_force.
// Backpack: a Survival Essentials backpack in the Curios 'back' slot (slot for tacznpcs:npc = kubejs/data/zone/curios/entities/
// zone_npc_backpack.json, loads at a restart/reload; drawn by the client startup script zone_npc_backpack_layer.js).
var ZEL = {
  CHANCE: 0.07,
  GUNS: [
    'tacz:modern_kinetic_gun{GunId:"ra1k:ak74",GunFireMode:"AUTO",GunCurrentAmmoCount:30,HasBulletInBarrel:1b,AttachmentMUZZLE:{id:"tacz:attachment",Count:1b,tag:{AttachmentId:"tacz:muzzle_silencer_ursus"}}}',
    'tacz:modern_kinetic_gun{GunId:"ra1k:aks74u",GunFireMode:"AUTO",GunCurrentAmmoCount:30,HasBulletInBarrel:1b,AttachmentMUZZLE:{id:"tacz:attachment",Count:1b,tag:{AttachmentId:"tacz:muzzle_silencer_ursus"}}}',
    'tacz:modern_kinetic_gun{GunId:"ra1k:fpx_ak105",GunFireMode:"AUTO",GunCurrentAmmoCount:30,HasBulletInBarrel:1b,AttachmentMUZZLE:{id:"tacz:attachment",Count:1b,tag:{AttachmentId:"ra1k:spear_silencer"}}}'
  ],
  HEAD: ['projectarmor_:ssh_68_helmet', 'projectarmor_:lhs_helmet', 'fracturepoint:ru_helmet', 'projectarmor_:h_6b_47_helmet', 'esap:balaclava', 'esap:ski_mask'],
  CHEST: ['projectarmor_:a_6b_5_chestplate', 'projectarmor_:a_6b_2_chestplate', 'projectarmor_:ghel_chestplate', 'fracturepoint:shturmovik_ru_chestplate', 'fracturepoint:razvetchik_chestplate', 'projectarmor_:wartech_chestplate'],
  LEGS: ['itz:rookie_leggings'],
  FEET: ['itz:rookie_boots'],
  BACKPACKS: ['survival_essentials:backpack', 'survival_essentials:backpack_black', 'survival_essentials:backpack_gray', 'survival_essentials:backpack_green', 'survival_essentials:backpack_olive'],
  // drop chances: [feet, legs, chest, head] and [mainhand, offhand]
  ARMOR_DROP: '[0.08f,0.08f,0.12f,0.12f]', HAND_DROP: '[0.25f,0.0f]'
}
function zelPick(a) { return a[Math.floor(Math.random() * a.length)] }
var zelCurios = null
function zelBackpack(e) {   // quietly does nothing until the 'back' slot exists for tacznpcs:npc
  try {
    if (!zelCurios) zelCurios = Java.loadClass('top.theillusivec4.curios.api.CuriosApi')
    var inv = zelCurios.getCuriosInventory(e).orElse(null)
    if (!inv || !inv.getStacksHandler('back').isPresent()) return false
    inv.setEquippedCurio('back', 0, Item.of(zelPick(ZEL.BACKPACKS)))
    return true
  } catch (x) { return false }
}
function zelMake(srv, uuid) {
  var sel = 'execute in minecraft:overworld run ', who = '@e[limit=1,type=tacznpcs:npc,nbt={UUID:' + uuid + '}]'
  srv.runCommandSilent(sel + 'item replace entity ' + who + ' weapon.mainhand with ' + zelPick(ZEL.GUNS))
  srv.runCommandSilent(sel + 'item replace entity ' + who + ' armor.head with ' + zelPick(ZEL.HEAD))
  srv.runCommandSilent(sel + 'item replace entity ' + who + ' armor.chest with ' + zelPick(ZEL.CHEST))
  srv.runCommandSilent(sel + 'item replace entity ' + who + ' armor.legs with ' + zelPick(ZEL.LEGS))
  srv.runCommandSilent(sel + 'item replace entity ' + who + ' armor.feet with ' + zelPick(ZEL.FEET))
  srv.runCommandSilent(sel + 'data merge entity ' + who + ' {ArmorDropChances:' + ZEL.ARMOR_DROP + ',HandDropChances:' + ZEL.HAND_DROP + '}')
}
EntityEvents.spawned(function (event) {
  try {
    var e = event.entity
    if (String(e.getEncodeId()) !== 'tacznpcs:npc') return
    var tags = e.getTags()
    if (!tags.contains('zone_bandit') || tags.contains('zone_leader') || tags.contains('zone_elite_roll')) return
    e.addTag('zone_elite_roll')
    if (!tags.contains('zone_elite_force') && Math.random() >= ZEL.CHANCE) return
    e.addTag('zone_elite')
    var srv = event.server, uuid = String(e.getNbt().get('UUID'))
    srv.scheduleInTicks(5, function () { try { zelMake(srv, uuid); zelBackpack(e) } catch (x) { console.error('[zone] elite gear failed: ' + x) } })
    console.info('[zone] elite bandit at ' + Math.round(e.x) + ' ' + Math.round(e.y) + ' ' + Math.round(e.z))
  } catch (err) { console.error('[zone] elite roll failed: ' + err) }
})

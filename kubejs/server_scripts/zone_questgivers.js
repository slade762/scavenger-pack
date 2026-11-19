// Quest-givers and faction leaders (Slade).
// Stand where the NPC should stand, face the way they should face, then run:
//   /kubejs custom_command zone_npc_pasha      Pasha, instructor (Bar)        - tutorial chain
//   /kubejs custom_command zone_npc_yarik      Yarik, Scavenger leader (Bar)  - hunts + envoy story
//   /kubejs custom_command zone_npc_ilya       Doc Ilya, medic (Bar)          - fetch jobs
//   /kubejs custom_command zone_npc_fedya      Fedya, mechanic (Bar)          - fetch jobs
//   /kubejs custom_command zone_npc_kravets    Major Kravets (Military base)
//   /kubejs custom_command zone_npc_eliwood    Eliwood (Pacifists, Mountainview Chalet) - suppressed AKM
//   /kubejs custom_command zone_npc_rusak      Forgemaster Rusak (The Armoury) - also auto-placed at 264 86 -499
//   /kubejs custom_command zone_npc_remove     removes the quest-giver within 2 blocks of you
// Their dialogs and quests live in world/customnpcs (dialogs 30-92, quests 10-61).
// Placing one again replaces the old copy, so you can move them any time.
var ZQG = {
  pasha:   { name: 'Pasha',               title: 'Instructor',         team: 'scavengers', dialog: 30,
             gun: 'tacz:modern_kinetic_gun{GunId:"ra1k:aks74u",GunFireMode:"AUTO",GunCurrentAmmoCount:30,HasBulletInBarrel:1b}',
             skin: 'anomalyzone:textures/entity/ambient/ambient_08_debut_suit2.png',
             armor: { 'armor.chest': 'itz:psz_chestplate_loner', 'armor.legs': 'itz:psz_leggings_loner', 'armor.feet': 'itz:psz_boots_loner' } },
  yarik:   { name: 'Yarik',               title: 'Scavenger Leader',   team: 'scavengers', dialog: 36,
             gun: 'tacz:modern_kinetic_gun{GunId:"ra1k:mp155",GunFireMode:"SEMI",GunCurrentAmmoCount:6,HasBulletInBarrel:1b}',
             skin: 'anomalyzone:textures/entity/ambient/ambient_07_freedom_wind2.png',
             armor: { 'armor.chest': 'itz:psz_chestplate_loner', 'armor.legs': 'itz:psz_leggings_loner', 'armor.feet': 'itz:psz_boots_loner' } },
  ilya:    { name: 'Doc Ilya',            title: 'Medic',              team: 'scavengers', dialog: 50,
             gun: 'tacz:modern_kinetic_gun{GunId:"ra1k:pm",GunFireMode:"SEMI",GunCurrentAmmoCount:8,HasBulletInBarrel:1b}',
             skin: 'anomalyzone:textures/entity/ambient_npc.png',
             armor: { 'armor.chest': 'itz:psz_chestplate_loner' } },
  fedya:   { name: 'Fedya',               title: 'Mechanic',           team: 'scavengers', dialog: 57,
             gun: 'tacz:modern_kinetic_gun{GunId:"fzbe:izh18_0_0",GunFireMode:"SEMI",GunCurrentAmmoCount:1,HasBulletInBarrel:1b}',
             skin: 'anomalyzone:textures/entity/ambient/ambient_11_misc3.png',
             armor: { 'armor.legs': 'itz:psz_leggings_loner', 'armor.feet': 'itz:psz_boots_loner' } },
  kravets: { name: 'Major Kravets',       title: 'Military Commander', team: 'military',   dialog: 64,
             gun: 'tacz:modern_kinetic_gun{GunId:"ra1k:nl545",GunFireMode:"AUTO",GunCurrentAmmoCount:30,HasBulletInBarrel:1b}',
             skin: 'anomalyzone:textures/entity/ambient/ambient_05_duty_recruit.png',
             armor: { 'armor.head': 'fracturepoint:sso_squad_leader_helmet', 'armor.chest': 'fracturepoint:sso_squad_leader_chestplate',
                      'armor.legs': 'fracturepoint:sso_squad_leader_leggings', 'armor.feet': 'fracturepoint:sso_boots' } },
  eliwood: { name: 'Eliwood',             title: 'Pacifist Leader',    team: 'pacifists',  dialog: 72,
             gun: 'tacz:modern_kinetic_gun{GunId:"tacz:ak47",GunFireMode:"AUTO",GunCurrentAmmoCount:30,HasBulletInBarrel:1b,AttachmentMUZZLE:{id:"tacz:attachment",Count:1b,tag:{AttachmentId:"tacz:muzzle_silencer_ursus"}}}',
             skin: 'anomalyzone:textures/entity/ambient/ambient_10_misc2.png',
             armor: { 'armor.chest': 'itz:psz_chestplate_freedom', 'armor.legs': 'itz:psz_leggings_freedom', 'armor.feet': 'itz:psz_boots_freedom' } },
  rusak:   { name: 'Forgemaster Rusak',   title: 'The Armoury',        team: 'armoury',    dialog: 85,
             at: [264, 86, -499, 0] }   // fixed home: zone_armoury.js places him there if he's missing
}

// summons quest-giver `key` at x y z facing yaw (replaces any old copy). Used by the op command and zone_armoury.js.
function zqgPlace(srv, key, x, y, z, yaw, dimId) {
  var n = ZQG[key]
  var dim = 'execute in ' + dimId + ' run '
  var tag = 'zq_' + key
  srv.runCommandSilent('kill @e[type=customnpcs:customnpc,tag=' + tag + ']')
  var nbt = '{Name:"' + n.name + '",Title:"' + n.title + '",' +
    'NPCDialogOptions:[{DialogSlot:0,NPCDialog:{Title:"Talk",Dialog:' + n.dialog + ',DialogColor:14737632,OptionType:1,DialogCommand:""}}],' +
    'StartPosNew:[I;' + x + ',' + y + ',' + z + '],MovementType:0,ReturnToStart:1b,' +
    (n.skin ? 'Texture:"' + n.skin + '",' : '') + 'Invulnerable:1b,PersistenceRequired:1b,Rotation:[' + yaw + 'f,0f],Tags:["zone_qnpc","' + tag + '"]}'
  srv.runCommandSilent(dim + 'summon customnpcs:customnpc ' + (x + 0.5) + ' ' + y + ' ' + (z + 0.5) + ' ' + nbt)
  srv.runCommandSilent('team join ' + n.team + ' @e[type=customnpcs:customnpc,tag=' + tag + ']')
  if (n.armor) Object.keys(n.armor).forEach(function (s) { srv.runCommandSilent('execute in minecraft:overworld run item replace entity @e[type=customnpcs:customnpc,tag=' + tag + ',limit=1] ' + s + ' with ' + n.armor[s]) })
  if (n.gun) srv.runCommandSilent('execute in minecraft:overworld run item replace entity @e[type=customnpcs:customnpc,tag=' + tag + ',limit=1] weapon.mainhand with ' + n.gun)
  return n
}
global.zoneQgPlace = zqgPlace

Object.keys(ZQG).forEach(function (key) {
  ServerEvents.customCommand('zone_npc_' + key, function (event) {
    var p = event.player
    if (!p) return
    var x = Math.floor(p.x), y = Math.floor(p.y), z = Math.floor(p.z)
    var n = zqgPlace(event.server, key, x, y, z, Math.round(p.yaw * 10) / 10, String(p.level.dimension))
    p.tell(Text.of('Placed ' + n.name + ' at ' + x + ' ' + y + ' ' + z + '. Step off the spot and right-click to talk.').color(0x9BD86A))
  })
})

ServerEvents.customCommand('zone_npc_remove', function (event) {
  var p = event.player
  if (!p) return
  event.server.runCommandSilent('execute as ' + p.username + ' at @s run kill @e[type=customnpcs:customnpc,tag=zone_qnpc,distance=..2,limit=1,sort=nearest]')
  p.tell(Text.of('Removed the nearest quest-giver (if there was one within 2 blocks).').color(0xD8B225))
})

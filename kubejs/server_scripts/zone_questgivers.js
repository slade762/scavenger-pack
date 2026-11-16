// Quest-givers and faction leaders (Slade).
// Stand where the NPC should stand, face the way they should face, then run:
//   /kubejs custom_command zone_npc_pasha      Pasha, instructor (Bar)        - tutorial chain
//   /kubejs custom_command zone_npc_yarik      Yarik, Scavenger leader (Bar)  - hunts + envoy story
//   /kubejs custom_command zone_npc_ilya       Doc Ilya, medic (Bar)          - fetch jobs
//   /kubejs custom_command zone_npc_fedya      Fedya, mechanic (Bar)          - fetch jobs
//   /kubejs custom_command zone_npc_kravets    Major Kravets (Military base)
//   /kubejs custom_command zone_npc_eliwood    Eliwood (Pacifists, Mountainview Chalet) - suppressed AKM
//   /kubejs custom_command zone_npc_rusak      Quartermaster Rusak (The Armoury)
//   /kubejs custom_command zone_npc_remove     removes the quest-giver within 2 blocks of you
// Their dialogs and quests live in world/customnpcs (dialogs 30-92, quests 10-61).
// Placing one again replaces the old copy, so you can move them any time.
var ZQG = {
  pasha:   { name: 'Pasha',               title: 'Instructor',         team: 'scavengers', dialog: 30 },
  yarik:   { name: 'Yarik',               title: 'Scavenger Leader',   team: 'scavengers', dialog: 36 },
  ilya:    { name: 'Doc Ilya',            title: 'Medic',              team: 'scavengers', dialog: 50 },
  fedya:   { name: 'Fedya',               title: 'Mechanic',           team: 'scavengers', dialog: 57 },
  kravets: { name: 'Major Kravets',       title: 'Military Commander', team: 'military',   dialog: 64 },
  eliwood: { name: 'Eliwood',             title: 'Pacifist Leader',    team: 'pacifists',  dialog: 72,
             gun: 'tacz:modern_kinetic_gun{GunId:"tacz:ak47",GunFireMode:"AUTO",GunCurrentAmmoCount:30,HasBulletInBarrel:1b,AttachmentMUZZLE:{id:"tacz:attachment",Count:1b,tag:{AttachmentId:"tacz:muzzle_silencer_ursus"}}}',
             skin: 'anomalyzone:textures/entity/ambient/ambient_10_misc2.png',
             armor: { 'armor.chest': 'itz:psz_chestplate_freedom', 'armor.legs': 'itz:psz_leggings_freedom', 'armor.feet': 'itz:psz_boots_freedom' } },
  rusak:   { name: 'Quartermaster Rusak', title: 'The Armoury',        team: 'armoury',    dialog: 85 }
}

Object.keys(ZQG).forEach(function (key) {
  ServerEvents.customCommand('zone_npc_' + key, function (event) {
    var p = event.player
    if (!p) return
    var n = ZQG[key], srv = event.server
    var x = Math.floor(p.x), y = Math.floor(p.y), z = Math.floor(p.z)
    var yaw = Math.round(p.yaw * 10) / 10
    var dim = 'execute in ' + p.level.dimension + ' run '
    var tag = 'zq_' + key
    srv.runCommandSilent('kill @e[type=customnpcs:customnpc,tag=' + tag + ']')
    var nbt = '{Name:"' + n.name + '",Title:"' + n.title + '",' +
      'NPCDialogOptions:[{DialogSlot:0,NPCDialog:{Title:"Talk",Dialog:' + n.dialog + ',DialogColor:14737632,OptionType:1,DialogCommand:""}}],' +
      'StartPosNew:[I;' + x + ',' + y + ',' + z + '],MovementType:0,ReturnToStart:1b,' +
      (n.skin ? 'Texture:"' + n.skin + '",' : '') + 'Invulnerable:1b,PersistenceRequired:1b,Rotation:[' + yaw + 'f,0f],Tags:["zone_qnpc","' + tag + '"]}'
    srv.runCommandSilent(dim + 'summon customnpcs:customnpc ' + (x + 0.5) + ' ' + y + ' ' + (z + 0.5) + ' ' + nbt)
    srv.runCommandSilent('team join ' + n.team + ' @e[type=customnpcs:customnpc,tag=' + tag + ']')
    if (n.armor) Object.keys(n.armor).forEach(function (s) { srv.runCommandSilent('execute in minecraft:overworld run item replace entity @e[type=customnpcs:customnpc,tag=' + tag + ',limit=1] ' + s + ' with ' + n.armor[s]) })
    if (n.gun) srv.runCommandSilent('item replace entity @e[type=customnpcs:customnpc,tag=' + tag + ',limit=1] weapon.mainhand with ' + n.gun)
    p.tell(Text.of('Placed ' + n.name + ' at ' + x + ' ' + y + ' ' + z + '. Step off the spot and right-click to talk.').color(0x9BD86A))
  })
})

ServerEvents.customCommand('zone_npc_remove', function (event) {
  var p = event.player
  if (!p) return
  event.server.runCommandSilent('execute as ' + p.username + ' at @s run kill @e[type=customnpcs:customnpc,tag=zone_qnpc,distance=..2,limit=1,sort=nearest]')
  p.tell(Text.of('Removed the nearest quest-giver (if there was one within 2 blocks).').color(0xD8B225))
})

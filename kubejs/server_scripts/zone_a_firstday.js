// First Day (Slade): who you were, what you wear, and Pasha's lessons.
// Named zone_a_... so it loads before zone_ammo.js (that one cancels the crate click, which would hide it from us).
//
//  1. Tolik (dialog 24 -> 570): "Who were you, before the Zone?" Six backgrounds, each with its own starting gun
//     (dialogs 571-576). Picked once per player; the kit is given when the answer is read.
//  2. The footlocker by the bed (dialog 580): six starter outfits (581-586). They are looks only: every set gets the
//     same protection (STARTER_ARMOR) and is tagged zone_starter, so Old Moe won't buy them (zone_sell_barrel.js).
//     You can change outfit there again while everything you wear is starter clothing (or empty).
//  3. Pasha's lessons, between "See Pasha" (10) and the turned patrol (11), plus a last talk before Yarik (13):
//       14 Moving      : set a slow pace (Alt + wheel), walk to the firing range          -> dialog 561 finishes it
//       15 Up and Down : raise (Caps Lock), shoot the 5 targets at the range               -> 562
//       16 Feeding     : use Moe's ammo crate                                              -> 563
//       17 Money       : open Moe's sell barrel                                            -> 564 (then 11, 12 as before)
//       18 Better Gear : after the stew (12), Pasha's last lesson                          -> 565 (then 13 Yarik)
//     Each lesson's briefing pops up by itself, a hint shows on the action bar while it's open, and Pasha's
//     "Repeat the lesson." (566) shows the current one again.
//
// Op commands:
//   /kubejs custom_command zone_firstday_locker_here   look at the footlocker block (by the bed) and run it
//   /kubejs custom_command zone_firstday_range_here    stand where the targets should stand, facing the shooter
//   /kubejs custom_command zone_firstday_status        what's set, your background, your lesson
//   /kubejs custom_command zone_firstday_repick        ask yourself Tolik's question again (clears your background)
//   /kubejs custom_command zone_firstday_offer_all     offer the background question to everyone online who never had it
var ZFD = {
  D: { who: 570, bgFirst: 571, bgLast: 576, locker: 580, outFirst: 581, outLast: 586,
       l1: 560, l1done: 561, l2done: 562, l3done: 563, l4done: 564, gear: 565, repeat: 566 },
  Q: { l1: 14, l2: 15, l3: 16, l4: 17, gear: 18, wake: 9 },
  PACE_SLOW: 0.75,                 // pace at or below this counts as "slow" (1.0 = full speed)
  RANGE_NEAR: 14,                  // lesson 1: this close to the range marker
  TARGETS: 5,
  TARGET_SKIN: 'anomalyzone:textures/entity/ambient/ambient_10_misc2.png',   // dummy's clothes (pumpkin head on top)
  TARGET_GAP: 1.25,               // blocks between targets in the row (the range balcony is narrow)
  BARREL: { x: -1527, y: 83, z: 89 },   // Old Moe's sell barrel (zone_sell_barrel.js)
  STARTER_ARMOR: { chest: 3, legs: 2, feet: 1 },
  BG: {
    571: { key: 'soldier', name: 'The soldier',
           gun: { id: 'fzbe:kiparis', mode: 'AUTO', mag: 10, lore: 'Military issue. Short bursts.' },
           ammo: ['tacz:9x18', 30], items: [['tarkovdayz:bandge', 2]] },
    572: { key: 'hunter', name: 'The hunter',
           gun: { id: 'fzbe:izh18_0_0', mode: 'SEMI', mag: 1, lore: 'One shell, one chance.' },
           ammo: ['tacz:12g', 12], items: [['anomalyzone:stew_can', 2]] },
    573: { key: 'crowd', name: 'The wrong crowd',
           gun: { id: 'ra1k:m870_obrez', mode: 'SEMI', mag: 4, lore: 'Ugly, short, honest.' },
           ammo: ['tacz:12g', 8], items: [['anomalyzone:vodka_hryuchevo', 1]] },
    574: { key: 'militia', name: 'The militiaman',
           gun: { id: 'fzbe:pb', mode: 'SEMI', mag: 8, lore: 'Quiet work for quiet people.' },
           ammo: ['tacz:9x18', 24], items: [['tarkovdayz:bandge', 1]] },
    575: { key: 'medic', name: 'The medic',
           gun: { id: 'ra1k:fort12', mode: 'SEMI', mag: 12, lore: 'Patch yourself first.' },
           ammo: ['tacz:9x18', 24], items: [['tarkovdayz:ai_2', 1], ['tarkovdayz:bandge', 2], ['itz:anti_rads', 1]] },
    576: { key: 'nobody', name: 'Nobody',
           gun: { id: 'ra1k:pm', mode: 'SEMI', mag: 8, lore: 'Start fresh.' },
           ammo: ['tacz:9x18', 16], items: [['tarkovdayz:rubble_1000', 5]] }
  },
  OUTFITS: {
    581: { name: 'Rookie jacket',   chest: 'itz:rookie_chestplate',            legs: 'itz:rookie_leggings',              feet: 'itz:rookie_boots' },
    582: { name: 'Loner coveralls', chest: 'itz:psz_chestplate_loner',         legs: 'itz:psz_leggings_loner',           feet: 'itz:psz_boots_loner' },
    583: { name: 'Soviet surplus',  chest: 'fracturepoint:soviet_soldier_chestplate', legs: 'fracturepoint:soviet_leggings', feet: 'fracturepoint:soviet_boots' },
    584: { name: 'Woodland camo',   chest: 'fracturepoint:iz_chestplate_forest', legs: 'fracturepoint:iz_leggings_forest', feet: 'fracturepoint:iz_boots_forest' },
    585: { name: 'Desert camo',     chest: 'fracturepoint:iz_chestplate_desert', legs: 'fracturepoint:iz_leggings_desert', feet: 'fracturepoint:iz_boots_desert' },
    586: { name: 'Rebel gear',      chest: 'fracturepoint:insurgency_commander_chestplate', legs: 'fracturepoint:insurgency_commander_leggings', feet: 'fracturepoint:insurgency_commander_boots' }
  },
  // quest completion screens (also in the quest files; set here too so they're right without a restart)
  QUEST_DONE_TEXT: {
    9: 'You found Old Moe. He sized you up and grunted.',
    17: 'How the sell barrel works:\n\n' +
        '1. Put anything you want to sell in the barrel next to Old Moe\'s counter. You can move things straight from your backpack.\n' +
        '2. Close the barrel. Moe pays on the spot, in 1,000 ruble notes left in the barrel. Take them out.\n' +
        '3. Anything he won\'t buy stays in the barrel. He won\'t take your starter gear.\n\n' +
        'Cash drops when you die. Bank it at the ATM, the safe at the back of the Bar, and withdraw it there when you need it.'
  },
  HINTS: {
    14: 'Lesson 1: hold Alt and scroll down for a slow pace, then walk to the firing range',
    15: 'Lesson 2: Caps Lock raises your weapon. Shoot the targets at the range',
    16: 'Lesson 3: hold your gun and use Old Moe\'s ammo crate in the Bar',
    17: 'Lesson 4: open Old Moe\'s sell barrel by his counter'
  }
}
var zfdTick = 0, zfdApi = null, zfdWarned = {}, zfdSlot = null

function zfdErr(k, e) { if (!zfdWarned[k]) { zfdWarned[k] = true; console.error('[zone] first day ' + k + ': ' + e) } }
function zfdIP(p) { if (!zfdApi) zfdApi = Java.loadClass('noppes.npcs.api.NpcAPI').Instance(); return zfdApi.getIEntity(p) }
function zfdOW(c) { return 'execute in minecraft:overworld run ' + c }
function zfdPos(srv, key) {
  try { var s = String(srv.persistentData.getString('zone_fd_' + key) || ''); return s ? JSON.parse(s) : null } catch (e) { return null }
}
function zfdSetPos(srv, key, v) { srv.persistentData.putString('zone_fd_' + key, JSON.stringify(v)) }
function zfdPD(p) { return p.persistentData }
function zfdCall(o, names, a) {
  for (var i = 0; i < names.length; i++) { var f = o[names[i]]; if (typeof f === 'function') return a === undefined ? f.call(o) : f.call(o, a) }
  return undefined
}
function zfdIsStarter(stack) {
  try {
    if (!stack || stack.isEmpty()) return false
    var t = stack.nbt
    return !!(t && zfdCall(t, ['getBoolean', 'm_128471_'], 'zone_starter'))
  } catch (e) { return false }
}
function zfdSay(p, msg, color) { p.statusMessage = Text.of(msg).color(color || 0xD8B225) }

// ---------------------------------------------------------------- 1. backgrounds
function zfdGiveKit(p, bgId) {
  var bg = ZFD.BG[bgId], n = p.username, srv = p.server
  var g = bg.gun
  var lore = "display:{Lore:['{\"text\":\"" + g.lore + "\",\"italic\":true,\"color\":\"gray\"}']}"
  srv.runCommandSilent('give ' + n + ' tacz:modern_kinetic_gun{GunId:"' + g.id + '",GunFireMode:"' + g.mode + '",GunCurrentAmmoCount:' + g.mag +
    ',HasBulletInBarrel:1b,zone_starter:1b,' + lore + '} 1')
  srv.runCommandSilent('give ' + n + ' tacz:ammo{AmmoId:"' + bg.ammo[0] + '"} ' + bg.ammo[1])
  bg.items.forEach(function (it) { srv.runCommandSilent('give ' + n + ' ' + it[0] + ' ' + it[1]) })
}
function zfdBackgrounds(p, ip) {
  for (var id = ZFD.D.bgFirst; id <= ZFD.D.bgLast; id++) {
    if (!ip.hasReadDialog(id)) continue
    ip.removeDialog(id)
    var pd = zfdPD(p)
    if (pd.getString('zone_bg')) { zfdSay(p, 'Tolik already gave you your things.', 0x9A9A90); continue }
    pd.putString('zone_bg', ZFD.BG[id].key)
    zfdGiveKit(p, id)
    console.info('[zone] first day: ' + p.username + ' is ' + ZFD.BG[id].name)
  }
}

// ---------------------------------------------------------------- 2. the footlocker
var ZFD_SLOTS = { chest: 'armor.chest', legs: 'armor.legs', feet: 'armor.feet' }
var zfdES = null
function zfdWorn(p, slot) {
  if (!zfdES) zfdES = Java.loadClass('net.minecraft.world.entity.EquipmentSlot')
  var es = slot === 'chest' ? zfdES.CHEST : slot === 'legs' ? zfdES.LEGS : zfdES.FEET
  return zfdCall(p, ['getItemBySlot', 'm_6844_'], es)
}
function zfdOutfit(p, ip) {
  for (var id = ZFD.D.outFirst; id <= ZFD.D.outLast; id++) {
    if (!ip.hasReadDialog(id)) continue
    ip.removeDialog(id)
    var o = ZFD.OUTFITS[id], blocked = []
    Object.keys(ZFD_SLOTS).forEach(function (s) {
      var w = zfdWorn(p, s)
      if (w && !w.isEmpty() && !zfdIsStarter(w)) blocked.push(s)
    })
    if (blocked.length) {
      p.tell(Text.of("You're wearing real gear. Take it off first if you want the footlocker clothes.").color(0xD86A6A))
      continue
    }
    var uuids = { chest: '[I;1514275329,-1129757521,-1442517473,1101200641]', legs: '[I;1514275330,-1129757521,-1442517473,1101200642]',
                  feet: '[I;1514275331,-1129757521,-1442517473,1101200643]' }
    Object.keys(ZFD_SLOTS).forEach(function (s) {
      var nbt = '{zone_starter:1b,display:{Lore:[\'{"text":"Starter clothes","italic":true,"color":"gray"}\']},' +
        'AttributeModifiers:[{AttributeName:"minecraft:generic.armor",Name:"zone_starter",Amount:' + ZFD.STARTER_ARMOR[s] + 'd,Operation:0,UUID:' + uuids[s] + ',Slot:"' + s + '"}]}'
      p.server.runCommandSilent('item replace entity ' + p.username + ' ' + ZFD_SLOTS[s] + ' with ' + o[s] + nbt)
    })
    zfdPD(p).putString('zone_outfit', o.name)
    zfdSay(p, 'Dressed: ' + o.name, 0x9BD86A)
  }
}
BlockEvents.rightClicked(function (event) {
  var isLocker = false
  try {
    var b = event.block, p = event.player, srv = event.server
    var lk = zfdPos(srv, 'locker')
    isLocker = !!(lk && b.x === lk.x && b.z === lk.z && Math.abs(b.y - lk.y) <= 1)   // either half of a 2-tall locker
    if (String(event.hand) == 'MAIN_HAND') {
      if (isLocker) zfdIP(p).showDialog(ZFD.D.locker, 'Locker')
      // lesson 3: Moe's ammo crate (zone_ammo.js marks the blocks)
      var crates = srv.persistentData.getCompound('zone_ammo_crates')
      if (!isLocker && crates.contains(b.x + ',' + b.y + ',' + b.z)) zfdPD(p).putBoolean('zone_fd_crate', true)
    }
  } catch (e) { zfdErr('click', e) }
  // outside the try: cancel() ends the handler by throwing, and a catch would swallow it (the locker's own storage
  // then opened instead). Both hands are cancelled so the off-hand click can't open it either.
  if (isLocker) event.cancel()
})

// ---------------------------------------------------------------- 3. lessons
// lesson 4: opened Moe's sell barrel
PlayerEvents.inventoryClosed(function (event) {
  try {
    var p = event.player, B = ZFD.BARREL
    if (Math.abs(p.x - B.x) > 7 || Math.abs(p.z - B.z) > 7 || Math.abs(p.y - B.y) > 4) return
    var be = p.level.getBlock(B.x, B.y, B.z).entity
    if (!be) return
    var cont = zfdCall(event.inventoryContainer, ['getContainer', 'm_39261_'])
    if (cont === be) zfdPD(p).putBoolean('zone_fd_barrel', true)
  } catch (e) { zfdErr('barrel', e) }
})
// lesson 2: targets
EntityEvents.death(function (event) {
  try {
    var e = event.entity
    if (!e.tags.contains('zone_fd_target')) return
    var p = event.source.player
    if (!p) return
    if (!zfdIP(p).hasActiveQuest(ZFD.Q.l2)) return
    var pd = zfdPD(p), n = pd.getInt('zone_fd_hits') + 1
    pd.putInt('zone_fd_hits', n)
    zfdSay(p, 'Target down (' + Math.min(n, ZFD.TARGETS) + '/' + ZFD.TARGETS + ')', 0x9BD86A)
  } catch (err) { zfdErr('target', err) }
})
function zfdTargets(srv, force) {
  var r = zfdPos(srv, 'range')
  if (!r) return
  var want = !!force
  srv.players.forEach(function (p) {
    if (Math.hypot(p.x - r.x, p.z - r.z) < 48) want = true   // always up for anyone at the range (kills only count on lesson 2)
  })
  if (!want) return
  if (Number(srv.runCommandSilent(zfdOW('execute if loaded ' + Math.floor(r.x) + ' ' + Math.floor(r.y) + ' ' + Math.floor(r.z)).replace('run execute ', ''))) <= 0) return
  var have = Number(srv.runCommandSilent('execute in minecraft:overworld positioned ' + r.x + ' ' + r.y + ' ' + r.z +
    ' if entity @e[type=customnpcs:customnpc,tag=zone_fd_target,distance=..16]')) || 0
  if (have >= ZFD.TARGETS) return
  // a row across the shooting lane
  var yaw = r.yaw * 3.141592653589793 / 180, sx = Math.cos(yaw), sz = Math.sin(yaw)   // (Math.PI is NaN in this Rhino)
  if (!isFinite(sx)) { sx = 1; sz = 0 }
  for (var i = have; i < ZFD.TARGETS; i++) {
    var off = (i - (ZFD.TARGETS - 1) / 2) * ZFD.TARGET_GAP
    var x = r.x + sx * off, z = r.z + sz * off
    // a still, silent Custom NPC dressed as a dummy (vanilla zombies wobbled with our animation pack and groaned)
    srv.runCommandSilent(zfdOW('summon customnpcs:customnpc ' + x + ' ' + r.y + ' ' + z + ' {Name:"Target",Title:"",' +
      'Texture:"' + ZFD.TARGET_SKIN + '",MaxHealth:1,Health:1f,SpawnCycle:3,HideBodyWhenKilled:1b,MovementType:0,ReturnToStart:1b,StandingState:1,Orientation:' + Math.round(r.yaw) + ',FactionID:1,' +   // faction 1 = Neutral (0 = Friendly can't be hurt)
      'StartPosNew:[I;' + Math.floor(x) + ',' + Math.floor(r.y) + ',' + Math.floor(z) + '],NpcHurtSound:"",NpcDeathSound:"",NpcIdleSound:"",NpcAngrySound:"",NpcStepSound:"",' +
      'PersistenceRequired:1b,Rotation:[' + r.yaw + 'f,0f],Tags:["zone_fd_target","zone_keep","zone_story"]}'))
    srv.runCommandSilent(zfdOW('item replace entity @e[type=customnpcs:customnpc,tag=zone_fd_target,tag=!zone_fd_dressed] armor.head with minecraft:carved_pumpkin'))
    srv.runCommandSilent(zfdOW('tag @e[type=customnpcs:customnpc,tag=zone_fd_target] add zone_fd_dressed'))
    // their own team: zone_factions.js puts team-less Custom NPCs on the Scavengers, who can't be hurt by players
    srv.runCommandSilent('team add zone_targets {"text":"Targets"}')
    srv.runCommandSilent('team modify zone_targets nametagVisibility never')
    srv.runCommandSilent(zfdOW('team join zone_targets @e[type=customnpcs:customnpc,tag=zone_fd_target]'))
  }
}
// remove every target (and the old zombie ones). discard, not /kill: a Custom NPC set to respawn would come back.
function zfdClearTargets(srv) {
  srv.overworld().getEntities().forEach(function (e) {
    try { if (e.tags.contains('zone_fd_target')) zfdCall(e, ['discard', 'm_146870_']) } catch (err) {}
  })
}
var zfdOldGone = false
function zfdWaypoint(p, name, pos) {
  if (global.zoneQuestMarkers) return   // 0.77: zone_quest_markers.js shows quest markers + adds places on discovery
  p.tell(Text.of('New location on your map: ').color(0xD8B225).append(Text.of(name).color(0xFFFFFF)))
  p.tell(Text.of('xaero-waypoint:' + name + ':' + name.charAt(0) + ':' + Math.floor(pos.x) + ':' + Math.floor(pos.y) + ':' + Math.floor(pos.z) +
    ':14:false:0:Internal-overworld-waypoints'))
}
// Walking pace (Alt + wheel) is a "Walking pace" movement-speed modifier from zone_tactical_anims (ServerPace).
// Raising a weapon uses the same modifier, so it only counts while the weapon is lowered.
var zfdPaceJ = null
function zfdSlowPace(p) {
  try {
    if (!zfdPaceJ) zfdPaceJ = { uuid: Java.loadClass('java.util.UUID').fromString('9c3e1f52-4b7a-4d0e-8f21-6a5d3c7b9e04'),
      speed: Java.loadClass('net.minecraft.world.entity.ai.attributes.Attributes').MOVEMENT_SPEED,
      ready: Java.loadClass('com.slade.zonetactical.ready.ServerReady') }
    if (zfdPaceJ.ready.isRaised(p)) return false
    var inst = zfdCall(p, ['getAttribute', 'm_21051_'], zfdPaceJ.speed)
    var mod = inst ? zfdCall(inst, ['getModifier', 'm_22111_'], zfdPaceJ.uuid) : null
    if (!mod) return false
    return 1 + Number(zfdCall(mod, ['getAmount', 'm_22218_'])) <= ZFD.PACE_SLOW
  } catch (e) { zfdErr('pace', e); return false }
}
// which briefing belongs to the lesson that's open now (for "Repeat the lesson.")
function zfdCurrent(ip) {
  if (ip.hasActiveQuest(ZFD.Q.l1)) return ZFD.D.l1
  if (ip.hasActiveQuest(ZFD.Q.l2)) return ZFD.D.l1done
  if (ip.hasActiveQuest(ZFD.Q.l3)) return ZFD.D.l2done
  if (ip.hasActiveQuest(ZFD.Q.l4)) return ZFD.D.l3done
  if (ip.hasActiveQuest(11) || ip.hasActiveQuest(12)) return ZFD.D.l4done
  if (ip.hasActiveQuest(ZFD.Q.gear)) return ZFD.D.gear
  return -1
}
function zfdLessons(p, ip) {
  var pd = zfdPD(p), srv = p.server
  // "Repeat the lesson."
  if (ip.hasReadDialog(ZFD.D.repeat)) {
    ip.removeDialog(ZFD.D.repeat)
    var cur = zfdCurrent(ip)
    if (cur > 0) { ip.removeDialog(cur); ip.showDialog(cur, 'Pasha') }
  }
  // lesson 1
  if (ip.hasActiveQuest(ZFD.Q.l1)) {
    if (!pd.getBoolean('zone_fd_b1')) {
      pd.putBoolean('zone_fd_b1', true)
      srv.scheduleInTicks(40, function () { try { zfdIP(p).showDialog(ZFD.D.l1, 'Pasha') } catch (e) { zfdErr('brief', e) } })
      var r0 = zfdPos(srv, 'range')
      if (r0) zfdWaypoint(p, 'Firing Range', r0)
    }
    var slow = zfdSlowPace(p)
    if (slow && !pd.getBoolean('zone_fd_slow')) { pd.putBoolean('zone_fd_slow', true); zfdSay(p, 'Slow and quiet. Now walk to the firing range.', 0x9BD86A) }
    var r = zfdPos(srv, 'range')
    if (pd.getBoolean('zone_fd_slow') && r && Math.hypot(p.x - r.x, p.z - r.z) <= ZFD.RANGE_NEAR && Math.abs(p.y - r.y) < 6) {
      if (!pd.getBoolean('zone_fd_l1ok')) { pd.putBoolean('zone_fd_l1ok', true); pd.putInt('zone_fd_hits', 0) }
      zfdShowOnce(p, ip, ZFD.D.l1done)
    }
  }
  if (ip.hasActiveQuest(ZFD.Q.l2) && pd.getInt('zone_fd_hits') >= ZFD.TARGETS) zfdShowOnce(p, ip, ZFD.D.l2done)
  if (ip.hasActiveQuest(ZFD.Q.l3) && pd.getBoolean('zone_fd_crate')) zfdShowOnce(p, ip, ZFD.D.l3done)
  if (ip.hasActiveQuest(ZFD.Q.l4) && pd.getBoolean('zone_fd_barrel')) zfdShowOnce(p, ip, ZFD.D.l4done)
  if (ip.hasActiveQuest(ZFD.Q.gear)) zfdShowOnce(p, ip, ZFD.D.gear)
  // flags only count while their lesson is open
  if (!ip.hasActiveQuest(ZFD.Q.l3)) pd.putBoolean('zone_fd_crate', false)
  if (!ip.hasActiveQuest(ZFD.Q.l4)) pd.putBoolean('zone_fd_barrel', false)
}
// show a "lesson done" dialog; if they somehow close it, show it again 20 s later (reading it finishes the quest)
// Safety net: if the dialog was read but Custom NPCs still hasn't closed the quest 30 s later (seen once, when the
// scripts were reloaded mid-lesson), the script finishes it and starts the next quest itself.
var ZFD_NEXT = { 561: [14, 15], 562: [15, 16], 563: [16, 17], 564: [17, 11], 565: [18, 13] }
function zfdShowOnce(p, ip, did) {
  var pd = zfdPD(p), key = 'zone_fd_shown_' + did, now = p.server.tickCount, last = pd.getInt(key)
  if (ip.hasReadDialog(did)) {
    var rk = 'zone_fd_read_' + did, since = pd.getInt(rk)
    if (since <= 0 || now < since) { pd.putInt(rk, now); return }
    if (now - since < 600) return
    var qn = ZFD_NEXT[did]
    if (qn && ip.hasActiveQuest(qn[0])) {
      try { ip.finishQuest(qn[0]) } catch (e) { zfdErr('finish', e) }
      try { ip.stopQuest(qn[0]) } catch (e) {}
      try { if (!ip.hasActiveQuest(qn[1]) && !ip.hasFinishedQuest(qn[1])) ip.startQuest(qn[1]) } catch (e) { zfdErr('next', e) }
      console.info('[zone] first day: finished quest ' + qn[0] + ' for ' + p.username + ' by hand (it was stuck)')
    }
    return
  }
  if (last > 0 && now - last < 400 && now >= last) return
  pd.putInt(key, now)
  ip.showDialog(did, 'Pasha')
}
function zfdHints(p, ip) {
  var keys = Object.keys(ZFD.HINTS)
  for (var i = 0; i < keys.length; i++) {
    if (ip.hasActiveQuest(Number(keys[i]))) { zfdSay(p, ZFD.HINTS[keys[i]]); return }
  }
  // new player who hasn't talked to Tolik or opened the footlocker yet
  var pd = zfdPD(p)
  if (!pd.getString('zone_bg') && !ip.hasFinishedQuest(ZFD.Q.wake) && !ip.hasActiveQuest(ZFD.Q.wake)) { zfdSay(p, 'Talk to Tolik, the man by your bed (right-click him)'); return }
  if (pd.getString('zone_bg') && !pd.getString('zone_outfit') && ip.hasActiveQuest(ZFD.Q.wake)) zfdSay(p, 'Your clothes are in the locker in the corner of the room')
}

ServerEvents.tick(function (event) {
  zfdTick++
  var srv = event.server
  if (zfdTick % 10 === 0) {
    srv.players.forEach(function (p) {
      try {
        var ip = zfdIP(p)
        zfdBackgrounds(p, ip)
        zfdOutfit(p, ip)
        zfdLessons(p, ip)
        if (zfdTick % 60 === 0) zfdHints(p, ip)
      } catch (e) { zfdErr('player', e) }
    })
  }
  if (zfdTick % 100 === 0) {
    if (!zfdOldGone) { zfdOldGone = true; try { srv.runCommandSilent(zfdOW('kill @e[type=minecraft:zombie,tag=zone_fd_target]')) } catch (e) {} }
    try { zfdTargets(srv) } catch (e) { zfdErr('targets', e) }
  }
})

// ---------------------------------------------------------------- op commands
ServerEvents.customCommand('zone_firstday_locker_here', function (event) {
  var p = event.player
  if (!p) return
  var hit = p.rayTrace(6, false)
  if (!hit || !hit.block) { p.tell('Look at the footlocker block first.'); return }
  zfdSetPos(event.server, 'locker', { x: hit.block.x, y: hit.block.y, z: hit.block.z })
  p.tell(Text.of('Footlocker set at ' + hit.block.x + ' ' + hit.block.y + ' ' + hit.block.z + '. Right-clicking it opens the outfit choice.').color(0x9BD86A))
})
ServerEvents.customCommand('zone_firstday_range_here', function (event) {
  var p = event.player
  if (!p) return
  // targets stand in a row here; yaw is kept so the row runs across the lane
  zfdSetPos(event.server, 'range', { x: Math.floor(p.x) + 0.5, y: Math.floor(p.y), z: Math.floor(p.z) + 0.5, yaw: Math.round(p.yaw) })
  zfdClearTargets(event.server)
  p.tell(Text.of('Firing range set here. Targets appear in a row while someone is on Lesson 2.').color(0x9BD86A))
})
// /kubejs custom_command zone_firstday_show_targets   put the targets up now (to check the range without the lesson)
ServerEvents.customCommand('zone_firstday_show_targets', function (event) {
  zfdTargets(event.server, true)
  if (event.player) event.player.tell(Text.of('Targets up (they stay until shot, or until zone_firstday_range_here is run again).').color(0x9BD86A))
})
ServerEvents.customCommand('zone_firstday_status', function (event) {
  var p = event.player, srv = event.server
  if (!p) return
  var ip = zfdIP(p), pd = zfdPD(p)
  var lk = zfdPos(srv, 'locker'), r = zfdPos(srv, 'range')
  p.tell('Footlocker: ' + (lk ? lk.x + ' ' + lk.y + ' ' + lk.z : 'NOT SET') + ' | Range: ' + (r ? Math.floor(r.x) + ' ' + r.y + ' ' + Math.floor(r.z) : 'NOT SET'))
  var q = []
  ;[9, 10, 14, 15, 16, 17, 11, 12, 18, 13].forEach(function (id) { q.push(id + (ip.hasActiveQuest(id) ? ':active' : ip.hasFinishedQuest(id) ? ':done' : ':-')) })
  p.tell('You: background ' + (pd.getString('zone_bg') || '-') + ', outfit ' + (pd.getString('zone_outfit') || '-') + ', targets ' + pd.getInt('zone_fd_hits') + ' | ' + q.join(' '))
})
ServerEvents.customCommand('zone_firstday_repick', function (event) {
  var p = event.player
  if (!p) return
  zfdPD(p).putString('zone_bg', '')
  zfdIP(p).showDialog(ZFD.D.who, 'Tolik')
})
ServerEvents.customCommand('zone_firstday_offer_all', function (event) {
  var n = 0
  event.server.players.forEach(function (p) {
    var pd = zfdPD(p)
    if (pd.getString('zone_bg') || pd.getBoolean('zone_fd_offered')) return
    pd.putBoolean('zone_fd_offered', true)
    zfdIP(p).showDialog(ZFD.D.who, 'Tolik')
    n++
  })
  if (event.player) event.player.tell('Offered the background question to ' + n + ' player(s).')
})

// ---------------------------------------------------------------- line breaks in dialog text
// Custom NPCs' file reader keeps "\n" in a dialog file as the two characters \ and n (and it can't store a real line
// break in the file at all), but its dialog screen does break lines on a real newline. So once after every start or
// script reload, every loaded dialog's literal \n becomes a real line break. Covers all our hand-written dialogs.
var zfdNlDone = false
function zfdFixNewlines() {
  zfdNlDone = true
  var DC = Java.loadClass('noppes.npcs.controllers.DialogController').instance, n = 0
  DC.dialogs.values().forEach(function (d) {
    var t = String(d.text || '')
    if (t.indexOf('\\n') < 0) return
    d.text = t.split('\\n').join('\n')
    n++
  })
  console.info('[zone] first day: line breaks fixed in ' + n + ' dialogs')
  // wording that changed after the files were loaded (the files have it too; this covers the time until a restart)
  var TXT = [['footlocker at the end of the bed', 'locker in the corner'], ['Clothes, folded by someone', 'Clothes, hung up by someone'],
             ['Close the lid.', 'Close the locker.'], ['Footlocker', 'Locker']]
  DC.dialogs.values().forEach(function (d) {
    TXT.forEach(function (r) {
      if (String(d.text).indexOf(r[0]) >= 0) d.text = String(d.text).split(r[0]).join(r[1])
      if (String(d.title) === r[0]) d.title = r[1]
    })
    try {
      d.options.values().forEach(function (o) { TXT.forEach(function (r) { if (String(o.title) === r[0]) o.title = r[1] }) })
    } catch (e) { zfdErr('option titles', e) }
  })
  // quest 9's old completion line (the file has the new one; this covers the time until a restart)
  try {
    var QC = Java.loadClass('noppes.npcs.controllers.QuestController').instance, QI = Java.loadClass('java.lang.Integer')
    Object.keys(ZFD.QUEST_DONE_TEXT).forEach(function (id) {
      var q = QC.quests.get(QI.valueOf(String(id)))
      if (q) q.completeText = ZFD.QUEST_DONE_TEXT[id]
    })
  } catch (e) { zfdErr('quest texts', e) }
  // players' games keep their own copy of every dialog and quest from when they logged in: send the fixed ones
  var SC = Java.loadClass('noppes.npcs.controllers.SyncController')
  SC.syncAllDialogs()
  SC.syncAllQuests()
}
ServerEvents.tick(function (event) {
  if (zfdNlDone) return
  try { zfdFixNewlines() } catch (e) { zfdNlDone = true; zfdErr('newlines', e) }
})

// /kubejs custom_command zone_firstday_reset_me   (testing) wipe your own First Day progress: Wake Up, First Steps,
// Pasha's lessons, the dialogs that finish them, your background and outfit. Then talk to Tolik again.
ServerEvents.customCommand('zone_firstday_reset_me', function (event) {
  var p = event.player
  if (!p) return
  var ip = zfdIP(p), pd = zfdPD(p)
  ;[9, 10, 14, 15, 16, 17, 11, 12, 18, 13].forEach(function (q) {
    try { if (ip.hasActiveQuest(q)) ip.stopQuest(q) } catch (e) {}
    try { ip.removeQuest(q) } catch (e) {}
  })
  var dl = [24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 93, 94]
  for (var d = 560; d <= 586; d++) dl.push(d)
  dl.forEach(function (d) { try { ip.removeDialog(d) } catch (e) {} })
  pd.getAllKeys().toArray().forEach(function (k) {
    k = String(k)
    if (k === 'zone_bg' || k === 'zone_outfit' || k.indexOf('zone_fd_') === 0) pd.remove(k)
  })
  p.tell(Text.of('First Day progress wiped. Talk to Tolik to start over.').color(0x9BD86A))
})

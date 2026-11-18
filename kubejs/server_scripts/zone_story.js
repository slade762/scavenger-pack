// SCAVENGER story, Act 1 "The Song" (Slade). Canon: the Lore Bible doc.
// Dialogs and quests live in world/customnpcs (Act 1 dialogs 100-149, quests 100-108; NPC ranges per the Lore Bible).
//
// What this script does:
//  - Places the Act 1 people at their locations once zone_pois.js has built them (and keeps them there):
//      Sgt Hrytsenko (Checkpoint 4), Kostya (Pumping Station), Baba Nadya (Kovalenko Farm), Lev (Radio Mast),
//      Sparrow and the Cantor (Dead Orchard). Shatun has no POI yet: place him by hand (command below).
//  - Gives Grandpa at the Bar his dialog. Sparrow leaves the Bar until somebody brings him home (quest 107).
//  - Spawns the 6 "Dead Crewman" zombies at the Mi-8 Crash Site and the "Choir Acolyte"s at the Dead Orchard.
//  - Hands out the flight recorder from the Mi-8 cockpit to players on "Black Box" / "Dead Air".
//  - The Cantor walks off after his one polite warning, and comes back later.
//  - Trader stock tiers (world-wide: the highest anyone on the server has unlocked).
//  - "Cash out rubles" at Custom NPCs traders: turns PDA rubles into Tarkov notes (dialogs 148/149).
//  - Map waypoints (Xaero's) for the places quests send you to.
//  - The Seraph speaks when players reach its vault (set VAULT once the vault is built). No quest points there.
//
// Op commands (stand on the spot, face the way they should face):
//   /kubejs custom_command zone_story_<key>      place that NPC here instead (keys: hrytsenko kostya nadya lev sparrow cantor shatun)
//   /kubejs custom_command zone_story_auto       hand every NPC back to automatic placement
//   /kubejs custom_command zone_story_status     what's placed, which tiers are open
//   /kubejs custom_command zone_story_vault_here mark the Seraph's vault (where you stand, 24-block radius)

var ZST = {
  // POI templates (kubejs/data/zone/structures): footprint sizes, matching zone_pois.js
  SIZE: { checkpoint: [19, 15], pumping: [17, 15], farm: [21, 17], heli: [21, 13], mast: [11, 11], orchard: [17, 17] },
  NPCS: {
    hrytsenko: { name: 'Sergeant Hrytsenko', title: 'Checkpoint 4', poi: 'checkpoint', at: [14, 4, 4], team: 'military', dialog: 190, market: 'hrytsenko',
                 skin: 'anomalyzone:textures/entity/ambient/ambient_05_duty_recruit.png',
                 armor: { 'armor.chest': 'itz:psz_chestplate_military', 'armor.legs': 'itz:psz_leggings_military', 'armor.feet': 'itz:psz_boots_military' } },
    kostya:    { name: 'Kostya', title: 'Pumping Station', poi: 'pumping', at: [8, 4, 7], team: 'scavengers', dialog: 170, market: 'kostya',
                 skin: 'anomalyzone:textures/entity/ambient/ambient_11_misc3.png' },
    nadya:     { name: 'Baba Nadya', title: 'Kovalenko Farm', poi: 'farm', at: [3, 4, 4], team: 'scavengers', dialog: 150, market: 'nadya',
                 skin: 'customnpcs:textures/entity/humanfemale/townsmanstephanie.png' },
    lev:       { name: 'Lev', title: 'Radio Mast', poi: 'mast', at: [2, 4, 7], team: 'scavengers', dialog: 210, market: 'lev',
                 skin: 'customnpcs:textures/entity/humanmale/camoradiosteve.png' },
    sparrow:   { name: 'Sparrow', title: 'Scavenger', poi: 'orchard', at: [7, 4, 8], team: 'scavengers', dialog: 130,
                 skin: 'anomalyzone:textures/entity/ambient/ambient_09_misc1.png', home: [-1534.5, 83, 96.5] },
    cantor:    { name: 'The Cantor', title: 'The Choir', poi: 'orchard', at: [10, 4, 7], team: 'choir', dialog: 135,
                 skin: 'customnpcs:textures/entity/humanmale/robeswhitesteve.png' },
    shatun:    { name: 'Shatun', title: 'Bandit Boss', poi: null, team: 'bandits', dialog: 230,
                 skin: 'anomalyzone:textures/entity/ambient/ambient_01_bandit_marauder1.png' }
  },
  GRANDPA_DIALOG: 100, GRANDPA_NEW_DIALOG: 109,
  // which finished quest (by anyone) opens which market tier
  TIERS: {
    nadya:     [[108, 3], [121, 2], [0, 1]],
    kostya:    [[108, 3], [131, 2], [0, 1]],
    hrytsenko: [[108, 3], [101, 2], [0, 1]],
    lev:       [[106, 2], [0, 1]]
  },
  FLAG_QUESTS: [101, 104, 106, 107, 108, 120, 121, 130, 131],
  // Mi-8 crew: template spots, the cockpit, quests that need the recorder
  CREW: { poi: 'heli', name: 'Dead Crewman', spots: [[10, 4, 8], [12, 4, 8], [6, 4, 8], [14, 4, 8], [4, 4, 9], [8, 4, 10]],
          cockpit: [10, 4, 6], quests: [102, 103], item: 'kubejs:flight_recorder', near: 140, minDist: 30, refill: 20 * 60 * 10 },
  ACOLYTES: { poi: 'orchard', name: 'Choir Acolyte', count: 6, ring: [5, 12], near: 150, minDist: 28, refill: 20 * 60 * 6 },
  CANTOR_DIALOG: 135, CANTOR_AWAY: 20 * 60 * 15,
  CASHOUT: { 148: 1000, 149: 5000 },
  VAULT_DIALOG: 400, VAULT_DIALOG_SPARED: 401, VAULT_COOLDOWN: 20 * 60 * 10
}
var zstTick = 0, zstWarned = {}, zstApi = null, zstCur = null, zstHM = null
var zstLast = { crew: -999999, acolytes: -999999 }, zstCantorGone = -1, zstApplied = {}, zstVaultSeen = {}

function zstErr(where, e) { if (!zstWarned[where]) { zstWarned[where] = true; console.error('[zone] story ' + where + ' failed: ' + e) } }
function zstCmd(srv, c) { return Number(srv.runCommandSilent(String(c))) || 0 }
function zstOW(c) { return 'execute in minecraft:overworld run ' + c }
function zstNpcApi() { if (!zstApi) zstApi = Java.loadClass('noppes.npcs.api.NpcAPI').Instance(); return zstApi }
function zstIP(p) { return zstNpcApi().getIEntity(p) }
function zstPdata(srv) { return srv.persistentData }
function zstGetJson(srv, key, def) {
  try { var raw = String(zstPdata(srv).getString(key) || ''); return raw ? JSON.parse(raw) : def } catch (e) { return def }
}
function zstPutJson(srv, key, v) { zstPdata(srv).putString(key, JSON.stringify(v)) }
function zstFlags(srv) { return zstGetJson(srv, 'zone_story_flags', {}) }
function zstManual(srv) { return zstGetJson(srv, 'zone_story_manual', {}) }

// world position of a template spot inside a built POI (null if not built yet)
function zstPoiPos(srv, poi, at) {
  var st = zstGetJson(srv, 'zone_pois', null)
  var b = st && st.built ? st.built[poi] : null
  if (!b) return null
  var sz = ZST.SIZE[poi]
  return [b.x - Math.floor(sz[0] / 2) + at[0] + 0.5, b.y + (at[1] - 4), b.z - Math.floor(sz[1] / 2) + at[2] + 0.5]
}
function zstPlayerNear(srv, pos, r) {
  var hit = false
  srv.players.forEach(function (p) {
    if (String(p.level.dimension).indexOf('overworld') < 0) return
    if (Math.hypot(p.x - pos[0], p.z - pos[2]) < r) hit = true
  })
  return hit
}
function zstMinDist(srv, pos) {
  var d = 1e9
  srv.players.forEach(function (p) {
    if (String(p.level.dimension).indexOf('overworld') >= 0) d = Math.min(d, Math.hypot(p.x - pos[0], p.z - pos[2]))
  })
  return d
}
function zstLoaded(srv, pos) { return zstCmd(srv, 'execute in minecraft:overworld if loaded ' + Math.floor(pos[0]) + ' ' + Math.floor(pos[1]) + ' ' + Math.floor(pos[2])) > 0 }
function zstCountNear(srv, sel, pos, r) {
  return zstCmd(srv, 'execute in minecraft:overworld positioned ' + pos[0] + ' ' + pos[1] + ' ' + pos[2] + ' if entity @e[' + sel + ',distance=..' + r + ']')
}
function zstGround(level, x, z) {
  if (!zstHM) zstHM = Java.loadClass('net.minecraft.world.level.levelgen.Heightmap$Types').MOTION_BLOCKING_NO_LEAVES
  return level.getHeight(zstHM, Math.floor(x), Math.floor(z))
}
function zstTier(srv, key) {
  var f = zstFlags(srv), list = ZST.TIERS[key]
  for (var i = 0; i < list.length; i++) if (list[i][0] === 0 || f[list[i][0]]) return list[i][1]
  return 1
}

// ---------------------------------------------------------------- placing NPCs
function zstSummon(srv, key, pos, yaw) {
  var n = ZST.NPCS[key], tag = 'zq_' + key
  var x = Math.floor(pos[0]), y = Math.floor(pos[1]), z = Math.floor(pos[2])
  var tags = '"zone_qnpc","zone_story","' + tag + '"' + (n.team !== 'scavengers' ? ',"zone_bandit"' : '') + (n.market ? ',"zone_cnpc_trader"' : '')
  var nbt = '{Name:"' + n.name + '",Title:"' + n.title + '",' +
    'NPCDialogOptions:[{DialogSlot:0,NPCDialog:{Title:"Talk",Dialog:' + n.dialog + ',DialogColor:14737632,OptionType:1,DialogCommand:""}}],' +
    'StartPosNew:[I;' + x + ',' + y + ',' + z + '],MovementType:0,ReturnToStart:1b,Texture:"' + n.skin + '",' +
    (n.market ? 'Role:1,TraderMarket:"' + n.market + '_' + zstTier(srv, key) + '",' : '') +
    'Invulnerable:1b,PersistenceRequired:1b,Rotation:[' + (yaw || 0) + 'f,0f],Tags:[' + tags + ']}'
  srv.runCommandSilent(zstOW('summon customnpcs:customnpc ' + (x + 0.5) + ' ' + y + ' ' + (z + 0.5) + ' ' + nbt))
  srv.runCommandSilent(zstOW('team join ' + n.team + ' @e[type=customnpcs:customnpc,tag=' + tag + ']'))
  if (n.armor) Object.keys(n.armor).forEach(function (s) {
    srv.runCommandSilent(zstOW('item replace entity @e[type=customnpcs:customnpc,tag=' + tag + ',limit=1] ' + s + ' with ' + n.armor[s]))
  })
  if (n.market) zstApplied[key] = zstTier(srv, key)
  console.info('[zone] story: placed ' + n.name + ' at ' + x + ' ' + y + ' ' + z)
}
function zstKeep(srv, key, pos) {
  var sel = 'type=customnpcs:customnpc,tag=zq_' + key
  if (!zstPlayerNear(srv, pos, 96) || !zstLoaded(srv, pos)) return
  if (zstCountNear(srv, sel, pos, 40) > 0) return
  if (zstCmd(srv, zstOW('execute if entity @e[' + sel + ']').replace('run execute ', '')) > 0) return  // standing somewhere else that's loaded
  zstSummon(srv, key, pos, 0)
}
function zstNpcs(srv) {
  var manual = zstManual(srv), flags = zstFlags(srv)
  global.zoneSparrowHome = !!flags[107]
  Object.keys(ZST.NPCS).forEach(function (key) {
    var n = ZST.NPCS[key]
    if (manual[key] || !n.poi) return
    if (key === 'cantor' && zstCantorGone > zstTick) return
    var pos = zstPoiPos(srv, n.poi, n.at)
    if (key === 'sparrow' && flags[107]) {
      // home again: none at the Orchard, one at the Bar campfire
      if (pos && zstLoaded(srv, pos)) srv.runCommandSilent('execute in minecraft:overworld positioned ' + pos.join(' ') + ' run kill @e[type=customnpcs:customnpc,tag=zq_sparrow,distance=..40]')
      pos = n.home
    }
    if (pos) zstKeep(srv, key, pos)
  })
  // the original Bar Sparrow is replaced by the story one. Removed for good (discard), because /kill on a
  // Custom NPC with respawn on only "kills" him until he revives at home, which looped every 5 seconds.
  try {
    srv.overworld().getEntities().forEach(function (e) {
      if (String(e.type) !== 'customnpcs:customnpc') return
      if (String(e.getName().getString()) !== 'Sparrow' || e.getTags().contains('zq_sparrow')) return
      e.discard()
      console.info('[zone] story: removed the original Bar Sparrow')
    })
  } catch (e) { zstErr('bar sparrow', e) }
  // Grandpa starts Act 1
  // (dialog 109 is the new-face greeting, shown until First Steps quest 13 is done; then 100 takes over)
  srv.runCommandSilent(zstOW('execute as @e[type=customnpcs:customnpc,name=Grandpa,tag=!zq_grandpa2] run data merge entity @s ' +
    '{NPCDialogOptions:[{DialogSlot:0,NPCDialog:{Title:"Talk",Dialog:' + ZST.GRANDPA_NEW_DIALOG + ',DialogColor:14737632,OptionType:1,DialogCommand:""}},' +
    '{DialogSlot:1,NPCDialog:{Title:"Talk",Dialog:' + ZST.GRANDPA_DIALOG + ',DialogColor:14737632,OptionType:1,DialogCommand:""}}],Tags:["zq_grandpa","zq_grandpa2","zone_story"]}'))
}

// ---------------------------------------------------------------- tiers
function zstUpdateFlags(srv) {
  var f = zstFlags(srv), changed = false
  srv.players.forEach(function (p) {
    var ip = zstIP(p)
    ZST.FLAG_QUESTS.forEach(function (q) {
      if (!f[q] && ip.hasFinishedQuest(q)) { f[q] = true; changed = true; console.info('[zone] story: quest ' + q + ' finished by ' + p.username) }
    })
  })
  if (changed) zstPutJson(srv, 'zone_story_flags', f)
}
function zstApplyTiers(srv) {
  Object.keys(ZST.TIERS).forEach(function (key) {
    var t = zstTier(srv, key)
    if (zstApplied[key] === t) return
    var sel = 'type=customnpcs:customnpc,tag=zq_' + key + ',limit=1'
    if (zstCmd(srv, 'execute in minecraft:overworld if entity @e[' + sel + ']') <= 0) return   // not loaded: try again later
    srv.runCommandSilent(zstOW('data merge entity @e[' + sel + '] {TraderMarket:"' + key + '_' + t + '"}'))
    zstApplied[key] = t
    console.info('[zone] story: ' + key + ' now sells tier ' + t)
  })
}

// ---------------------------------------------------------------- the Mi-8 crew and the flight recorder
function zstCrew(srv) {
  var c = ZST.CREW, center = zstPoiPos(srv, c.poi, c.cockpit)
  if (!center) return
  var d = zstMinDist(srv, center)
  if (d > c.near || d < c.minDist || zstTick - zstLast.crew < c.refill || !zstLoaded(srv, center)) return
  zstLast.crew = zstTick
  var have = zstCountNear(srv, 'type=minecraft:zombie,tag=zone_crew', center, 40)
  for (var i = have; i < c.spots.length; i++) {
    var p = zstPoiPos(srv, c.poi, c.spots[i])
    srv.runCommandSilent(zstOW('summon minecraft:zombie ' + p.join(' ') + ' {CustomName:\'{"text":"' + c.name + '"}\',PersistenceRequired:1b,' +
      'Tags:["zone_story","zone_crew"],ArmorItems:[{},{},{id:"itz:psz_chestplate_military",Count:1b},{}],ArmorDropChances:[0f,0f,0.05f,0f]}'))
  }
  if (have < c.spots.length) console.info('[zone] story: Mi-8 crew topped up (' + (c.spots.length - have) + ')')
}
function zstRecorder(srv) {
  var c = ZST.CREW, pos = zstPoiPos(srv, c.poi, c.cockpit)
  if (!pos) return
  srv.players.forEach(function (p) {
    if (Math.hypot(p.x - pos[0], p.z - pos[2]) > 8 || Math.abs(p.y - pos[1]) > 6) return
    var ip = zstIP(p), need = false
    c.quests.forEach(function (q) { if (ip.hasActiveQuest(q)) need = true })
    if (!need) return
    var has = false, inv = p.getInventory()
    ;[inv.items, inv.offhand].forEach(function (list) {
      for (var i = 0; i < list.size(); i++) if (String(list.get(i).id) === c.item) has = true
    })
    if (has) return
    p.give(Item.of(c.item))
    p.tell(Text.of('You pry the flight recorder out of the cockpit. It\'s still warm.').color(0xD8B225))
  })
}

// ---------------------------------------------------------------- the Choir at the Dead Orchard
function zstAcolytes(srv) {
  var a = ZST.ACOLYTES, center = zstPoiPos(srv, a.poi, [8, 4, 8])
  if (!center) return
  var d = zstMinDist(srv, center)
  if (d > a.near || d < a.minDist || zstTick - zstLast.acolytes < a.refill || !zstLoaded(srv, center)) return
  zstLast.acolytes = zstTick
  var have = zstCountNear(srv, 'type=tacznpcs:npc,tag=zone_acolyte', center, 48)
  if (have >= 2) return
  var level = srv.getLevel('minecraft:overworld')
  for (var i = have; i < a.count; i++) {
    var ang = (i / a.count) * Math.PI * 2 + Math.random() * 0.6
    var r = a.ring[0] + Math.random() * (a.ring[1] - a.ring[0])
    var x = Math.floor(center[0] + Math.cos(ang) * r), z = Math.floor(center[2] + Math.sin(ang) * r)
    var y = zstGround(level, x, z)
    srv.runCommandSilent(zstOW('summon tacznpcs:npc ' + (x + 0.5) + ' ' + y + ' ' + (z + 0.5) + ' {template:"choir_acolyte",CustomName:\'{"text":"' + a.name +
      '"}\',PersistenceRequired:1b,Tags:["zone_story","zone_acolyte"]}'))
  }
  console.info('[zone] story: Choir Acolytes at the Dead Orchard topped up (' + (a.count - have) + ')')
}
// After someone hears the Cantor's warning, he walks away into the trees and vanishes for a while.
function zstCantor(srv) {
  var heard = false
  srv.players.forEach(function (p) {
    var ip = zstIP(p)
    if (ip.hasReadDialog(ZST.CANTOR_DIALOG)) { ip.removeDialog(ZST.CANTOR_DIALOG); heard = true }
  })
  if (!heard || zstCantorGone > zstTick) return
  zstCantorGone = zstTick + ZST.CANTOR_AWAY
  var level = srv.getLevel('minecraft:overworld')
  level.getEntities().forEach(function (e) {
    if (String(e.type) !== 'customnpcs:customnpc' || !e.tags.contains('zq_cantor')) return
    srv.scheduleInTicks(60, function () {
      try {
        srv.runCommandSilent(zstOW('data merge entity @e[type=customnpcs:customnpc,tag=zq_cantor,limit=1] {ReturnToStart:0b}'))
        e.getNavigation().moveTo(e.x + 24, e.y, e.z + 18, 0.8)
      } catch (err) { zstErr('cantor walk', err) }
    })
    srv.scheduleInTicks(60 + 20 * 12, function () { srv.runCommandSilent(zstOW('kill @e[type=customnpcs:customnpc,tag=zq_cantor]')) })
  })
}

// ---------------------------------------------------------------- cash out at Custom NPCs traders
function zstCashOut(srv) {
  srv.players.forEach(function (p) {
    var ip = zstIP(p)
    Object.keys(ZST.CASHOUT).forEach(function (k) {
      var id = Number(k)
      if (!ip.hasReadDialog(id)) return
      ip.removeDialog(id)
      var amt = ZST.CASHOUT[k]
      if (!zstCur) zstCur = { cur: Java.loadClass('com.anomalyzone.PlayerCurrency'), net: Java.loadClass('com.anomalyzone.CurrencyNetwork') }
      if (!zstCur.cur.subtract(p, amt)) { p.tell(Text.of('Not enough rubles on your PDA.').color(0xD86A6A)); return }
      zstCur.net.sendBalance(p)
      p.give(Item.of('tarkovdayz:rubble_' + amt))
      p.statusMessage = Text.of('-' + String(amt).replace(/\B(?=(\d{3})+(?!\d))/g, ',') + ' ₽ from your PDA, in notes').color(0xD8B225)
    })
  })
}

// ---------------------------------------------------------------- the Seraph's vault (hidden boss)
function zstVault(srv) {
  var v = zstGetJson(srv, 'zone_story_vault', null)
  if (!v) return
  var spared = !!zstFlags(srv).seraph_spared
  srv.players.forEach(function (p) {
    if (Math.hypot(p.x - v.x, p.z - v.z) > v.r || Math.abs(p.y - v.y) > 16) return
    var k = p.username
    if (zstVaultSeen[k] && zstTick - zstVaultSeen[k] < ZST.VAULT_COOLDOWN) return
    zstVaultSeen[k] = zstTick
    zstIP(p).showDialog(spared ? ZST.VAULT_DIALOG_SPARED : ZST.VAULT_DIALOG, 'The Seraph')
  })
}

// ---------------------------------------------------------------- map waypoints (Xaero's Minimap)
// When a quest sends a player somewhere new, they get a chat message Xaero turns into a waypoint they can add.
// Each place is sent to each player once. Trigger: 'active' = while the quest is in progress, 'done' = once it's finished.
var ZWP = {
  PLACES: {
    bar:        { name: 'The Bar', at: [-1530, 83, 95], color: 10 },
    chalet:     { name: 'Mountainview Chalet', at: [-1488, 111, -140], color: 11 },
    military:   { name: 'Military Base', at: [-271, 66, 315], color: 2 },
    armoury:    { name: 'The Armoury', at: [259, 71, -503], color: 6 },
    oldtown:    { name: 'Old Town', at: [-1233, '~', 22], color: 12 },
    checkpoint: { name: 'Checkpoint 4', poi: 'checkpoint', at: [-1060, '~', 70], color: 2 },
    farm:       { name: 'Kovalenko Farm', poi: 'farm', at: [-760, '~', -200], color: 10 },
    pumping:    { name: 'Pumping Station', poi: 'pumping', at: [-890, '~', 260], color: 10 },
    heli:       { name: 'Mi-8 Crash Site', poi: 'heli', at: [-620, '~', 330], color: 14 },
    mast:       { name: 'Radio Mast', poi: 'mast', at: [-520, '~', -60], color: 14 },
    orchard:    { name: 'Dead Orchard', poi: 'orchard', at: [-470, '~', 560], color: 4 }
  },
  TRIGGERS: [
    [0, 'always', 'bar'],
    [1, 'active', 'oldtown'], [50, 'active', 'oldtown'],
    [22, 'active', 'military'], [23, 'active', 'chalet'], [24, 'active', 'armoury'],
    [100, 'active', 'checkpoint'], [101, 'done', 'farm'], [102, 'active', 'heli'], [103, 'done', 'pumping'],
    [104, 'active', 'mast'], [107, 'active', 'orchard'], [108, 'active', 'bar']
  ]
}
function zwpPos(srv, pl) {
  var st = pl.poi ? zstGetJson(srv, 'zone_pois', null) : null
  var b = st && st.built ? st.built[pl.poi] : null
  return b ? [b.x, b.y, b.z] : pl.at
}
function zwpSend(srv, p, key) {
  var pl = ZWP.PLACES[key], pos = zwpPos(srv, pl)
  var xz = Math.floor(pos[0]) + ', ' + Math.floor(pos[2])
  p.tell(Text.of('New location on your map: ').color(0xD8B225).append(Text.of(pl.name).color(0xFFFFFF)).append(Text.of('  (' + xz + ')').color(0x9A9A90)))
  p.tell(Text.of('xaero-waypoint:' + pl.name + ':' + pl.name.charAt(0).toUpperCase() + ':' + Math.floor(pos[0]) + ':' +
    (pos[1] === '~' ? '~' : Math.floor(pos[1])) + ':' + Math.floor(pos[2]) + ':' + pl.color + ':false:0:Internal-overworld-waypoints'))
}
function zwpCheck(srv) {
  srv.players.forEach(function (p) {
    var sent = {}
    try { sent = JSON.parse(String(p.persistentData.getString('zone_wp_sent') || '{}')) } catch (e) { sent = {} }
    var ip = null, changed = false
    ZWP.TRIGGERS.forEach(function (t) {
      if (sent[t[2]]) return
      if (!ip) ip = zstIP(p)
      var hit = t[1] === 'always' || (t[1] === 'active' ? ip.hasActiveQuest(t[0]) : ip.hasFinishedQuest(t[0]))
      if (!hit) return
      zwpSend(srv, p, t[2]); sent[t[2]] = true; changed = true
    })
    if (changed) p.persistentData.putString('zone_wp_sent', JSON.stringify(sent))
  })
}
// /kubejs custom_command zone_waypoints_reset  - resend every location you've earned (if you deleted them on the map)
ServerEvents.customCommand('zone_waypoints_reset', function (event) {
  if (!event.player) return
  event.player.persistentData.putString('zone_wp_sent', '{}')
  event.player.tell(Text.of('Your map locations will be sent again in a few seconds.').color(0x9BD86A))
})

ServerEvents.tick(function (event) {
  zstTick++
  var srv = event.server
  if (zstTick % 10 === 0) { try { zstCashOut(srv) } catch (e) { zstErr('cash out', e) } }
  if (zstTick % 40 === 0) {
    try { zstRecorder(srv) } catch (e) { zstErr('recorder', e) }
    try { zstCantor(srv) } catch (e) { zstErr('cantor', e) }
    try { zstVault(srv) } catch (e) { zstErr('vault', e) }
  }
  if (zstTick % 100 === 0) {
    try { zstNpcs(srv) } catch (e) { zstErr('npcs', e) }
    try { zstCrew(srv) } catch (e) { zstErr('crew', e) }
    try { zstAcolytes(srv) } catch (e) { zstErr('acolytes', e) }
  }
  if (zstTick % 200 === 0) {
    try { zstUpdateFlags(srv) } catch (e) { zstErr('flags', e) }
    try { zstApplyTiers(srv) } catch (e) { zstErr('tiers', e) }
    try { zwpCheck(srv) } catch (e) { zstErr('waypoints', e) }
  }
})

// ---------------------------------------------------------------- op commands
Object.keys(ZST.NPCS).forEach(function (key) {
  ServerEvents.customCommand('zone_story_' + key, function (event) {
    var p = event.player
    if (!p) return
    var srv = event.server, m = zstManual(srv)
    srv.runCommandSilent(zstOW('kill @e[type=customnpcs:customnpc,tag=zq_' + key + ']'))
    m[key] = true; zstPutJson(srv, 'zone_story_manual', m)
    zstSummon(srv, key, [p.x, p.y, p.z], Math.round(p.yaw * 10) / 10)
    p.tell(Text.of('Placed ' + ZST.NPCS[key].name + ' here. They stay put until /kubejs custom_command zone_story_auto.').color(0x9BD86A))
  })
})
ServerEvents.customCommand('zone_story_auto', function (event) {
  zstPutJson(event.server, 'zone_story_manual', {})
  if (event.player) event.player.tell(Text.of('Story NPCs are back on automatic placement (hand-placed copies stay until they are removed).').color(0x9BD86A))
})
ServerEvents.customCommand('zone_story_vault_here', function (event) {
  var p = event.player
  if (!p) return
  zstPutJson(event.server, 'zone_story_vault', { x: Math.floor(p.x), y: Math.floor(p.y), z: Math.floor(p.z), r: 24 })
  p.tell(Text.of('The Seraph will speak to anyone who comes within 24 blocks of here.').color(0x9BD86A))
})
ServerEvents.customCommand('zone_story_status', function (event) {
  var p = event.player, srv = event.server
  if (!p) return
  var m = zstManual(srv), f = zstFlags(srv)
  Object.keys(ZST.NPCS).forEach(function (key) {
    var n = ZST.NPCS[key], pos = n.poi ? zstPoiPos(srv, n.poi, n.at) : null
    p.tell(n.name + ': ' + (m[key] ? 'placed by hand' : (pos ? 'auto at ' + pos.map(Math.floor).join(' ') : (n.poi ? 'waiting for ' + n.poi + ' to be built' : 'place by hand'))) +
      (n.market ? ' | stock tier ' + zstTier(srv, key) : ''))
  })
  p.tell('Quests finished on this server: ' + (Object.keys(f).join(', ') || 'none') + ' | Sparrow ' + (f[107] ? 'is home' : 'is missing'))
})

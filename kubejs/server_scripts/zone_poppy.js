// SCAVENGER side quest: the Poppy Field (Slade). Quests 270-272, dialogs 500-512 (category "Kindergarten").
//
// Olya waits at the Kindergarten for her parents. She has been waiting since the morning of the First Chorus.
// Her parents, Andriy and Sveta Marchenko, are still in their cottage at the Poppy Field, nine years dead.
//
//  - Both places are zone_pois.js locations ('kindergarten', 'poppy'); they build when a player first comes near.
//  - Olya: a see-through Custom NPC in the classroom. Visible only to players who haven't finished quest 272
//    (Custom NPCs VisibleAvailability), so she's gone for each player once they've said goodbye.
//  - Two Military sentries at the Kindergarten gate (the Military took it from the Pacifists).
//  - Quest 270: the parents (two named zombies) wait in the cottage while someone is on 270. With both dead,
//    a player on 270 who steps inside sees dialog 510 (finishes 270, starts 271).
//  - Quest 271: at the table (jam jar) the player gets the note (book "For Olya") and sees dialog 511 (finishes 271).
//  - The stove: "school money" stash, 6 x 1,000 notes, once per player (on 271/272 or after).
//  - Quest 272 finishes on Olya's dialog 512 (reward: Olya's Drawing).
//  - Map waypoints (Xaero's): Poppy Field when 270 starts.
//
// Op commands:
//   /kubejs custom_command zone_poppy_status    where things are, what's alive
//   /kubejs custom_command zone_poppy_olya      re-place Olya now (if her room is loaded)

var ZPP = {
  KG: { poi: 'kindergarten', sx: 27, sz: 23, plan: [-700, 120] },
  PF: { poi: 'poppy', sx: 23, sz: 21, plan: [-480, 170] },
  OLYA: {
    at: [20, 4, 12], yaw: 0, name: 'Olya', dialog: 500,
    skin: 'customnpcs:textures/entity/humanfemale/robeswhiteshepanie.png', size: 3
  },
  SENTRIES: { spots: [[11, 4, 21], [15, 4, 21]], yaw: 0, near: 110, minDist: 20, refill: 20 * 60 * 20 },
  PARENTS: {
    spots: [[10, 4, 7], [11, 4, 9]],
    names: ['Andriy Marchenko', 'Sveta Marchenko'],
    colors: [3949738, 6719955],            // plant jacket (dark blue), apron (light blue)
    near: 140, minDist: 22, refill: 20 * 60 * 5
  },
  HOUSE: { x0: 8, x1: 14, z0: 6, z1: 10 },  // inside the cottage (template coords)
  TABLE: [12, 4, 7], STOVE: [8, 4, 6],
  Q: { find: 270, note: 271, olya: 272 },
  D: { found: 510, note: 511 },
  CASH: { item: 'tarkovdayz:rubble_1000', count: 6 },
  NOTE_TITLE: 'For Olya',
  NOTE_PAGES: [
    "Olya, sunshine.\n\nIf someone brings you home, don't come in. The soldiers closed the road to the school. We tried the river way and something bit Papa.",
    "Now Mama is sick too. We are staying inside so nobody else gets hurt.\n\nYour school money is in the stove.",
    "Be good. Be brave. Eat your porridge.\n\nWe love you more than the whole sky.\n\nMama and Papa"
  ]
}
var zppTick = 0, zppWarned = {}, zppApi = null
var zppLast = { sentries: -999999, parents: -999999 }, zppShown = {}

function zppErr(where, e) { if (!zppWarned[where]) { zppWarned[where] = true; console.error('[zone] poppy ' + where + ' failed: ' + e) } }
function zppCmd(srv, c) { return Number(srv.runCommandSilent(String(c))) || 0 }
function zppOW(c) { return 'execute in minecraft:overworld run ' + c }
function zppIP(p) { if (!zppApi) zppApi = Java.loadClass('noppes.npcs.api.NpcAPI').Instance(); return zppApi.getIEntity(p) }
function zppOverworld(p) { return String(p.level.dimension).indexOf('overworld') >= 0 }
function zppBuilt(srv, site) {
  try {
    var raw = String(srv.persistentData.getString('zone_pois') || '')
    var st = raw ? JSON.parse(raw) : null
    return st && st.built ? st.built[site.poi] || null : null
  } catch (e) { return null }
}
// world position of a template spot (block centre; y = the block the feet stand in). null until built.
function zppPos(srv, site, at) {
  var b = zppBuilt(srv, site)
  if (!b) return null
  return [b.x - Math.floor(site.sx / 2) + at[0] + 0.5, b.y + (at[1] - 4), b.z - Math.floor(site.sz / 2) + at[2] + 0.5]
}
function zppLoaded(srv, pos) { return zppCmd(srv, 'execute in minecraft:overworld if loaded ' + Math.floor(pos[0]) + ' ' + Math.floor(pos[1]) + ' ' + Math.floor(pos[2])) > 0 }
function zppCount(srv, sel, pos, r) {
  return zppCmd(srv, 'execute in minecraft:overworld positioned ' + pos[0] + ' ' + pos[1] + ' ' + pos[2] + ' if entity @e[' + sel + ',distance=..' + r + ']')
}
function zppMinDist(srv, pos, filter) {
  var d = 1e9
  srv.players.forEach(function (p) {
    if (!zppOverworld(p) || (filter && !filter(p))) return
    d = Math.min(d, Math.hypot(p.x - pos[0], p.z - pos[2]))
  })
  return d
}
function zppInHouse(srv, p) {
  var a = zppPos(srv, ZPP.PF, [ZPP.HOUSE.x0, 4, ZPP.HOUSE.z0]), b = zppPos(srv, ZPP.PF, [ZPP.HOUSE.x1, 4, ZPP.HOUSE.z1])
  if (!a || !zppOverworld(p)) return false
  return p.x >= a[0] - 0.5 && p.x <= b[0] + 0.5 && p.z >= a[2] - 0.5 && p.z <= b[2] + 0.5 && p.y >= a[1] - 1 && p.y <= a[1] + 4
}
function zppHasNote(p) {
  var has = false, inv = p.getInventory()
  ;[inv.items, inv.offhand].forEach(function (list) {
    for (var i = 0; i < list.size(); i++) {
      var s = list.get(i)
      if (String(s.id) !== 'minecraft:written_book' || !s.nbt) continue
      try { if (String(s.nbt.getString('title')) === ZPP.NOTE_TITLE) has = true } catch (e) {}
    }
  })
  return has
}
function zppGiveNote(p) {
  var pages = ZPP.NOTE_PAGES.map(function (t) {
    return "'" + JSON.stringify({ text: t }).replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'"
  })
  p.server.runCommandSilent('give ' + p.username + ' minecraft:written_book{title:"' + ZPP.NOTE_TITLE +
    '",author:"Mama and Papa",generation:3,pages:[' + pages.join(',') + ']} 1')
}

// ---------------------------------------------------------------- Olya
function zppOlyaNbt(pos) {
  var o = ZPP.OLYA, x = Math.floor(pos[0]), y = Math.floor(pos[1]), z = Math.floor(pos[2])
  return '{Name:"' + o.name + '",Title:"",ShowName:1,' +
    'NPCDialogOptions:[{DialogSlot:0,NPCDialog:{Title:"Talk",Dialog:' + o.dialog + ',DialogColor:14737632,OptionType:1,DialogCommand:""}}],' +
    'StartPosNew:[I;' + x + ',' + y + ',' + z + '],MovementType:0,ReturnToStart:1b,Texture:"' + o.skin + '",Size:' + o.size + 'f,' +
    'NpcVisible:2,VisibleAvailability:{AvailabilityQuest:2,AvailabilityQuestId:' + ZPP.Q.olya + '},' +
    'Invulnerable:1b,PersistenceRequired:1b,Rotation:[' + o.yaw + 'f,0f],Tags:["zone_story","zq_olya"]}'
}
function zppOlya(srv, force) {
  var pos = zppPos(srv, ZPP.KG, ZPP.OLYA.at)
  if (!pos || !zppLoaded(srv, pos)) return 'not built or not loaded'
  if (!force && zppMinDist(srv, pos) > 96) return 'nobody near'
  var sel = 'type=customnpcs:customnpc,tag=zq_olya'
  if (force) srv.runCommandSilent(zppOW('kill @e[' + sel + ']'))
  else if (zppCount(srv, sel, pos, 40) > 0) return 'there'
  srv.runCommandSilent(zppOW('summon customnpcs:customnpc ' + pos[0] + ' ' + Math.floor(pos[1]) + ' ' + pos[2] + ' ' + zppOlyaNbt(pos)))
  console.info('[zone] poppy: placed Olya at ' + pos.join(' '))
  return 'placed'
}

// ---------------------------------------------------------------- Military sentries at the Kindergarten
function zppSentries(srv) {
  var s = ZPP.SENTRIES, c = zppPos(srv, ZPP.KG, [13, 4, 11])
  if (!c) return
  var d = zppMinDist(srv, c)
  if (d > s.near || d < s.minDist || zppTick - zppLast.sentries < s.refill || !zppLoaded(srv, c)) return
  zppLast.sentries = zppTick
  var have = zppCount(srv, 'type=tacznpcs:npc,tag=zone_kg_guard', c, 40)
  for (var i = have; i < s.spots.length; i++) {
    var p = zppPos(srv, ZPP.KG, s.spots[i])
    srv.runCommandSilent(zppOW('summon tacznpcs:npc ' + p[0] + ' ' + Math.floor(p[1]) + ' ' + p[2] +
      ' {template:"military",CustomName:\'{"text":"Sentry"}\',PersistenceRequired:1b,Rotation:[' + s.yaw + 'f,0f],Tags:["zone_kg_guard","zone_mil_post"]}'))
  }
  if (have < s.spots.length) console.info('[zone] poppy: Kindergarten sentries topped up (' + (s.spots.length - have) + ')')
}

// ---------------------------------------------------------------- the parents
function zppParents(srv) {
  var c = ZPP.PARENTS, center = zppPos(srv, ZPP.PF, [11, 4, 8])
  if (!center) return
  var d = zppMinDist(srv, center, function (p) { return zppIP(p).hasActiveQuest(ZPP.Q.find) })
  if (d > c.near || d < c.minDist || zppTick - zppLast.parents < c.refill || !zppLoaded(srv, center)) return
  var have = zppCount(srv, 'type=minecraft:zombie,tag=zone_poppy_parent', center, 30)
  if (have > 0) return
  zppLast.parents = zppTick
  for (var i = 0; i < c.spots.length; i++) {
    var p = zppPos(srv, ZPP.PF, c.spots[i])
    srv.runCommandSilent(zppOW('summon minecraft:zombie ' + p[0] + ' ' + Math.floor(p[1]) + ' ' + p[2] +
      ' {CustomName:\'{"text":"' + c.names[i] + '"}\',PersistenceRequired:1b,IsBaby:0b,CanBreakDoors:0b,' +
      'Tags:["zone_story","zone_poppy_parent"],' +
      'ArmorItems:[{},{},{id:"minecraft:leather_chestplate",Count:1b,tag:{display:{color:' + c.colors[i] + '}}},{}],' +
      'ArmorDropChances:[0f,0f,0f,0f]}'))
  }
  console.info('[zone] poppy: the Marchenkos are home')
}

// ---------------------------------------------------------------- the cottage: 510 (found them), 511 (the note)
function zppCottage(srv) {
  var center = zppPos(srv, ZPP.PF, [11, 4, 8]), table = zppPos(srv, ZPP.PF, ZPP.TABLE)
  if (!center) return
  srv.players.forEach(function (p) {
    if (!zppOverworld(p) || Math.hypot(p.x - center[0], p.z - center[2]) > 16) return
    var ip = zppIP(p), key = p.username
    if (zppShown[key] && zppTick - zppShown[key] < 200) return
    if (ip.hasActiveQuest(ZPP.Q.find) && zppInHouse(srv, p) &&
        zppCount(srv, 'type=minecraft:zombie,tag=zone_poppy_parent', center, 24) === 0) {
      zppShown[key] = zppTick
      ip.showDialog(ZPP.D.found, 'Poppy Field')
      return
    }
    var nearTable = Math.hypot(p.x - table[0], p.z - table[2]) < 2.6 && Math.abs(p.y - table[1]) < 2
    if (!nearTable) return
    if (ip.hasActiveQuest(ZPP.Q.note)) {
      zppShown[key] = zppTick
      if (!zppHasNote(p)) zppGiveNote(p)
      ip.showDialog(ZPP.D.note, 'For Olya')
    } else if (ip.hasActiveQuest(ZPP.Q.olya) && !zppHasNote(p)) {
      zppShown[key] = zppTick
      zppGiveNote(p)
      p.tell(Text.of('You take the note from under the jam jar again.').color(0xD8B225))
    }
  })
}

// ---------------------------------------------------------------- the stove: school money
BlockEvents.rightClicked(function (event) {
  try {
    var p = event.player, b = event.block
    if (!p || p.level.isClientSide() || !zppOverworld(p) || String(b.id) !== 'minecraft:furnace') return
    var st = zppPos(p.server, ZPP.PF, ZPP.STOVE)
    if (!st || Math.floor(st[0]) !== b.x || Math.floor(st[1]) !== b.y || Math.floor(st[2]) !== b.z) return
    var ip = zppIP(p)
    if (!(ip.hasActiveQuest(ZPP.Q.note) || ip.hasActiveQuest(ZPP.Q.olya) || ip.hasFinishedQuest(ZPP.Q.olya))) return
    if (p.persistentData.getBoolean('zone_poppy_stash')) return
    p.persistentData.putBoolean('zone_poppy_stash', true)
    p.give(Item.of(ZPP.CASH.item, ZPP.CASH.count))
    p.tell(Text.of('Behind the stove door, rolled in a child\'s sock: six thousand rubles. School money.').color(0xD8B225))
  } catch (e) { zppErr('stove', e) }
})

// ---------------------------------------------------------------- map waypoint
function zppWaypoint(srv) {
  if (global.zoneQuestMarkers) return   // 0.77: zone_quest_markers.js shows quest markers + adds places on discovery
  srv.players.forEach(function (p) {
    var sent = {}
    try { sent = JSON.parse(String(p.persistentData.getString('zone_wp_sent') || '{}')) } catch (e) { sent = {} }
    if (sent.poppy || !zppIP(p).hasActiveQuest(ZPP.Q.find)) return
    var b = zppBuilt(srv, ZPP.PF), x = b ? b.x : ZPP.PF.plan[0], z = b ? b.z : ZPP.PF.plan[1]
    p.tell(Text.of('New location on your map: ').color(0xD8B225).append(Text.of('Poppy Field').color(0xFFFFFF)).append(Text.of('  (' + x + ', ' + z + ')').color(0x9A9A90)))
    p.tell(Text.of('xaero-waypoint:Poppy Field:P:' + x + ':~:' + z + ':12:false:0:Internal-overworld-waypoints'))
    sent.poppy = true
    p.persistentData.putString('zone_wp_sent', JSON.stringify(sent))
  })
}

// Olya's body faces the window (zone_npc_facing.js)
try { if (typeof ZFACE !== 'undefined') ZFACE[ZPP.OLYA.name] = ZPP.OLYA.yaw } catch (e) {}

ServerEvents.tick(function (event) {
  zppTick++
  var srv = event.server
  if (zppTick % 20 === 7) { try { zppCottage(srv) } catch (e) { zppErr('cottage', e) } }
  if (zppTick % 100 === 30) { try { zppOlya(srv, false) } catch (e) { zppErr('olya', e) } }
  if (zppTick % 100 === 60) { try { zppParents(srv) } catch (e) { zppErr('parents', e) } }
  if (zppTick % 100 === 90) { try { zppSentries(srv) } catch (e) { zppErr('sentries', e) } }
  if (zppTick % 200 === 120) { try { zppWaypoint(srv) } catch (e) { zppErr('waypoint', e) } }
})

ServerEvents.customCommand('zone_poppy_olya', function (event) {
  var p = event.player
  if (!p) return
  p.tell('[zone] Olya: ' + zppOlya(event.server, true))
})
ServerEvents.customCommand('zone_poppy_status', function (event) {
  var p = event.player, srv = event.server
  if (!p) return
  var kg = zppBuilt(srv, ZPP.KG), pf = zppBuilt(srv, ZPP.PF)
  p.tell('Kindergarten: ' + (kg ? 'built at ' + kg.x + ', ' + kg.z : 'not built (around ' + ZPP.KG.plan.join(', ') + ')') +
    ' | Poppy Field: ' + (pf ? 'built at ' + pf.x + ', ' + pf.z : 'not built (around ' + ZPP.PF.plan.join(', ') + ')'))
  var o = kg ? zppCount(srv, 'type=customnpcs:customnpc,tag=zq_olya', zppPos(srv, ZPP.KG, ZPP.OLYA.at), 60) : 0
  var g = kg ? zppCount(srv, 'type=tacznpcs:npc,tag=zone_kg_guard', zppPos(srv, ZPP.KG, [13, 4, 11]), 60) : 0
  var par = pf ? zppCount(srv, 'type=minecraft:zombie,tag=zone_poppy_parent', zppPos(srv, ZPP.PF, [11, 4, 8]), 40) : 0
  var ip = zppIP(p)
  p.tell('Olya loaded: ' + o + ' | sentries: ' + g + ' | parents: ' + par + ' | you: 270 ' + (ip.hasActiveQuest(270) ? 'active' : ip.hasFinishedQuest(270) ? 'done' : '-') +
    ', 271 ' + (ip.hasActiveQuest(271) ? 'active' : ip.hasFinishedQuest(271) ? 'done' : '-') + ', 272 ' + (ip.hasActiveQuest(272) ? 'active' : ip.hasFinishedQuest(272) ? 'done' : '-'))
})

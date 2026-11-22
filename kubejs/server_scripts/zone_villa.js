// The Villa trade post (Slade, 11/21). Ward built a villa at about -484, 94 (Red Forest) as a trade hub east of the Bar.
// Five traders, all Custom NPC traders whose stock comes from catalogues (zone_catalogues.js; zone_tactical_anims 0.81+):
//   Bogdan (Quartermaster: plate carriers, NATO/IZ/BRIMM sets, armour plates, NVGs), Masha (Tailor: clothes, patches),
//   Stas (Backpacks + upgrades), Vera (Food), Grisha (Supplies: the same stock as Old Moe, copied whenever Moe is loaded).
// Placing them (op): stand where the trader should stand, facing where they should look, then run
//   /kubejs custom_command zone_villa_here_<bogdan|masha|stas|vera|grisha>
// Spots are saved (server data zone_villa_spots); a missing trader comes back within 10 s while someone is near.
//   /kubejs custom_command zone_villa_status    where they are
// Also here: Forgemaster Rusak and Eliwood become catalogue traders (Custom NPCs trader role, markets <key>_1..3, empty),
// opened from "» Show me your gear." in their greetings (dialogs 85 / 72). Their rank locks are in zone_trader_tiers.js.
var ZVILLA = {
  NPCS: {
    bogdan: { name: 'Bogdan', title: 'Quartermaster', skin: 'anomalyzone:textures/entity/ambient/ambient_06_veteran_mercenary_mask.png' },
    masha:  { name: 'Masha',  title: 'Tailor',        skin: 'customnpcs:textures/entity/humanfemale/townsmanstephanie.png' },
    stas:   { name: 'Stas',   title: 'Backpacks',     skin: 'anomalyzone:textures/entity/trader/trader_barter.png' },
    vera:   { name: 'Vera',   title: 'Food',          skin: 'customnpcs:textures/entity/humanfemale/chefstephanie.png' },
    grisha: { name: 'Grisha', title: 'Supplies',      skin: 'anomalyzone:textures/entity/trader/trader_seller.png' }
  },
  NEAR: 96,
  ROLES: { zq_rusak: 'rusak_1', zq_eliwood: 'eliwood_1' }   // questgivers that also trade (catalogues)
}
var zvTick = 0, zvWarned = {}
function zvErr(k, e) { if (!zvWarned[k]) { zvWarned[k] = true; console.error('[zone] villa ' + k + ': ' + e) } }
function zvOW(c) { return 'execute in minecraft:overworld run ' + c }
function zvSpots(srv) { try { var r = srv.persistentData.getString('zone_villa_spots'); return r ? JSON.parse(String(r).replace(/NaN/g, '0')) : {} } catch (e) { return {} } }
function zvSaveSpots(srv, s) { srv.persistentData.putString('zone_villa_spots', JSON.stringify(s)) }
function zvCount(srv, sel) { return Number(srv.runCommandSilent(zvOW('execute if entity @e[' + sel + ']').replace('run execute ', ''))) || 0 }

function zvSummon(srv, key, s) {
  var n = ZVILLA.NPCS[key], tag = 'zv_' + key
  srv.runCommandSilent(zvOW('execute as @e[type=customnpcs:customnpc,tag=' + tag + '] run data merge entity @s {SpawnCycle:3}'))
  srv.runCommandSilent(zvOW('kill @e[type=customnpcs:customnpc,tag=' + tag + ']'))
  var x = Math.floor(s.x), y = Math.floor(s.y), z = Math.floor(s.z)
  var nbt = '{Name:"' + n.name + '",Title:"' + n.title + '",Texture:"' + n.skin + '",Role:1,TraderMarket:"villa_' + key + '",' +
    'StartPosNew:[I;' + x + ',' + y + ',' + z + '],MovementType:0,ReturnToStart:1b,SpawnCycle:3,Invulnerable:1b,PersistenceRequired:1b,' +
    'Rotation:[' + s.yaw + 'f,0f],Tags:["zone_villa","zone_keep","' + tag + '"]}'
  srv.runCommandSilent(zvOW('summon customnpcs:customnpc ' + (x + 0.5) + ' ' + y + ' ' + (z + 0.5) + ' ' + nbt))
  srv.runCommandSilent(zvOW('team join scavengers @e[type=customnpcs:customnpc,tag=' + tag + ']'))
  try { if (typeof ZFACE !== 'undefined') ZFACE[n.name] = s.yaw } catch (e) {}
}

function zvKeep(srv) {
  var spots = zvSpots(srv)
  Object.keys(spots).forEach(function (key) {
    var s = spots[key]
    if (!ZVILLA.NPCS[key]) return
    try { if (typeof ZFACE !== 'undefined') ZFACE[ZVILLA.NPCS[key].name] = s.yaw } catch (e) {}
    var near = false
    srv.players.forEach(function (p) { if (String(p.level.dimension) === 'minecraft:overworld' && Math.hypot(p.x - s.x, p.z - s.z) < ZVILLA.NEAR) near = true })
    if (!near) return
    if (Number(srv.runCommandSilent(zvOW('execute if loaded ' + Math.floor(s.x) + ' ' + Math.floor(s.y) + ' ' + Math.floor(s.z)).replace('run execute ', ''))) <= 0) return
    if (zvCount(srv, 'type=customnpcs:customnpc,tag=zv_' + key) > 0) return
    zvSummon(srv, key, s)
    console.info('[zone] villa: placed ' + ZVILLA.NPCS[key].name)
  })
}

// Grisha sells what Old Moe sells: copy Moe's trades (not his rep extras) whenever Moe is loaded.
function zvMoe(srv) {
  var moe = null
  try {
    srv.overworld().getEntities().forEach(function (e) {
      if (moe) return
      try { if (String(e.type) === 'customnpcs:customnpc' && String(e.name.string) === 'Old Moe') moe = e } catch (x) {}
    })
  } catch (e) { zvErr('moe find', e) }
  var list = null
  if (moe) {
    try {
      var r = moe.role, extra = {}, big = {}
      try { if (typeof ZTT !== 'undefined' && ZTT.BAR['Old Moe']) extra = ZTT.BAR['Old Moe'].extra || {} } catch (e) {}
      try { if (typeof ZBIG !== 'undefined' && ZBIG['Old Moe']) big = ZBIG['Old Moe'] } catch (e) {}
      var VAL = { 'tarkovdayz:rubble_100': 100, 'tarkovdayz:rubble_1000': 1000, 'tarkovdayz:rubble_5000': 5000 }
      list = []
      for (var i = 0; i < 18; i++) {
        if (extra[i] !== undefined) continue
        var sold = r.getSold(i) ? r.getSold(i).getMCItemStack() : null
        if (!sold || sold.isEmpty()) continue
        var price = 0, other = false
        ;[r.getCurrency1(i), r.getCurrency2(i)].forEach(function (c) {
          var m = c ? c.getMCItemStack() : null
          if (!m || m.isEmpty()) return
          var v = VAL[String(m.id)]
          if (v) price += v * m.count; else if (String(m.id) !== 'minecraft:barrier') other = true
        })
        if (big[i] && String(sold.id) === big[i][1]) price = big[i][0]
        if (other || price <= 0) continue
        var e = { id: String(sold.id), price: Math.ceil(price / 1000) * 1000, tab: 'Supplies' }
        if (sold.count > 1) e.count = sold.count
        if (sold.nbt) e.nbt = String(sold.nbt)
        list.push(e)
      }
      srv.persistentData.putString('zone_villa_moe', JSON.stringify(list))
    } catch (e) { zvErr('moe read', e); list = null }
  }
  if (!list) { try { var raw = srv.persistentData.getString('zone_villa_moe'); list = raw ? JSON.parse(raw) : null } catch (e) { list = null } }
  if (!list) return
  var key = JSON.stringify(list)
  if (key === zvMoeLast) return
  zvMoeLast = key
  try { Java.loadClass('com.slade.zonetactical.trade.ZoneTrade').catalogue('Grisha', key); console.info('[zone] villa: Grisha has Moe\'s ' + list.length + ' trades') } catch (e) {}
}
var zvMoeLast = ''

// Rusak + Eliwood: Custom NPCs trader role (zq_ tag -> starting market); their questgiver setup summons them without one.
function zvRoles(srv) {
  try {
    srv.overworld().getEntities().forEach(function (e) {
      try {
        if (String(e.type) !== 'customnpcs:customnpc') return
        var tags = e.getTags()
        Object.keys(ZVILLA.ROLES).forEach(function (t) {
          if (!tags.contains(t)) return
          if (String(e.role.getClass().getSimpleName()) === 'RoleTrader') return
          srv.runCommandSilent(zvOW('data merge entity ' + e.getStringUuid() + ' {Role:1,TraderMarket:"' + ZVILLA.ROLES[t] + '"}'))
          console.info('[zone] villa: ' + e.name.string + ' set up as a trader')
        })
      } catch (x) {}
    })
  } catch (e) { zvErr('roles', e) }
}

ServerEvents.tick(function (event) {
  zvTick++
  var srv = event.server
  if (zvTick % 200 === 37) { try { zvKeep(srv) } catch (e) { zvErr('keep', e) } }
  if (zvTick % 1200 === 77) { try { zvMoe(srv) } catch (e) { zvErr('moe', e) } }
  if (zvTick % 600 === 99) zvRoles(srv)
})

Object.keys(ZVILLA.NPCS).forEach(function (key) {
  ServerEvents.customCommand('zone_villa_here_' + key, function (event) {
    var p = event.player
    if (!p) return
    var spots = zvSpots(event.server)
    var yaw = Math.round(Number(p.yaw) / 45) * 45   // 11/21: was p.yRot (undefined in KubeJS -> NaN -> summon failed)
    if (!isFinite(yaw)) yaw = 0
    spots[key] = { x: Math.floor(p.x) + 0.5, y: Math.floor(p.y), z: Math.floor(p.z) + 0.5, yaw: yaw }
    zvSaveSpots(event.server, spots)
    zvSummon(event.server, key, spots[key])
    p.tell(Text.of(ZVILLA.NPCS[key].name + ' (' + ZVILLA.NPCS[key].title + ') placed here, facing ' + yaw + '.').color(0x9BD86A))
  })
})
ServerEvents.customCommand('zone_villa_status', function (event) {
  var p = event.player
  if (!p) return
  var spots = zvSpots(event.server)
  Object.keys(ZVILLA.NPCS).forEach(function (key) {
    var s = spots[key]
    p.tell(ZVILLA.NPCS[key].name + ': ' + (s ? Math.floor(s.x) + ' ' + s.y + ' ' + Math.floor(s.z) + ' facing ' + s.yaw : 'not placed (zone_villa_here_' + key + ')'))
  })
})

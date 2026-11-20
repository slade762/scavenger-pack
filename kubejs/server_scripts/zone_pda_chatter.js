// PDA chatter (Slade): the Zone talks on the common PDA channel, like STALKER.
//  - Ambient: every 5-9 minutes of play someone in the Zone says something (Scavengers mostly, sometimes the
//    Military, Pacifists, Bandits, the Armoury, and very rarely the Choir). Night and rain have their own lines.
//  - Emissions ("the City sings"): a first warning ~5 min out, a hard one ~3 min out (before Anomaly Zone's own
//    2-minute warning), and an all-clear when it ends (plus an artifact hint while AZ's artifact window is open).
//  - A player dies: "Signal lost" with the nearest place, and sometimes someone reacts.
//  - A player finishes a one-off quest: someone hears about it.
//  - A mutant encounter (zone_spawn_director): sometimes a sighting near that place, a bit later.
//    A City horde: an immediate warning.
//  - Shares the gap with zone_alife.js news, so the two never stack up.
// Players: /chatter off | /chatter on   (emission warnings still come through when off)
// Op:      /kubejs custom_command zone_chatter        (one ambient line now)
//          /kubejs custom_command zone_chatter_toggle (whole feature on/off, saved)
// (KubeJS shares one scope between scripts: everything here is var + zpc names on purpose.)

var ZPC = {
  GAP_MIN: [5, 9],             // minutes between ambient lines (only counted while someone is online)
  ALIFE_QUIET_SEC: 60,         // skip ambient if zone_alife posted this recently (retried shortly after)
  HUM_TICKS: 6000,             // emission in 5 min: first warning
  SOON_TICKS: 3600,            // emission in 3 min: get inside
  DEATH_REACT: 0.55,           // chance someone answers a death
  QUEST_SAY: 0.8,              // chance a finished one-off quest gets mentioned
  MUTANT_SAY: 0.5,             // chance an encounter gets reported
  COLORS: { tag: 0x8FB35A, text: 0xB8B8A8, lost: 0xD86A6A, warn: 0xE0A040 },
  FACTIONS: {
    scav:     { name: 'Scavenger',   color: 0x55FF55 },
    military: { name: 'Military',    color: 0x00AA00 },
    pacifist: { name: 'Pacifist',    color: 0x55FFFF },
    bandit:   { name: 'Bandit',      color: 0xD86A6A },
    armoury:  { name: 'The Armoury', color: 0xFFAA00 },
    choir:    { name: null,          color: 0xA987C9 }
  },
  // ambient faction weights
  WHO: { scav: 62, military: 12, pacifist: 9, bandit: 9, armoury: 6, choir: 2 },
  // nearest-place names (deaths, sightings) and the pool for {place}
  PLACES: [
    ['the Bar', -1530, 95], ['Mountainview Chalet', -1488, -140], ['Old Town', -1215, 30], ['Lake Shore', -1380, 260],
    ['Checkpoint 4', -1060, 70], ['Bone Hollow', -960, -330], ['the Pumping Station', -890, 260],
    ['Kovalenko Farm', -760, -200], ['the Mi-8 crash site', -620, 330], ['the Radio Mast', -520, -60],
    ['the Dead Orchard', -470, 560], ['the Old Quarry', -450, -700], ['the Military base', -271, 315],
    ['Gresham', 224, -71], ['the Armoury', 259, -503]
  ],
  RANDOM_PLACES: ['Old Town', 'Bone Hollow', 'the Pumping Station', 'Kovalenko Farm', 'the crash site', 'Checkpoint 4',
    'the lake road', 'Lake Shore', 'the Old Quarry', 'the Radio Mast', 'the east road', 'the railway bridge'],
  FIRST: ['Vova', 'Tolya', 'Grisha', 'Misha', 'Kolya', 'Sanya', 'Lyokha', 'Stas', 'Zhenya', 'Petro', 'Vitya', 'Borya',
    'Senya', 'Dima', 'Igor', 'Fima', 'Roma', 'Oleg', 'Yura', 'Semyon', 'Taras', 'Arkasha', 'Venya', 'Ostap'],
  NICK: ['Ryzhy', 'Kosoy', 'Tikhiy', 'Lysy', 'Boroda', 'Shustry', 'Malyi', 'Khromoy', 'Sych', 'Kot', 'Moroz', 'Shilo',
    'Gvozd', 'Ugol', 'Bobyor', 'Sukhoi', 'Grach', 'Pyatak', 'Zubr', 'Fonar'],
  RANKS: ['Pvt.', 'Pvt.', 'Cpl.', 'Sgt.'],
  SURNAMES: ['Lysenko', 'Danylenko', 'Bondar', 'Hnatyuk', 'Petrenko', 'Moroz', 'Savchuk', 'Tkachenko', 'Kravchuk'],
  BANDIT_NICKS: ['Kaban', 'Shnyr', 'Gvozdik', 'Lom', 'Sopla', 'Kosmach', 'Chuma', 'Bulka'],
  PACIFIST_NAMES: ['Mira', 'Anton', 'Lesya', 'Yevhen', 'Dana', 'Marko', 'Oksana', 'Ilko'],
  ARMOURY_NAMES: ['Shieldbrother Hlib', 'Shieldsister Vira', 'Shieldbrother Danylo', 'Shieldsister Raisa']
}

var ZPC_LINES = {
  scav: [
    'Anyone got spare bandages? I\'ll pay double at the Bar.',
    'Passed {place} an hour ago. Quiet. Too quiet, if you ask me.',
    'Moe raised his prices again. Man\'s a bandit with a roof.',
    'Found a stash near {place}. Empty. Somebody beat me to it.',
    'Detector\'s been chirping all morning and all I found is rocks.',
    'If anyone sees my brother Vitek out by {place}, tell him he owes me a can of stew.',
    'Who keeps leaving empty bottles at the Bar door? Pasha\'s going to kill someone.',
    'Heading to {place}. If I\'m not back by dark, my boots go to Fedya.',
    'Saw a dog the size of a calf near {place}. Didn\'t stay to say hello.',
    'Fedya fixed my PDA. Now it beeps louder. Thanks, Fedya.',
    'Anyone selling a scope? One with less fog on the glass than mine.',
    'Doc Ilya was stitching people up drunk again. Steady hands, though.',
    'Prices at the Farm are fair. Baba Nadya\'s tongue isn\'t.',
    'Anomalies all over the ground past {place}. Bolts first, feet second.',
    'Got an artifact. Not saying where. Not saying what. Just happy.',
    'Lost my last bolt in a whirligig. Walked home throwing pebbles.',
    'Zone\'s quiet today. I don\'t trust it.',
    'If a dead man asks you for a smoke, don\'t stop to chat.',
    'Anyone know why Checkpoint 4 has new sandbags? Expecting company?',
    'Selling a spare gas mask. Barely bloody.',
    'I swear the road past {place} gets longer every time I walk it.',
    'Half a can of stew and a full magazine. Rich man\'s dinner.',
    'If you hear singing and the sky\'s still blue, walk the other way.',
    '{name} still owes me two thousand. {name}, I can see you on the PDA.',
    'Shot a zombie near {place}. Had a better rifle than me. Has one less now.',
    'Pumping Station water tastes like pennies. Still better than the lake.',
    'My counter went crazy near {place}. Turned around. Not worth it.',
    'Anyone heading east? I\'ll walk with you as far as the Farm.',
    'Bandits stopped me on the lake road. Took my vodka. Left my gun. Strange people.',
    'Yarik\'s giving speeches again. Something about us being a real faction.',
    'Found a wallet full of old coupons. Moe gave me a look like I\'d brought him a dead rat.',
    'There\'s a dead stalker in the ditch by {place}. Not getting up, at least. Good.'
  ],
  scav_night: [
    'Night\'s falling. Lights off, ears open.',
    'Something\'s walking along the Bar fence. Two legs. Slow.',
    'Can\'t sleep. Every time I close my eyes I hear the City humming.',
    'Anyone still out? Stay off the roads after dark. The dead like roads.',
    'Fire\'s going at the Bar. Moe says the stew is mostly meat tonight.',
    'Dark as a boot out here. If you see a light near {place}, that\'s me. Don\'t shoot.',
    'Heard a howl from {place}. Not a dog. Not a wolf either.'
  ],
  scav_rain: [
    'Rain\'s coming down sideways near {place}. Counters tick higher in the wet, careful.',
    'Rain again. Good for hiding tracks, bad for my knees.',
    'Soaked through. If anyone\'s got a dry pair of socks, name your price.'
  ],
  military: [
    'Checkpoint reminder: the cordon is closed. We won\'t say it twice.',
    'Patrol to base. Nothing moving on the east road. Requesting hot food, over.',
    'Base, Checkpoint 4. Still no orders. Still here.',
    'Whoever is selling our ammo at the Bar: we know the serial numbers.',
    'Base to all patrols: shoot anything that sings.',
    'Radio check. If you\'re a civilian and you can hear this, you didn\'t.',
    'Patrol two, report. Patrol two? ...Somebody go look for patrol two.'
  ],
  pacifist: [
    'The Zone gives to those who take only what they need.',
    'Bandits moving out of Old Town. We\'ll handle it. Stay off the lake road.',
    'Military trucks on the road again. Leave the inner Zone alone.',
    'Eliwood says the forest is breathing louder this week. She\'s usually right.',
    'Every artifact you sell is a piece of the Zone carried away. Think about it.',
    'Chalet has hot tea for anyone who comes in peace. And bullets for the rest.'
  ],
  bandit: [
    'Road tax is going up. Pay nice, walk nice.',
    'Hey, scavs. We see you. Nice boots.',
    'Whoever robbed our camp: we\'re coming for our vodka.',
    'Old Town\'s open for business. Bring rubles or bring friends.',
    'Shatun says hi. Shatun also says pay up.',
    'Lost a good man on the lake road today. Some scav is going to pay for that.'
  ],
  armoury: [
    'Rusak pays well for chimera hide. Bring it whole.',
    'Shieldbrothers, the forge is lit. Bring artifacts, leave with steel.',
    'Reminder: we don\'t repair junk. Bring something worth fixing.',
    'A good helmet is cheaper than a funeral. Visit the Armoury.'
  ],
  choir: [
    'Join the song. It is warm in the song.',
    'Gresham is calling your names. Can you hear it?',
    'Do not be afraid. The City only sings for you.',
    'We counted you today. We count everyone.'
  ],
  hum: [
    ['scav', 'Anyone else hearing that? The City\'s humming again.'],
    ['scav', 'Birds just went quiet near {place}. City\'s getting ready to sing.'],
    ['scav', 'Teeth are aching. That means the City\'s about to sing. Start walking home.']
  ],
  soon: [
    ['scav', 'City\'s going to sing. Get under a roof, now!'],
    ['scav', 'Sky\'s turning red over Gresham. Get inside, all of you!'],
    ['military', 'All patrols, take cover. The City is singing, I repeat, take cover.']
  ],
  over: [
    ['scav', 'City\'s done singing. Count your friends.'],
    ['scav', 'That\'s it, it\'s over. Everyone still breathing?'],
    ['military', 'Emission over. All patrols, report in.']
  ],
  artifacts: [
    ['scav', 'Fresh artifacts out there after a song like that. Whoever moves first eats first.'],
    ['scav', 'Detectors out, people. The anomalies will be full of goodies now.']
  ],
  death: [
    'Rest easy, {player}.',
    'Somebody go put {player} down before they get up.',
    'Damn. {player} was alright.',
    '{player}\'s stash is fair game now, right? Joking. Mostly.',
    'Another one. Watch yourselves near {place}.',
    'Moe\'s going to want {player}\'s tab paid.'
  ],
  death_zombie: ['The dead got {player}. Don\'t let them crowd you, people.', 'Zombies took {player} near {place}. Shoot for the head.'],
  death_mutant: ['{mutant} got {player} near {place}. Stay clear of there.', 'Heard {player} met a {mutant} near {place}. Didn\'t go well.'],
  death_anomaly: ['Anomaly took {player}. Throw your bolts, people.', 'The Zone ate {player}. Bolts. Always bolts.'],
  death_fall: ['{player} fell. The Zone doesn\'t even need to try.'],
  death_player: ['{killer} shot {player}. Friendly fire is still fire.', 'Saw that, {killer}. {player} won\'t forget it.'],
  death_radiation: ['{player} soaked up too much. Carry anti-rads, it\'s not a suggestion.'],
  quest: [
    'Heard {player} finished "{title}". Good work.',
    '{player} sorted out "{title}". Drinks are on them at the Bar.',
    'Word is {player} got "{title}" done. Not bad for a rookie.'
  ],
  mutant: {
    'itz:bloodsucker': ['Bloodsucker tracks near {place}. If the air shimmers, shoot it.', 'Something drank a boar dry near {place}. Bloodsucker, I\'d bet.'],
    'itz:snork': ['Snorks out by {place}. Listen for the gas masks.', 'Snorks jumping around near {place}. Don\'t let them get close.'],
    'itz:psydog': ['Psy-dogs near {place}. Don\'t believe half of what you see.', 'Pack of psy-dogs at {place}. Shoot the real one.'],
    'itz:boar': ['Boars rooting around {place}. Mean ones.', 'Boar charged me near {place}. Bring something bigger than a pistol.'],
    'itz:armored_elk': ['Big elk near {place}. Bullets just bounce off that thing.'],
    'itz:chimera': ['Chimera in the City. I\'m not joking. Don\'t go in alone.'],
    other: ['Something big moving near {place}. Didn\'t get a good look.']
  },
  horde: ['Big crowd of dead moving in the City. Whoever\'s in there, run.', 'Horde in Gresham! Get off the streets!']
}

var zpcTick = 0, zpcNext = -1, zpcWarned = {}, zpcQueue = [], zpcRecent = [], zpcEH = null, zpcEm = null
var zpcQuests = {}, zpcPD = null, zpcQC = null, zpcInt = null, zpcWrapped = false, zpcAABB = null

function zpcErr(k, e) { if (!zpcWarned[k]) { zpcWarned[k] = true; console.error('[zone] pda chatter ' + k + ': ' + e) } }
function zpcRand(a, b) { return a + Math.random() * (b - a) }
function zpcPick(a) { return a[Math.floor(Math.random() * a.length)] }
function zpcOn(srv) { return !srv.persistentData.getBoolean('zone_pda_chatter_off') }
function zpcMuted(p) { try { return p.persistentData.getBoolean('zone_pda_mute') } catch (e) { return false } }
function zpcNearest(x, z) {
  var best = null, bd = 1e18
  ZPC.PLACES.forEach(function (pl) { var d = (pl[1] - x) * (pl[1] - x) + (pl[2] - z) * (pl[2] - z); if (d < bd) { bd = d; best = pl[0] } })
  return best
}
function zpcSender(fac) {
  if (fac === 'military') return zpcPick(ZPC.RANKS) + ' ' + zpcPick(ZPC.SURNAMES)
  if (fac === 'bandit') return zpcPick(ZPC.BANDIT_NICKS)
  if (fac === 'pacifist') return zpcPick(ZPC.PACIFIST_NAMES)
  if (fac === 'armoury') return zpcPick(ZPC.ARMOURY_NAMES)
  if (fac === 'choir') return '???'
  return zpcPick(ZPC.FIRST) + ' ' + zpcPick(ZPC.NICK)
}
function zpcFill(s, v) {
  v = v || {}
  return String(s).replace(/\{(\w+)\}/g, function (m, k) {
    if (v[k] != null) return v[k]
    if (k === 'place') return zpcPick(ZPC.RANDOM_PLACES)
    if (k === 'name') { v.name = zpcPick(ZPC.FIRST) + ' ' + zpcPick(ZPC.NICK); return v.name }
    return m
  })
}
// one line to everyone (unless muted; force = emission warnings, which always go through)
function zpcSend(srv, fac, text, opt) {
  opt = opt || {}
  var F = ZPC.FACTIONS[fac] || ZPC.FACTIONS.scav
  var who = opt.sender || zpcSender(fac)
  var msg = Text.of('[PDA] ').color(ZPC.COLORS.tag)
    .append(Text.of(who).color(F.color))
    .append(Text.of(F.name ? ' (' + F.name + '): ' : ': ').color(0x8A8A80))
    .append(Text.of(text).color(opt.color || ZPC.COLORS.text))
  zpcBroadcast(srv, msg, opt.force)
}
function zpcBroadcast(srv, msg, force) {
  srv.players.forEach(function (p) {
    if (!force && zpcMuted(p)) return
    p.tell(msg)
    try { srv.runCommandSilent('execute as ' + String(p.profile.name) + ' at @s run playsound minecraft:block.note_block.bit master @s ~ ~ ~ 0.35 1.6') } catch (e) {}
  })
  // zone_alife.js news waits its usual gap after us, so the two don't stack
  try { if (typeof zalTick !== 'undefined') zalLastNews = zalTick } catch (e) {}
}
function zpcLater(ticks, fn) { zpcQueue.push({ at: zpcTick + Math.floor(ticks), fn: fn }) }
function zpcAlifeBusy() {
  try { return typeof zalTick !== 'undefined' && typeof zalLastNews !== 'undefined' && zalTick - zalLastNews < ZPC.ALIFE_QUIET_SEC * 20 } catch (e) { return false }
}
function zpcGap() { return Math.floor(zpcRand(ZPC.GAP_MIN[0], ZPC.GAP_MIN[1]) * 1200) }

// ---------- ambient ----------
function zpcAmbient(srv) {
  var total = 0, fac = 'scav'
  Object.keys(ZPC.WHO).forEach(function (k) { total += ZPC.WHO[k] })
  var r = Math.random() * total
  Object.keys(ZPC.WHO).some(function (k) { r -= ZPC.WHO[k]; if (r <= 0) { fac = k; return true } return false })
  var pool = ZPC_LINES[fac], night = false, rain = false
  try {
    var lvl = srv.overworld()
    var t = Number(lvl.dayTime) % 24000
    night = t > 13000 && t < 23000
    rain = lvl.isRaining()
  } catch (e) {}
  if (fac === 'choir' && !night && Math.random() < 0.6) fac = 'scav', pool = ZPC_LINES.scav   // the Choir mostly talks at night
  if (fac === 'scav') {
    if (night && Math.random() < 0.45) pool = ZPC_LINES.scav_night
    else if (rain && Math.random() < 0.35) pool = ZPC_LINES.scav_rain
  }
  var line = null
  for (var i = 0; i < 8; i++) { line = zpcPick(pool); if (zpcRecent.indexOf(line) < 0) break }
  zpcRecent.push(line); if (zpcRecent.length > 24) zpcRecent.shift()
  zpcSend(srv, fac, zpcFill(line), fac === 'choir' ? { color: 0xC9B8D9 } : null)
}

// ---------- emissions ----------
function zpcEmission(srv) {
  if (!zpcEH) zpcEH = Java.loadClass('com.anomalyzone.EmissionHandler')
  var left = Number(zpcEH.getTicksUntilNext()), active = !!zpcEH.isEmissionActive()
  if (!zpcEm) zpcEm = { hum: left <= ZPC.HUM_TICKS, soon: left <= ZPC.SOON_TICKS, active: active }   // don't announce what we joined halfway
  if (left > ZPC.HUM_TICKS + 600) { zpcEm.hum = false; zpcEm.soon = false }
  if (!active && !zpcEm.hum && left <= ZPC.HUM_TICKS && left > ZPC.SOON_TICKS) {
    zpcEm.hum = true; var h = zpcPick(ZPC_LINES.hum); zpcSend(srv, h[0], zpcFill(h[1]), { force: true, color: ZPC.COLORS.warn })
  }
  if (!active && !zpcEm.soon && left <= ZPC.SOON_TICKS && left > 300) {
    zpcEm.soon = true; zpcEm.hum = true; var s = zpcPick(ZPC_LINES.soon); zpcSend(srv, s[0], zpcFill(s[1]), { force: true, color: ZPC.COLORS.warn })
  }
  if (zpcEm.active && !active) {
    var o = zpcPick(ZPC_LINES.over)
    zpcLater(zpcRand(100, 260), function (sv) {
      zpcSend(sv, o[0], zpcFill(o[1]))
      var art = false
      try { art = !!zpcEH.isArtifactDropActive() } catch (e) {}
      if (art || Math.random() < 0.5) { var a = zpcPick(ZPC_LINES.artifacts); zpcLater(zpcRand(300, 700), function (s2) { zpcSend(s2, a[0], zpcFill(a[1])) }) }
    })
    zpcNext = Math.max(zpcNext, zpcTick + 2400)   // no small talk right on top of it
  }
  if (active) zpcNext = Math.max(zpcNext, zpcTick + 1200)
  zpcEm.active = active
}

// ---------- quests ----------
function zpcQuestCheck(srv) {
  if (!zpcPD) zpcPD = Java.loadClass('noppes.npcs.controllers.data.PlayerData')
  if (!zpcQC) zpcQC = Java.loadClass('noppes.npcs.controllers.QuestController')
  if (!zpcInt) zpcInt = Java.loadClass('java.lang.Integer')
  srv.players.forEach(function (p) {
    try {
      var uuid = String(p.uuid), fin = zpcPD.get(p).questData.finishedQuests, now = {}
      fin.keySet().forEach(function (k) { var id = String(Math.round(Number(k))); now[id] = String(fin.get(zpcInt.valueOf(id))) })
      var old = zpcQuests[uuid]
      zpcQuests[uuid] = now
      if (!old) return   // first look (login / reload): just remember
      Object.keys(now).forEach(function (id) {
        if (old[id] === now[id]) return
        var q = zpcQC.instance.quests.get(zpcInt.valueOf(id))
        if (!q || String(q.repeat) !== 'NONE' || Math.random() > ZPC.QUEST_SAY) return
        var name = String(p.profile.name), title = String(q.title)
        zpcLater(zpcRand(200, 900), function (sv) { zpcSend(sv, 'scav', zpcFill(zpcPick(ZPC_LINES.quest), { player: name, title: title })) })
      })
    } catch (e) { zpcErr('quest', e) }
  })
}

// ---------- mutant encounters / hordes (wrap zone_spawn_director's functions once they exist) ----------
function zpcMutantName(id) {
  var n = { 'itz:bloodsucker': 'bloodsucker', 'itz:snork': 'snork', 'itz:psydog': 'psy-dog', 'itz:boar': 'boar',
    'itz:armored_elk': 'armored elk', 'itz:chimera': 'chimera' }[id]
  return n || 'mutant'
}
function zpcWrap() {
  zpcWrapped = true
  try {
    if (typeof encounter === 'function') {
      var origEnc = encounter
      encounter = function (p) {
        var ok = origEnc(p)
        try { if (ok && Math.random() < ZPC.MUTANT_SAY) zpcOnEncounter(p) } catch (e) { zpcErr('encounter', e) }
        return ok
      }
    }
    if (typeof horde === 'function') {
      var origHorde = horde
      horde = function (p) {
        var ok = origHorde(p)
        try { if (ok) zpcSend(p.server, 'scav', zpcPick(ZPC_LINES.horde), { color: ZPC.COLORS.warn }) } catch (e) { zpcErr('horde', e) }
        return ok
      }
    }
  } catch (e) { zpcErr('wrap', e) }
}
function zpcOnEncounter(p) {
  var x = Number(p.x), y = Number(p.y), z = Number(p.z), place = zpcNearest(x, z), lvl = p.level, type = 'other'
  try {
    if (!zpcAABB) zpcAABB = Java.loadClass('net.minecraft.world.phys.AABB')
    lvl.getEntitiesWithin(new zpcAABB(x - 60, y - 30, z - 60, x + 60, y + 30, z + 60)).forEach(function (e) {
      if (type === 'other' && e.tags && e.tags.contains('zone_encounter')) type = String(e.type)
    })
  } catch (e) { zpcErr('scan', e) }
  var pool = ZPC_LINES.mutant[type] || ZPC_LINES.mutant.other
  var line = zpcFill(zpcPick(pool), { place: place })
  zpcLater(zpcRand(800, 2400), function (sv) { zpcSend(sv, 'scav', line) })
}

// ---------- deaths ----------
EntityEvents.death(function (event) {
  try {
    var p = event.entity
    if (!p || !p.isPlayer()) return
    var srv = p.server
    if (!zpcOn(srv)) return
    var name = String(p.profile.name), place = zpcNearest(Number(p.x), Number(p.z))
    zpcBroadcast(srv, Text.of('[PDA] ').color(ZPC.COLORS.tag).append(Text.of('Signal lost: ' + name + '. Last position: near ' + place + '.').color(ZPC.COLORS.lost)), false)
    if (Math.random() > ZPC.DEATH_REACT) return
    var src = event.source, id = '', att = null, attType = ''
    try { id = String(src.getMsgId()) } catch (e) {}
    try { att = src.getEntity(); if (att) attType = String(att.type) } catch (e) {}
    var pool = ZPC_LINES.death, v = { player: name, place: place }
    if (att && att.isPlayer && att.isPlayer() && String(att.profile.name) !== name) { pool = ZPC_LINES.death_player; v.killer = String(att.profile.name) }
    else if (/zombie/.test(attType)) pool = ZPC_LINES.death_zombie
    else if (/^itz:/.test(attType)) { pool = ZPC_LINES.death_mutant; v.mutant = zpcMutantName(attType); v.mutant = v.mutant.charAt(0).toUpperCase() + v.mutant.slice(1) }
    else if (/^anomalyzone:/.test(attType) || /anomal|inFire|onFire|lava|lightningBolt|hotFloor/.test(id)) pool = ZPC_LINES.death_anomaly
    else if (/fall/.test(id)) pool = ZPC_LINES.death_fall
    else if (/radiation|rad/.test(id)) pool = ZPC_LINES.death_radiation
    var line = zpcFill(zpcPick(pool), v)
    zpcLater(zpcRand(160, 400), function (sv) { zpcSend(sv, 'scav', line) })
  } catch (e) { zpcErr('death', e) }
})

// ---------- tick ----------
ServerEvents.tick(function (event) {
  zpcTick++
  var srv = event.server
  if (zpcQueue.length) {
    var due = zpcQueue.filter(function (q) { return q.at <= zpcTick })
    if (due.length) {
      zpcQueue = zpcQueue.filter(function (q) { return q.at > zpcTick })
      due.forEach(function (q) { try { if (zpcOn(srv) && srv.players.size() > 0) q.fn(srv) } catch (e) { zpcErr('queued', e) } })
    }
  }
  if (zpcTick % 20 !== 0) return
  if (!zpcWrapped) zpcWrap()
  if (!zpcOn(srv)) return
  try { zpcEmission(srv) } catch (e) { zpcErr('emission', e) }
  if (zpcTick % 200 === 0) { try { zpcQuestCheck(srv) } catch (e) { zpcErr('quests', e) } }
  if (srv.players.size() === 0) { if (zpcNext >= 0) zpcNext += 20; return }   // the clock only runs while someone's on
  if (zpcNext < 0) zpcNext = zpcTick + zpcGap()
  if (zpcTick < zpcNext) return
  if (zpcAlifeBusy()) { zpcNext = zpcTick + 600; return }
  zpcNext = zpcTick + zpcGap()
  try { zpcAmbient(srv) } catch (e) { zpcErr('ambient', e) }
})

PlayerEvents.loggedOut(function (event) { try { delete zpcQuests[String(event.player.uuid)] } catch (e) {} })

// ---------- commands ----------
ServerEvents.commandRegistry(function (event) {
  var C = event.commands
  function set(ctx, mute) {
    var p = ctx.source.player
    if (!p) return 0
    p.persistentData.putBoolean('zone_pda_mute', mute)
    p.tell(Text.of(mute ? 'PDA chatter off. Emission warnings still come through. /chatter on to hear the Zone again.'
      : 'PDA chatter on.').color(ZPC.COLORS.tag))
    return 1
  }
  event.register(C.literal('chatter')
    .then(C.literal('off').executes(function (ctx) { return set(ctx, true) }))
    .then(C.literal('on').executes(function (ctx) { return set(ctx, false) })))
})
ServerEvents.customCommand('zone_chatter', function (event) {
  try { zpcAmbient(event.server); zpcNext = zpcTick + zpcGap() } catch (e) { zpcErr('cmd', e) }
})
ServerEvents.customCommand('zone_chatter_toggle', function (event) {
  var srv = event.server, off = !srv.persistentData.getBoolean('zone_pda_chatter_off')
  srv.persistentData.putBoolean('zone_pda_chatter_off', off)
  if (event.player) event.player.tell('PDA chatter ' + (off ? 'off' : 'on') + ' for the whole server.')
})

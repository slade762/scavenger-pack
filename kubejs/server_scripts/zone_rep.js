// Reputation from our quests (Slade).
// Finishing a Custom NPCs quest earns reputation with the faction whose quest it was (by quest category).
// Repeatable jobs pay a little every time; one-off quests pay more; the main story pays most.
// Players who already finished quests before this existed get that rep the first time they're seen.
// Saved per player on the server (survives death). Players type /rep to see their standing.
// Other scripts can read it with global.zoneRep(player, 'scavengers') (for trader stock, prices, etc. later).
var ZREP = {
  FACTIONS: {
    scavengers: { name: 'Scavengers', color: 0x55FF55 },
    military:   { name: 'Military',   color: 0x00AA00 },
    pacifists:  { name: 'Pacifists',  color: 0x55FFFF },
    armoury:    { name: 'The Armoury', color: 0xFFAA00 }
  },
  // quest category -> faction
  CATEGORY: { 'Act 1': 'scavengers', 'Bar': 'scavengers', 'Scavengers': 'scavengers', 'Kovalenko Farm': 'scavengers',
              'Pumping Station': 'scavengers', 'Military': 'military', 'Pacifists': 'pacifists', 'Armoury': 'armoury' },
  // single quests that (also) count for someone else: quest id -> [faction, points]
  EXTRA: { 22: ['military', 10], 23: ['pacifists', 10], 24: ['armoury', 10] },
  POINTS: { story: 25, once: 15, repeat: 5 },
  STORY: ['Act 1'],
  RANKS: [[-100, 'Hostile'], [0, 'Stranger'], [50, 'Known'], [150, 'Trusted'], [350, 'Friend'], [700, 'Brother']]
}
var zrepTick = 0, zrepWarned = {}, zrepPD = null, zrepQC = null
function zrepErr(k, e) { if (!zrepWarned[k]) { zrepWarned[k] = true; console.error('[zone] rep ' + k + ': ' + e) } }
function zrepLoad(srv, uuid) {
  var raw = srv.persistentData.getString('zone_rep_' + uuid)
  try { return raw ? JSON.parse(raw) : null } catch (e) { return null }
}
function zrepSave(srv, uuid, d) { srv.persistentData.putString('zone_rep_' + uuid, JSON.stringify(d)) }
function zrepRank(v) {
  var r = ZREP.RANKS[0][1]
  ZREP.RANKS.forEach(function (x) { if (v >= x[0]) r = x[1] })
  return r
}
global.zoneRep = function (p, faction) {
  var d = zrepLoad(p.server, String(p.uuid))
  return d && d.rep[faction] ? d.rep[faction] : 0
}
// what one finish of this quest is worth: list of [faction, points]
function zrepAward(q) {
  var out = []
  try {
    var cat = q.category ? String(q.category.title) : ''
    var fac = ZREP.CATEGORY[cat]
    if (fac) {
      var repeat = String(q.repeat) !== 'NONE'
      var pts = repeat ? ZREP.POINTS.repeat : (ZREP.STORY.indexOf(cat) >= 0 ? ZREP.POINTS.story : ZREP.POINTS.once)
      out.push([fac, pts])
    }
    var ex = ZREP.EXTRA[Number(q.id)]
    if (ex) out.push(ex)
  } catch (e) { zrepErr('award', e) }
  return out
}

ServerEvents.tick(function (event) {
  if (++zrepTick % 40 !== 0) return   // every 2 s
  var srv = event.server
  try {
    if (!zrepPD) zrepPD = Java.loadClass('noppes.npcs.controllers.data.PlayerData')
    if (!zrepQC) zrepQC = Java.loadClass('noppes.npcs.controllers.QuestController')
  } catch (e) { zrepErr('load', e); return }
  srv.players.forEach(function (p) {
    try {
      var uuid = String(p.uuid)
      var d = zrepLoad(srv, uuid), first = false
      if (!d) { d = { rep: {}, seen: {} }; first = true }
      var fin = zrepPD.get(p).questData.finishedQuests, gained = {}, any = false
      fin.keySet().forEach(function (k) {
        var id = String(k), when = String(fin.get(k))
        if (d.seen[id] === when) return
        d.seen[id] = when
        var q = zrepQC.instance.quests.get(k)
        if (!q) return
        zrepAward(q).forEach(function (a) {
          d.rep[a[0]] = (d.rep[a[0]] || 0) + a[1]
          gained[a[0]] = (gained[a[0]] || 0) + a[1]
          any = true
        })
      })
      if (!any && !first) return
      zrepSave(srv, uuid, d)
      if (!any) return
      Object.keys(gained).forEach(function (f) {
        var F = ZREP.FACTIONS[f]
        p.tell(Text.of((first ? 'Reputation for past work: +' : 'Reputation: +') + gained[f] + ' ' + F.name).color(F.color)
          .append(Text.of('  (' + d.rep[f] + ', ' + zrepRank(d.rep[f]) + ')').color(0xAAAAAA)))
      })
    } catch (err) { zrepErr('tick', err) }
  })
})

ServerEvents.commandRegistry(function (event) {
  var C = event.commands
  event.register(C.literal('rep').executes(function (ctx) {
    var p = ctx.source.player
    if (!p) return 0
    var d = zrepLoad(p.server, String(p.uuid)) || { rep: {} }
    p.tell(Text.gold('Your standing in the Zone:'))
    Object.keys(ZREP.FACTIONS).forEach(function (f) {
      var v = d.rep[f] || 0, F = ZREP.FACTIONS[f]
      p.tell(Text.of('  ' + F.name + ': ').color(F.color).append(Text.of(v + '  ' + zrepRank(v)).color(0xD9D9D0)))
    })
    return 1
  }))
})

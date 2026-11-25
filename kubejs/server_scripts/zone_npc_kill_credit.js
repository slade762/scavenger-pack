// zone_npc_kill_credit.js (Ward 11/25): CustomNPCs kill quests count kills by the entity's NAME ("Bandit").
// zone_npc_names.js gives world NPCs real names ("Kolyan Rat"), so those kills stopped counting.
// When a player kills a renamed NPC (tag zn_bandit / zn_scav / zn_mil / zn_pac), credit any active kill objective
// for its old generic name. Checked one tick later and only added if CustomNPCs didn't already count it (no double count).
var ZKC = {
  TARGET: { zn_bandit: 'Bandit', zn_scav: 'Scavenger', zn_mil: 'Soldier', zn_pac: 'Pacifist' }
}
var zkcApi = null, zkcWarned = false

function zkcObjectives(p, target) {
  if (!zkcApi) zkcApi = Java.loadClass('noppes.npcs.api.NpcAPI').Instance()
  var ip = zkcApi.getIEntity(p), out = []
  var quests = ip.getActiveQuests()
  for (var i = 0; i < quests.length; i++) {
    var q = quests[i]
    if (q.getType() !== 2) continue
    var objs = q.getObjectives(ip)
    for (var j = 0; j < objs.length; j++) {
      var o = objs[j], txt = String(o.getText() || '')
      if (txt.indexOf(target + ':') === 0) out.push(o)   // "Bandit: 2/6" (not "Bandit Leader: ...")
    }
  }
  return out
}

EntityEvents.death('tacznpcs:npc', function (event) {
  try {
    var e = event.entity, p = event.source ? event.source.player : null
    if (!p) return
    var target = null
    Object.keys(ZKC.TARGET).forEach(function (t) { if (!target && e.tags.contains(t)) target = ZKC.TARGET[t] })
    if (!target || String(e.name.string) === target) return
    var before = zkcObjectives(p, target).map(function (o) { return o.getProgress() })
    if (before.length === 0) return
    event.server.scheduleInTicks(1, function () {
      try {
        var objs = zkcObjectives(p, target)
        for (var k = 0; k < objs.length; k++) {
          var o = objs[k], was = k < before.length ? before[k] : o.getProgress()
          if (o.getProgress() === was && o.getProgress() < o.getMaxProgress()) o.setProgress(o.getProgress() + 1)
        }
      } catch (x) { if (!zkcWarned) { zkcWarned = true; console.warn('[zone] npc kill credit: ' + x) } }
    })
  } catch (x) { if (!zkcWarned) { zkcWarned = true; console.warn('[zone] npc kill credit: ' + x) } }
})

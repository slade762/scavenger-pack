// zone_squad_aggro.js (Ward 11/25 note 2: "neutral NPC squadmates don't aggro if you shoot a member of their squad").
// tacznpcs' own AlertAlliesGoal only reacts to an ally that is still alive and was hurt in the last few seconds, so a
// one-shot kill or headshot never alerts anyone. Here: when a player (not creative/spectator) hurts or kills a TaCZ NPC,
// its squadmates within RADIUS (same faction tag zn_scav/zn_bandit/zn_mil/zn_pac, or the same tacznpcs template)
// target that player, and remember who hit them so the mod's own alert spreads it further. Story NPCs (zone_story) are left out.
var ZSA = { RADIUS: 32, TAGS: ['zn_scav', 'zn_bandit', 'zn_mil', 'zn_pac'] }
var zsaWarned = false
function zsaFaction(e) { for (var i = 0; i < ZSA.TAGS.length; i++) if (e.tags.contains(ZSA.TAGS[i])) return ZSA.TAGS[i]; return null }
function zsaTpl(e) { try { var t = e.getTemplate(); return t ? String(t.name || t.id || t) : null } catch (x) { return null } }
function zsaAlert(victim, p) {
  if (!p || !p.isPlayer() || p.isCreative() || p.isSpectator()) return
  if (victim.tags.contains('zone_story')) return
  var fac = zsaFaction(victim), tpl = zsaTpl(victim), r = ZSA.RADIUS
  if (!fac && !tpl) return
  victim.level.getEntitiesWithin(AABB.of(victim.x - r, victim.y - 12, victim.z - r, victim.x + r, victim.y + 12, victim.z + r)).forEach(function (o) {
    try {
      if (o === victim || String(o.type) !== 'tacznpcs:npc' || !o.isAlive() || o.tags.contains('zone_story')) return
      var same = fac ? zsaFaction(o) === fac : (tpl && zsaTpl(o) === tpl)
      if (!same) return
      o.setLastHurtByMob(p)
      if (!o.getTarget()) o.setTarget(p)
    } catch (x) {}
  })
}
EntityEvents.hurt('tacznpcs:npc', function (event) {
  try { zsaAlert(event.entity, event.source ? event.source.player : null) } catch (x) { if (!zsaWarned) { zsaWarned = true; console.warn('[zone] squad aggro: ' + x) } }
})
EntityEvents.death('tacznpcs:npc', function (event) {
  try { zsaAlert(event.entity, event.source ? event.source.player : null) } catch (x) { if (!zsaWarned) { zsaWarned = true; console.warn('[zone] squad aggro: ' + x) } }
})

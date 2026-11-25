// zone_scope_switch.js (Ward 11/25 note 4: "Vudu 1-6x sometimes doesn't switch zoom").
// The switchable scopes in the gun packs are pairs of attachments (Vudu 6x / 1.5x "Switched", the magnifier sights, EOTech
// HHS + nozoom...). TaCZ's zoom key (while aiming) bumps the scope's ZoomNumber, and ra1k's gun_logic.lua swaps the pair on
// odd/even, but only on guns that run that script (Phoenix pack guns), so on other packs' guns the scope never switched.
// Here the same odd/even swap runs for the gun in every player's main hand, whatever gun it is. Same rule as the lua, so the
// two agree on Phoenix guns. Server side; the gun's NBT change syncs to the client by itself.
var ZSS = { PAIRS: [
  ['ra1k:vudu_6x', 'ra1k:vudu_2x'],
  ['ra1k:sight_magnifier', 'ra1k:sight_magnifier_off'],
  ['asos:sight_eotech_hhs8', 'asos:sight_eotech_hhs8_nozoom'],
  ['asos:sight_eotech_hhs1', 'asos:sight_eotech_hhs1_nozoom'],
  ['asos:sight_eotech_hhs6_hdl', 'asos:sight_eotech_hhs6_hdl_nozoom'],
  ['mk16:553_g43', 'mk16:553_g43f']
] }
var zssMap = {}, zssWarned = false, zssTick = 0
ZSS.PAIRS.forEach(function (p) { zssMap[p[0]] = p; zssMap[p[1]] = p })
ServerEvents.tick(function (event) {
  if (++zssTick % 2 !== 0) return
  try {
    event.server.players.forEach(function (p) {
      var st = p.mainHandItem
      if (st.isEmpty() || String(st.id) !== 'tacz:modern_kinetic_gun') return
      var tag = st.nbt
      if (!tag || !tag.contains('AttachmentSCOPE')) return
      var sc = tag.getCompound('AttachmentSCOPE')
      if (!sc.contains('tag')) return
      var t = sc.getCompound('tag'), id = String(t.getString('AttachmentId')), pair = zssMap[id]
      if (!pair || !t.contains('ZoomNumber')) return
      var z = t.getInt('ZoomNumber')
      if (z <= 0) return
      var want = z % 2 === 0 ? pair[0] : pair[1]
      if (want !== id) t.putString('AttachmentId', want)
    })
  } catch (x) { if (!zssWarned) { zssWarned = true; console.warn('[zone] scope switch: ' + x) } }
})

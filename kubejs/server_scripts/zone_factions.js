// Factions (Slade) - who's who, using scoreboard teams so every client knows.
// The client mod shows name + faction under the crosshair (green = your side, red = hostile, white = neutral)
// and stops NPCs on your team from hurting you (and you them).
//  - Players and friendly NPCs: Scavengers
//  - Bandit NPCs (TaCZ NPCs Mod templates "bandits" / "bandit_leader"): Bandits
// Add more later (Wardens, The Quiet, the Choir) the same way.
var ZFAC = {
  TEAMS: [
    { id: 'scavengers', name: 'Scavengers', color: 'green' },
    { id: 'bandits',    name: 'Bandits',    color: 'red' },
    { id: 'choir',      name: 'The Choir',  color: 'dark_purple' },
    { id: 'pacifists',  name: 'Pacifists',  color: 'aqua' },
    { id: 'military',   name: 'Military',   color: 'dark_green' },
    { id: 'armoury',    name: 'The Armoury', color: 'gold' }
  ],
  // tacznpcs template -> team
  TEMPLATES: { scavengers: 'scavengers', bandits: 'bandits', bandit_leader: 'bandits', pacifists: 'pacifists' }
}
var zfacTick = 0
var zfacMade = false
function zfacSetup(srv) {
  ZFAC.TEAMS.forEach(function (t) {
    srv.runCommandSilent('team add ' + t.id + ' {"text":"' + t.name + '"}')
    srv.runCommandSilent('team modify ' + t.id + ' color ' + t.color)
    srv.runCommandSilent('team modify ' + t.id + ' friendlyFire true')
    srv.runCommandSilent('team modify ' + t.id + ' seeFriendlyInvisibles false')
    srv.runCommandSilent('team modify ' + t.id + ' nametagVisibility never')   // no floating names; look at someone to identify them
  })
  zfacMade = true
}
ServerEvents.loaded(function (event) { try { zfacSetup(event.server) } catch (e) { console.error('[zone] factions setup failed: ' + e) } })
ServerEvents.tick(function (event) {
  if (++zfacTick % 60 !== 0) return   // every 3 s
  var srv = event.server
  try {
    if (!zfacMade) zfacSetup(srv)
    srv.runCommandSilent('team join scavengers @a[team=]')
    Object.keys(ZFAC.TEMPLATES).forEach(function (tpl) {
      srv.runCommandSilent('execute in minecraft:overworld run team join ' + ZFAC.TEMPLATES[tpl] + ' @e[type=tacznpcs:npc,team=,nbt={template:"' + tpl + '"}]')
    })
    // CustomNPCs at the Bar (Old Moe, Sparrow, Grandpa...) are Scavengers unless tagged otherwise
    srv.runCommandSilent('execute in minecraft:overworld run team join scavengers @e[type=customnpcs:customnpc,team=,tag=!zone_bandit]')
    srv.runCommandSilent('execute in minecraft:overworld run team join scavengers @e[type=anomalyzone:trader_npc,team=]')
  } catch (err) { console.error('[zone] factions failed: ' + err) }
})

// Anonymous Zone (Slade, with zone_tactical_anims 0.76.2). Nobody knows who's who.
//  - No death messages or advancement announcements in chat (gamerules, set on every start).
//  - Xaero fair-play on join: no entity radar on the minimap, so other players never show as named dots.
//    (Mobs vanish from the radar too. Set ZANON.FAIR_PLAY = false to keep the radar.)
//  - Chat bubbles, no Tab list, no join/leave messages, faction-only names: zone_tactical_anims (Anon / AnonClient).
//  - PDA chatter uses made-up Zone names instead of real players (zone_pda_chatter.js).
var ZANON = { FAIR_PLAY: true }

ServerEvents.loaded(function (event) {
  try {
    event.server.runCommandSilent('gamerule showDeathMessages false')
    event.server.runCommandSilent('gamerule announceAdvancements false')
  } catch (e) { console.error('[zone] anon gamerules failed: ' + e) }
})

PlayerEvents.loggedIn(function (event) {
  try {
    if (!ZANON.FAIR_PLAY) return
    // Xaero's Minimap reads this code from a chat line and switches to fair-play (no radar, no cave mode)
    event.player.tell(Text.of('[PDA] Link established. §f§a§i§r§x§a§e§r§o').color(0x6A6A60))
  } catch (e) { console.error('[zone] anon join message failed: ' + e) }
})

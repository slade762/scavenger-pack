// The Bar (Slade) - the bunker hub where everyone starts.
//  - Old Mole is now Old Moe (renames the saved NPC the first time he's loaded).
//  - Nobody but Old Moe stands behind his counter.
//  - Sparrow and Grandpa chat to players who hang around the campfire, pointing new players at Old Moe.
//    (Sparrow goes quiet while he's missing in Act 1; see zone_story.js.)
var ZBAR = {
  // behind the counter (the counter itself is the line x = -1530, z 89..99)
  DESK: { minX: -1529.9, maxX: -1526.0, minY: 82, maxY: 86, minZ: 88.6, maxZ: 100.4 },
  DESK_OUT_X: -1531.5,               // where anyone found back there is moved to (same z), the customer side
  CHAT_RANGE: 7,                     // players this close to the campfire hear the chatter
  CHAT_GAP: [60, 120],               // seconds between lines
  CAMPFIRE: { x: -1533.5, y: 83, z: 97.5 },
  LINES: {
    Sparrow: [
      "New face? Go see Old Moe at the counter. He always has work.",
      "Moe's been asking for anyone who can shoot straight. That you?",
      "Quiet out there today. Don't trust it.",
      "Heard something past the lake last night. Hope it was the wind.",
      "If you're broke, talk to Moe. If you're stupid, go to the city.",
      "City's singing tonight, I can feel it in my teeth. Stay close to the door."
    ],
    // while Sparrow is missing (Act 1)
    GrandpaWorried: [
      "Sparrow's not back yet. Have you seen him? Come and talk to me.",
      "That boy. Walked off east in the night. Somebody has to go after him.",
      "Made it back before the City sang? Good. Sparrow didn't."
    ],
    Grandpa: [
      "Talk to Moe, kid. Then come back and tell me a story.",
      "Keep your boots dry and your magazines full.",
      "Rubles don't keep you warm. A good coat does.",
      "When the sky goes red, you get underground. No arguing.",
      "The city used to have the best bakery in the oblast. Now it sings at night.",
      "City's singing, kid? Get inside. Don't stand there listening to it."
    ]
  }
}
var zbarTick = 0
var zbarNextChat = 0
var zbarWarned = false
ServerEvents.tick(function (event) {
  zbarTick++
  if (zbarTick % 20 !== 0) return
  var srv = event.server
  try {
    var near = false
    srv.players.forEach(function (p) {
      if (Math.abs(p.x - ZBAR.CAMPFIRE.x) < 64 && Math.abs(p.z - ZBAR.CAMPFIRE.z) < 64) near = true
    })
    if (!near) return
    var d = ZBAR.DESK
    var box = 'x=' + d.minX + ',y=' + d.minY + ',z=' + d.minZ + ',dx=' + (d.maxX - d.minX) + ',dy=' + (d.maxY - d.minY) + ',dz=' + (d.maxZ - d.minZ)
    // rename once (cheap if nobody matches)
    if (zbarTick % 200 === 0) srv.runCommandSilent('execute in minecraft:overworld as @e[type=customnpcs:customnpc,name="Old Mole",limit=1] run data merge entity @s {Name:"Old Moe"}')
    // keep the counter clear: tacz NPCs and any CustomNPC except Old Moe
    srv.runCommandSilent('execute in minecraft:overworld as @e[type=tacznpcs:npc,' + box + '] at @s run tp @s ' + ZBAR.DESK_OUT_X + ' ~ ~')
    srv.runCommandSilent('execute in minecraft:overworld as @e[type=customnpcs:customnpc,' + box + ',name=!"Old Moe",name=!"Old Mole"] at @s run tp @s ' + ZBAR.DESK_OUT_X + ' ~ ~')
    // campfire chatter
    if (zbarTick < zbarNextChat) return
    var c = ZBAR.CAMPFIRE, r = ZBAR.CHAT_RANGE
    var listeners = []
    srv.players.forEach(function (p) {
      if (Math.hypot(p.x - c.x, p.z - c.z) <= r && Math.abs(p.y - c.y) < 4) listeners.push(p)
    })
    if (listeners.length === 0) return
    var home = global.zoneSparrowHome !== false          // zone_story.js: false while Sparrow is missing
    var who = home && Math.random() < 0.5 ? 'Sparrow' : 'Grandpa'
    var pool = (!home && Math.random() < 0.5) ? ZBAR.LINES.GrandpaWorried : ZBAR.LINES[who]
    var line = pool[Math.floor(Math.random() * pool.length)]
    listeners.forEach(function (p) {
      p.tell(Text.of(who + ': ').color(0x8FCB6A).append(Text.of(line).color(0xD9D9D0)))
    })
    zbarNextChat = zbarTick + 20 * Math.floor(ZBAR.CHAT_GAP[0] + Math.random() * (ZBAR.CHAT_GAP[1] - ZBAR.CHAT_GAP[0]))
  } catch (err) {
    if (!zbarWarned) { zbarWarned = true; console.error('[zone] bar script failed: ' + err) }
  }
})

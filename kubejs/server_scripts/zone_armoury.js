// The Armoury (Slade).
//  - Forgemaster Rusak lives at 264 86 -499. When that spot is loaded and he isn't there, he's placed there
//    (any old copy somewhere else is removed). Move him with /kubejs custom_command zone_npc_rusak as usual,
//    then change HOME below to match, or he'll be put back here.
//  - Armoury members call each other shieldbrothers and shieldsisters. Rusak's dialog texts are updated live
//    (the dialog files on the server were changed too, so they stay that way after a restart).
var ZARM = {
  HOME: { x: 264, y: 86, z: -499 },
  DIALOGS: {
    85: "Rusak. Forgemaster of the Armoury. My shieldbrothers and shieldsisters build what keeps people alive out here: armour, rifles, and bigger things you aren't cleared to see yet. Nothing is free. Everything is fair. What do you want?",
    88: "Walkers. Machines a man can sit inside. We salvaged the first one from the Military and made it better. They are not for sale. Not yet. Prove you can be trusted, earn the right to be called shieldbrother or shieldsister, and maybe one day you'll drive one."
  }
}
var zarmTick = 0, zarmWarned = {}, zarmPatched = false
function zarmErr(k, e) { if (!zarmWarned[k]) { zarmWarned[k] = true; console.error('[zone] armoury ' + k + ': ' + e) } }

ServerEvents.tick(function (event) {
  if (++zarmTick % 200 !== 0) return   // every 10 s
  var srv = event.server
  if (!zarmPatched) {
    zarmPatched = true
    try {
      var DC = Java.loadClass('noppes.npcs.controllers.DialogController').instance, I = Java.loadClass('java.lang.Integer')
      Object.keys(ZARM.DIALOGS).forEach(function (id) {
        var d = DC.dialogs.get(I.valueOf(String(id)))
        if (d) d.text = ZARM.DIALOGS[id]
      })
    } catch (e) { zarmErr('dialogs', e) }
  }
  try {
    var h = ZARM.HOME, near = false
    srv.players.forEach(function (p) {
      if (String(p.level.dimension) === 'minecraft:overworld' && Math.abs(p.x - h.x) < 128 && Math.abs(p.z - h.z) < 128) near = true
    })
    if (!near) return
    var BP = Java.loadClass('net.minecraft.core.BlockPos')
    if (!srv.overworld().isLoaded(new BP(h.x, h.y, h.z))) return
    var home = 'x=' + (h.x - 8) + ',y=' + (h.y - 6) + ',z=' + (h.z - 8) + ',dx=16,dy=12,dz=16'
    // any loaded Rusak away from home goes; if none is home, place him
    srv.runCommandSilent('execute in minecraft:overworld run kill @e[type=customnpcs:customnpc,tag=zq_rusak,tag=!zarm_home]')
    var atHome = Number(srv.runCommandSilent('execute in minecraft:overworld if entity @e[type=customnpcs:customnpc,tag=zq_rusak,' + home + ']'))
    if (atHome > 0) {
      srv.runCommandSilent('execute in minecraft:overworld run tag @e[type=customnpcs:customnpc,tag=zq_rusak,' + home + '] add zarm_home')
      srv.runCommandSilent('execute in minecraft:overworld run data merge entity @e[type=customnpcs:customnpc,tag=zq_rusak,limit=1,name="Quartermaster Rusak"] {Name:"Forgemaster Rusak"}')
      return
    }
    global.zoneQgPlace(srv, 'rusak', h.x, h.y, h.z, 0, 'minecraft:overworld')
    srv.runCommandSilent('execute in minecraft:overworld run tag @e[type=customnpcs:customnpc,tag=zq_rusak,' + home + '] add zarm_home')
    console.info('[zone] armoury: placed Forgemaster Rusak at ' + h.x + ' ' + h.y + ' ' + h.z)
  } catch (e) { zarmErr('place', e) }
})

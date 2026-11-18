// Dialog quest fix (Slade). Our hand-written quest files stored the dialog under "Value", but Custom NPCs reads
// "Integer" for dialog quests, so every "read this dialog" quest waited for dialog 0 and never finished.
// The files now carry both keys (fixed for the next restart). Until then this patches the loaded quests, and once a
// second it runs Custom NPCs' own quest check so players who already read the dialog finish it (normal rewards,
// completion text and next quest).
var ZDQ = {"10":30,"13":36,"22":64,"23":72,"24":85,"100":110,"106":122,"108":140}   // quest -> dialog
var zdqPD = null, zdqWarned = {}, zdqTick = 0, zdqPatched = false
function zdqErr(k, e) { if (!zdqWarned[k]) { zdqWarned[k] = true; console.error('[zone] dialog quest fix ' + k + ': ' + e) } }
function zdqPatch() {
  zdqPatched = true
  var QC = Java.loadClass('noppes.npcs.controllers.QuestController').instance
  Object.keys(ZDQ).forEach(function (id) {
    try {
      var I = Java.loadClass('java.lang.Integer'), q = QC.quests.get(I.valueOf(String(id)))
      if (!q) return
      var m = q.questInterface.dialogs
      if (Number(m.get(I.valueOf('0'))) !== ZDQ[id]) { m.clear(); m.put(I.valueOf('0'), I.valueOf(String(ZDQ[id]))); console.info('[zone] dialog quest fix: quest ' + id + ' now waits for dialog ' + ZDQ[id]) }
    } catch (e) { zdqErr('patch ' + id, e) }
  })
}
ServerEvents.tick(function (event) {
  if (++zdqTick % 20 !== 0) return
  if (!zdqPatched) zdqPatch()
  if (!zdqPD) zdqPD = Java.loadClass('noppes.npcs.controllers.data.PlayerData')
  event.server.players.forEach(function (p) {
    try { zdqPD.get(p).questData.checkQuestCompletion(p, 1) } catch (e) { zdqErr('check', e) }
    if (zdqTick === 60) try { var qd = zdqPD.get(p).questData; console.info('[zone] dialog quest fix check: ' + p.username + ' active=' + qd.activeQuests.keySet() + ' finished=' + qd.finishedQuests.keySet()) } catch (e) { zdqErr('diag', e) }
  })
})

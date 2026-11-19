// The ATM (Slade). Your bank account is the PDA balance: it's safe, but you can only pay it in or take it out here.
// Cash you carry (ruble notes) drops on your body when you die, so bank it when you're home.
//
// Right-click an ATM: shows your bank balance and cash, with buttons to deposit or withdraw.
// Players can also type /atm, /atm deposit, /atm withdraw <amount> while standing at one.
//
// Op setup (any block works: a PC, an electrical box, a safe...):
//   look at the block, then   /kubejs custom_command zone_atm_here     (makes it an ATM)
//                             /kubejs custom_command zone_atm_remove   (stops it being one)
var ZATM = { RANGE: 5, WITHDRAW: [1000, 5000, 25000, 100000] }

function zatmList(srv) {
  var raw = srv.persistentData.getString('zone_atms')
  try { return raw ? JSON.parse(raw) : [] } catch (e) { return [] }
}
function zatmSave(srv, list) { srv.persistentData.putString('zone_atms', JSON.stringify(list)) }
function zatmNear(p) {
  var dim = String(p.level.dimension)
  return zatmList(p.server).some(function (a) {
    return a.d === dim && Math.abs(p.x - (a.x + 0.5)) <= ZATM.RANGE && Math.abs(p.y - a.y) <= ZATM.RANGE && Math.abs(p.z - (a.z + 0.5)) <= ZATM.RANGE
  })
}
function zatmIsAtm(block) {
  var dim = String(block.level.dimension)
  return zatmList(block.level.server).some(function (a) { return a.d === dim && a.x === block.x && a.y === block.y && a.z === block.z })
}
function zatmBeep(p) { try { p.server.runCommandSilent('playsound minecraft:block.note_block.bit player ' + p.username + ' ~ ~ ~ 0.6 1.6') } catch (e) {} }

function zatmMenu(p) {
  var f = global.zoneFmt
  p.tell(Text.of('ATM ').color(0xD8B225).append(Text.of('Bank: ' + f(global.zoneBank(p)) + ' ₽   Cash on you: ' + f(global.zoneCash(p, false)) + ' ₽').color(0xD9D9D0)))
  var row = Text.of('[Deposit all cash]').color(0x9BD86A).clickRunCommand('/atm deposit').hover(Text.of('Pay every ruble note you are carrying into the bank'))
  ZATM.WITHDRAW.forEach(function (n) {
    row = row.append(Text.of('  ')).append(Text.of('[Take ' + f(n) + ']').color(0xE0B060).clickRunCommand('/atm withdraw ' + n).hover(Text.of('Withdraw ' + f(n) + ' ₽ in notes')))
  })
  row = row.append(Text.of('  ')).append(Text.of('[Other amount]').color(0xAAAAAA).clickSuggestCommand('/atm withdraw ').hover(Text.of('Type how much to withdraw')))
  p.tell(row)
}
function zatmDeposit(p) {
  var cash = global.zoneCash(p, true)
  if (cash <= 0) { p.tell(Text.gray('ATM: you have no ruble notes in your pockets.')); return 0 }
  var bal = global.zoneAddRubles(p, cash)
  zatmBeep(p)
  p.tell(Text.of('ATM: deposited ' + global.zoneFmt(cash) + ' ₽. Bank: ' + global.zoneFmt(bal) + ' ₽.').color(0x9BD86A))
  return 1
}
function zatmWithdraw(p, amount) {
  amount = Math.floor(amount / 100) * 100
  if (amount <= 0) { p.tell(Text.gray('ATM: withdraw at least 100 ₽.')); return 0 }
  if (global.zoneBank(p) < amount || !global.zoneTakeRubles(p, amount)) {
    p.tell(Text.red('ATM: not enough in the bank (' + global.zoneFmt(global.zoneBank(p)) + ' ₽).')); return 0
  }
  global.zoneGiveCash(p, amount)
  zatmBeep(p)
  p.tell(Text.of('ATM: withdrew ' + global.zoneFmt(amount) + ' ₽ in notes. Bank: ' + global.zoneFmt(global.zoneBank(p)) + ' ₽.').color(0xE0B060))
  return 1
}

ServerEvents.commandRegistry(function (event) {
  var C = event.commands, A = event.arguments
  function atPlayer(ctx, fn) {
    var p = ctx.source.player
    if (!p) return 0
    if (!zatmNear(p)) { p.tell(Text.gray('You need to be standing at an ATM (there is one at the Bar).')); return 0 }
    try { return fn(p) } catch (e) { console.error('[zone] atm failed: ' + e); return 0 }
  }
  event.register(C.literal('atm')
    .executes(function (ctx) { return atPlayer(ctx, function (p) { zatmMenu(p); return 1 }) })
    .then(C.literal('deposit').executes(function (ctx) { return atPlayer(ctx, zatmDeposit) }))
    .then(C.literal('withdraw').then(C.argument('amount', A.INTEGER.create(event))
      .executes(function (ctx) { return atPlayer(ctx, function (p) { return zatmWithdraw(p, A.INTEGER.getResult(ctx, 'amount')) }) }))))
})

BlockEvents.rightClicked(function (event) {
  if (String(event.hand) !== 'MAIN_HAND') return
  if (!zatmIsAtm(event.block)) return
  zatmMenu(event.player)
  event.cancel()
})

ServerEvents.customCommand('zone_atm_here', function (event) {
  var p = event.player
  if (!p) return
  var hit = p.rayTrace(6, false)
  var b = hit ? hit.block : null
  if (!b) { p.tell(Text.red('Look at the block you want to be the ATM.')); return }
  var list = zatmList(event.server), dim = String(p.level.dimension)
  if (!zatmIsAtm(b)) list.push({ d: dim, x: b.x, y: b.y, z: b.z })
  zatmSave(event.server, list)
  p.tell(Text.of('ATM set at ' + b.x + ' ' + b.y + ' ' + b.z + ' (' + b.id + '). ' + list.length + ' ATM(s) total.').color(0x9BD86A))
})
ServerEvents.customCommand('zone_atm_remove', function (event) {
  var p = event.player
  if (!p) return
  var hit = p.rayTrace(6, false), b = hit ? hit.block : null
  if (!b) { p.tell(Text.red('Look at the ATM block.')); return }
  var dim = String(p.level.dimension)
  var list = zatmList(event.server).filter(function (a) { return !(a.d === dim && a.x === b.x && a.y === b.y && a.z === b.z) })
  zatmSave(event.server, list)
  p.tell(Text.of('Done. ' + list.length + ' ATM(s) left.').color(0xD8B225))
})

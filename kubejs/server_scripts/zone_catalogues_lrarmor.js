// LesRaisins Armor (lrarmor) in the trader catalogues (Claude, 11/24, Ward: "balance them like the current pieces and add them to trader stocks").
// Needs zone_tactical_anims 0.89+ (ZoneTrade.catalogueAdd); with an older jar this does nothing.
// Added on top of zone_catalogues.js a couple of seconds after it registers (catalogueAdd appends, same item id = replaced).
// Price levels as zone_catalogues.js (chest 1=10k ... 10=10M; helmet x0.7, legs x0.8, boots x0.5).
//  Agency service suits (ATF/DEA/FBI/IRS) L1 -> Masha | Joker L1 + Joker combat L3 -> Eliwood | Agency tactical (ATF vest/DEA/FBI armed) L3 -> Bogdan
//  Scout + Sniper L4, Attacker L6, Defender L7 -> Sergeant Hrytsenko | Medical L5, Chemical Protective L9, Armored Chemical L10 -> Lev
//  Both chemical helmets protect up to radiation level 6 (Portyan) via helmetTiers in zone_tactical_anims-common.toml.
// Compact form: [id, price, tab, tier?]
var ZCAT_LR_NEED = {"Lev": {"2": "Trusted (150) with the Scavengers", "3": "Friend (350) with the Scavengers"}, "Sergeant Hrytsenko": {"2": "Known (50) with the Military", "3": "Trusted (150) with the Military"}, "Eliwood": {"2": "Trusted (150) with the Pacifists"}}
var ZCAT_LR = {"Masha": [["lrarmor:atf_helmet", 7000, "Agency suits"], ["lrarmor:atf_chestplate", 10000, "Agency suits"], ["lrarmor:atf_leggings", 8000, "Agency suits"], ["lrarmor:atf_boots", 5000, "Agency suits"], ["lrarmor:dea_helmet", 7000, "Agency suits"], ["lrarmor:dea_chestplate", 10000, "Agency suits"], ["lrarmor:dea_leggings", 8000, "Agency suits"], ["lrarmor:dea_boots", 5000, "Agency suits"], ["lrarmor:fbi_helmet", 7000, "Agency suits"], ["lrarmor:fbi_chestplate", 10000, "Agency suits"], ["lrarmor:fbi_leggings", 8000, "Agency suits"], ["lrarmor:fbi_boots", 5000, "Agency suits"], ["lrarmor:irs_helmet", 7000, "Agency suits"], ["lrarmor:irs_chestplate", 10000, "Agency suits"], ["lrarmor:irs_leggings", 8000, "Agency suits"], ["lrarmor:irs_boots", 5000, "Agency suits"]], "Eliwood": [["lrarmor:joker_helmet", 7000, "Joker"], ["lrarmor:joker_chestplate", 10000, "Joker"], ["lrarmor:joker_leggings", 8000, "Joker"], ["lrarmor:joker_boots", 5000, "Joker"], ["lrarmor:joker_armed_helmet", 42000, "Joker", 2], ["lrarmor:joker_armed_chestplate", 60000, "Joker", 2], ["lrarmor:joker_armed_leggings", 48000, "Joker", 2], ["lrarmor:joker_armed_boots", 30000, "Joker", 2]], "Bogdan": [["lrarmor:atf_vest_helmet", 42000, "Agency tactical"], ["lrarmor:atf_vest_chestplate", 60000, "Agency tactical"], ["lrarmor:atf_vest_leggings", 48000, "Agency tactical"], ["lrarmor:atf_vest_boots", 30000, "Agency tactical"], ["lrarmor:dea_armed_helmet", 42000, "Agency tactical"], ["lrarmor:dea_armed_chestplate", 60000, "Agency tactical"], ["lrarmor:dea_armed_leggings", 48000, "Agency tactical"], ["lrarmor:dea_armed_boots", 30000, "Agency tactical"], ["lrarmor:fbi_armed_helmet", 42000, "Agency tactical"], ["lrarmor:fbi_armed_chestplate", 60000, "Agency tactical"], ["lrarmor:fbi_armed_leggings", 48000, "Agency tactical"], ["lrarmor:fbi_armed_boots", 30000, "Agency tactical"]], "Sergeant Hrytsenko": [["lrarmor:scout_helmet", 84000, "LesRaisins", 2], ["lrarmor:scout_chestplate", 120000, "LesRaisins", 2], ["lrarmor:scout_leggings", 96000, "LesRaisins", 2], ["lrarmor:scout_boots", 60000, "LesRaisins", 2], ["lrarmor:sniper_helmet", 84000, "LesRaisins", 2], ["lrarmor:sniper_chestplate", 120000, "LesRaisins", 2], ["lrarmor:sniper_leggings", 96000, "LesRaisins", 2], ["lrarmor:sniper_boots", 60000, "LesRaisins", 2], ["lrarmor:attacker_helmet", 350000, "LesRaisins", 2], ["lrarmor:attacker_chestplate", 500000, "LesRaisins", 2], ["lrarmor:attacker_leggings", 400000, "LesRaisins", 2], ["lrarmor:attacker_boots", 250000, "LesRaisins", 2], ["lrarmor:defender_helmet", 700000, "LesRaisins", 3], ["lrarmor:defender_chestplate", 1000000, "LesRaisins", 3], ["lrarmor:defender_leggings", 800000, "LesRaisins", 3], ["lrarmor:defender_boots", 500000, "LesRaisins", 3]], "Lev": [["lrarmor:medical_helmet", 175000, "Field medic", 2], ["lrarmor:medical_chestplate", 250000, "Field medic", 2], ["lrarmor:medical_leggings", 200000, "Field medic", 2], ["lrarmor:medical_boots", 125000, "Field medic", 2], ["lrarmor:chemical_protective_helmet", 3500000, "Chemical suits", 3], ["lrarmor:chemical_protective_chestplate", 5000000, "Chemical suits", 3], ["lrarmor:chemical_protective_leggings", 4000000, "Chemical suits", 3], ["lrarmor:chemical_protective_boots", 2500000, "Chemical suits", 3], ["lrarmor:armored_chemical_helmet", 7000000, "Chemical suits", 3], ["lrarmor:armored_chemical_chestplate", 10000000, "Chemical suits", 3], ["lrarmor:armored_chemical_leggings", 8000000, "Chemical suits", 3], ["lrarmor:armored_chemical_boots", 5000000, "Chemical suits", 3]]}
var zcatLrTicks = 0
function zcatLrRegister() {
  var ZT = null
  try { ZT = Java.loadClass('com.slade.zonetactical.trade.ZoneTrade') } catch (e) { return }
  try { if (typeof ZT.catalogueAdd !== 'function') return } catch (e) { return }
  var n = 0
  Object.keys(ZCAT_LR).forEach(function (name) {
    var list = ZCAT_LR[name].map(function (r) {
      var e = { id: r[0], price: r[1], tab: r[2] }
      if (r[3] > 1) { e.tier = r[3]; e.need = (ZCAT_LR_NEED[name] || {})[String(r[3])] || '' }
      return e
    })
    ZT.catalogueAdd(name, JSON.stringify(list))
    n += list.length
  })
  console.info('[zone] catalogues: + ' + n + ' lrarmor entries')
}
ServerEvents.tick(function (event) { zcatLrTicks++; if (zcatLrTicks === 40) zcatLrRegister() })
// sell barrel price list (zone_sell_barrel.js pays a share of the cheapest catalogue price)
if (!global.zoneCatPrice) global.zoneCatPrice = {}
Object.keys(ZCAT_LR).forEach(function (name) { ZCAT_LR[name].forEach(function (r) { var c = global.zoneCatPrice[r[0]]; if (!c || r[1] < c) global.zoneCatPrice[r[0]] = r[1] }) })

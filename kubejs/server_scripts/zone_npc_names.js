// zone_npc_names.js (Ward 11/25 note 2): world NPCs get real names instead of "Scavenger" / "Soldier" / "Bandit".
// Every tacznpcs:npc that joins the world (spawn or chunk load) with a generic name gets a STALKER-style one and a hidden
// faction tag (zn_scav / zn_bandit / zn_mil / zn_pac) so scripts that used to find bandits by the name "Bandit" still can.
// Story / quest NPCs already have their own names, so they are never touched. No chat; console line only for the count.
var ZNN = {
  GENERIC: {
    'Scavenger': 'scav', 'Stalker': 'scav', 'Drifter': 'scav', 'Loner': 'scav',
    'Bandit': 'bandit',
    'Soldier': 'mil', 'Private': 'mil', 'Corporal': 'mil', 'Sergeant': 'mil', 'Sentry': 'mil',
    'Pacifist': 'pac', 'Pacifist Sentry': 'pac'
  },
  // same pools as the players' Zone names (zta anon/Aliases), trimmed
  FIRST: ['Vova', 'Tolya', 'Grisha', 'Misha', 'Kolya', 'Sanya', 'Lyokha', 'Stas', 'Zhenya', 'Petro', 'Vitya', 'Borya',
    'Senya', 'Dima', 'Igor', 'Fima', 'Roma', 'Oleg', 'Yura', 'Semyon', 'Taras', 'Arkasha', 'Venya', 'Ostap', 'Slava',
    'Seryoga', 'Tima', 'Valera', 'Pashka', 'Vanka', 'Gleb', 'Matvey', 'Genka', 'Edik', 'Vadim', 'Danya', 'Vasya',
    'Fedka', 'Danko', 'Ilya', 'Fedya', 'Zhora', 'Shurik', 'Sava', 'Gena', 'Egor', 'Yurko', 'Petya', 'Yasha', 'Vlad',
    'Danila', 'Fyodor', 'Stepa', 'Syoma', 'Rostik', 'Lyonya', 'Kostya', 'Seva', 'Anton', 'Nikita', 'Dmitro', 'Artyom',
    'Mitya', 'Denis', 'Bogdan', 'Yarik', 'Stepan', 'Gosha', 'Lyova', 'Vasko', 'Timka', 'Borka', 'Kuzya', 'Makar'],
  NICK: ['Ryzhy', 'Kosoy', 'Tikhiy', 'Lysy', 'Boroda', 'Shustry', 'Sych', 'Kot', 'Shilo', 'Gvozd', 'Zubr', 'Fonar',
    'Friday', 'Sharp', 'Piranha', 'Spider', 'Pioneer', 'Owl', 'Claw', 'Boa', 'Shaggy', 'Dancer', 'Crocodile', 'Boulder',
    'Hook', 'Drip', 'Cracker', 'Muskrat', 'Artist', 'Rook', 'Pilgrim', 'Beetle', 'Skiff', 'Key', 'Scoop', 'Nerve',
    'Leshiy', 'Goose', 'Reverend', 'Professor', 'Moose', 'Wind', 'Aviator', 'Gnat', 'Docent', 'Boar', 'Healer',
    'Gloomy', 'Vagabond', 'Piston', 'Rider', 'Tramp', 'Cleaner', 'Mechanic', 'Hedgehog', 'Hood', 'Rusty', 'Tourist',
    'Scholar', 'Smoker', 'Ice', 'Cossack', 'Flint', 'Gadfly', 'Gopher', 'Garlic', 'Cat', 'Bulldog', 'Motor', 'Drill',
    'Trigger', 'Poet', 'Rocker', 'Whiz', 'Accordion', 'Cider', 'Pitman', 'Courier', 'Jerboa', 'Skinny', 'Pepper',
    'Ferret', 'Pilot', 'Tambourine', 'Hare', 'Shepherd', 'Raven', 'Pianist', 'Postman', 'Feather', 'Oldtimer', 'Canary',
    'Rabbit', 'Shaman', 'Isotope', 'Razor', 'Mosquito', 'Brick', 'Woodchuck', 'Chemist', 'Tobacco', 'Runner', 'Bolt',
    'Chisel', 'Bard', 'Microbe', 'Porter', 'Jumper', 'Homebrew', 'Local', 'Smartass', 'Buddy', 'Nail', 'Nickel', 'Root',
    'Nocturnal', 'Carpenter', 'Carp', 'Stone', 'Dumpling', 'Forester', 'Bone', 'Traveler', 'Grouse', 'Geologist',
    'Paddle', 'Quiet', 'Parachute', 'Marmot', 'Gramps', 'Bear', 'Lantern', 'Thorn', 'Tuner', 'Ant', 'Pipe', 'Boot',
    'Student', 'Diver', 'Beekeeper', 'Lucky', 'Awl'],
  CALLSIGN: ['Strider', 'Wolf', 'Ghost', 'Nomad', 'Lynx', 'Badger', 'Hawk', 'Mole', 'Saint', 'Shade', 'Ash', 'Viper',
    'Hermit', 'Wanderer', 'Monk', 'Doc', 'Tracker', 'Scout', 'Smoke', 'Rust', 'Kestrel', 'Hound', 'Sapper', 'Echo',
    'Compass', 'Crow', 'Moth', 'Splinter', 'Static'],
  B_FIRST: ['Vovan', 'Kolyan', 'Tolyan', 'Seryoga', 'Lyokha', 'Dimon', 'Vitek', 'Zhorik', 'Sanyok', 'Pashok', 'Edik',
    'Gosha', 'Borka', 'Venya', 'Stasyan', 'Romka', 'Igorek', 'Valyok', 'Mishka', 'Grishka'],
  B_NICK: ['Gopnik', 'Baldy', 'Shank', 'Thug', 'Mutt', 'Scar', 'Crook', 'Shiv', 'Hammer', 'Knuckles', 'Rat', 'Fixer',
    'Sly', 'Lefty', 'Snake', 'Jackal', 'Tusk', 'Tattoo', 'Boxer', 'Brass', 'Weasel', 'Fence', 'Cutthroat', 'Hog',
    'Squint', 'Stub', 'Gold Tooth', 'Tracksuit', 'Mongrel', 'Crowbar'],
  RANK: ['Pvt.', 'Pvt.', 'Pvt.', 'Pvt.', 'Cpl.', 'Cpl.', 'Sgt.', 'Sgt.', 'Sr. Sgt.', 'Lt.'],
  SURNAME: ['Lysenko', 'Danylenko', 'Bondar', 'Hnatyuk', 'Petrenko', 'Moroz', 'Savchuk', 'Tkachenko', 'Kravchuk',
    'Shevchuk', 'Melnyk', 'Kovalenko', 'Boyko', 'Rudenko', 'Marchenko', 'Hrytsenko', 'Kostenko', 'Pavlenko',
    'Sydorenko', 'Levchenko', 'Polishchuk', 'Zinchenko', 'Karpenko', 'Yaremchuk', 'Ivanov', 'Petrov', 'Sokolov',
    'Morozov', 'Volkov', 'Lebedev', 'Kozlov', 'Novikov', 'Pavlov', 'Semyonov', 'Golubev', 'Bogdanov', 'Vorobyov',
    'Fyodorov', 'Belyaev', 'Tarasov', 'Belov', 'Komarov', 'Orlov', 'Kiselyov', 'Makarov', 'Andreev', 'Gusev', 'Titov',
    'Kuzmin', 'Kudryavtsev'],
  SKIP_TAGS: ['zone_story', 'zone_keeper', 'zone_escort', 'zone_scripted']
}
var znnCount = 0

function znnPick(a) { return a[Math.floor(Math.random() * a.length)] }

function znnName(role) {
  if (role === 'bandit') return znnPick(ZNN.B_FIRST) + ' ' + znnPick(ZNN.B_NICK)
  if (role === 'mil') return znnPick(ZNN.RANK) + ' ' + znnPick(ZNN.SURNAME)
  if (role === 'scav' && Math.random() < 0.2) return znnPick(ZNN.CALLSIGN)
  return znnPick(ZNN.FIRST) + ' ' + znnPick(ZNN.NICK)
}

function znnApply(e) {
  try {
    var cur = String(e.name.string)
    var role = ZNN.GENERIC[cur]
    if (!role) return
    for (var i = 0; i < ZNN.SKIP_TAGS.length; i++) if (e.tags.contains(ZNN.SKIP_TAGS[i])) return
    e.addTag('zn_' + role)
    e.setCustomName(Text.of(znnName(role)))
    znnCount++
  } catch (x) { console.warn('[zone] npc names: ' + x) }
}

EntityEvents.spawned('tacznpcs:npc', function (event) { znnApply(event.entity) })

// NPCs already in the world (after a script reload) and anything the join event missed: every 10 s
ServerEvents.tick(function (event) {
  if (event.server.tickCount % 200 === 0) {
    try { event.server.getEntities().forEach(function (e) { if (String(e.type) === 'tacznpcs:npc') znnApply(e) }) } catch (x) { console.warn('[zone] npc names sweep: ' + x) }
  }
  if (event.server.tickCount % 12000 !== 0 || znnCount === 0) return
  console.info('[zone] npc names: named ' + znnCount + ' NPCs in the last 10 min')
  znnCount = 0
})

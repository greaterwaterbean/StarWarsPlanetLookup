// Star Wars planets that ship with the app.
//
// Each one is just a type, a seed (the id) and a few setting tweaks, so the
// whole list costs almost nothing to store. Location coordinates are made up:
// canon rarely gives latitudes, so they are placed to feel right and snapped
// onto land when they would otherwise land in water. Edit freely: once you
// change a canon planet your version is saved, and "Reset" brings this one back.
//
// Diameters (km) are rough reference values for distance measuring. Change them
// in the planet editor if your campaign uses different numbers.

export const REGIONS = [
  'Deep Core',
  'Core Worlds',
  'Colonies',
  'Inner Rim',
  'Expansion Region',
  'Mid Rim',
  'Outer Rim',
  'Wild Space',
  'Unknown Regions',
  'Homebrew',
];

export const CANON_PLANETS = [
  {
    id: 'tatooine', name: 'Tatooine', region: 'Outer Rim', typeId: 'desert', diameter: 10465,
    description: 'A harsh desert world under twin suns, run by Hutt crime lords. Moisture farmers, Jawas and Tusken Raiders share the sand.',
    locations: [
      { name: 'Mos Eisley', type: 'spaceport', lat: 14, lon: 32, notes: 'Busy spaceport town full of smugglers and bounty hunters.' },
      { name: 'Chalmun\'s Cantina', type: 'cantina', lat: 14.8, lon: 33.4, notes: 'The cantina in Mos Eisley. No droids allowed.' },
      { name: 'Mos Espa', type: 'city', lat: 6, lon: 58, notes: 'Podracing city, home of the Boonta Eve Classic.' },
      { name: 'Anchorhead', type: 'town', lat: 19, lon: 22, notes: 'Small farming town.' },
      { name: 'Tosche Station', type: 'outpost', lat: 20.5, lon: 25, notes: 'Power converters available. Probably.' },
      { name: 'Lars Homestead', type: 'town', lat: 10, lon: 25, notes: 'Sunken moisture farm.' },
      { name: 'Ben Kenobi\'s Hut', type: 'poi', lat: 5, lon: 37, notes: 'A lonely dwelling at the edge of the Jundland Wastes.' },
      { name: 'Jundland Wastes', type: 'landmark', lat: 7, lon: 42, notes: 'Rocky canyons. Tusken Raider territory.' },
      { name: 'Dune Sea', type: 'landmark', lat: -2, lon: 48, notes: 'A vast sea of sand dunes.' },
      { name: 'Jabba\'s Palace', type: 'palace', lat: -4, lon: 63, notes: 'Fortress of Jabba the Hutt, on the far side of the Dune Sea.' },
      { name: 'Great Pit of Carkoon', type: 'cave', lat: -9, lon: 56, notes: 'Home of the Sarlacc.' },
      { name: 'Beggar\'s Canyon', type: 'landmark', lat: 22, lon: 29, notes: 'Narrow canyon good for skyhopper racing.' },
      { name: 'Mos Pelgo', type: 'town', lat: 28, lon: 72, notes: 'Remote mining town, later renamed Freetown.' },
    ],
  },
  {
    id: 'coruscant', name: 'Coruscant', region: 'Core Worlds', typeId: 'ecumenopolis', diameter: 12240,
    description: 'A planet covered by one endless city, seat of galactic government for thousands of years. The lowest levels never see daylight.',
    locations: [
      { name: 'Galactic Senate', type: 'capital', lat: 10, lon: 0, notes: 'The great Senate rotunda.' },
      { name: 'Jedi Temple', type: 'temple', lat: 11.5, lon: 4, notes: 'Ancient home of the Jedi Order, later the Imperial Palace grounds.' },
      { name: 'Imperial Palace', type: 'palace', lat: 8.5, lon: -3, notes: 'Seat of the Emperor.' },
      { name: 'Monument Plaza', type: 'landmark', lat: 12.5, lon: 1.5, notes: 'The last exposed mountain peak on the planet.' },
      { name: 'Uscru Entertainment District', type: 'city', lat: 16, lon: 10, notes: 'Nightclubs and gambling.' },
      { name: 'CoCo Town', type: 'city', lat: 4, lon: -16, notes: 'Civic Center district. Dex\'s Diner is here.' },
      { name: 'The Works', type: 'industry', lat: -22, lon: 30, notes: 'Abandoned industrial zone. Shady meetings.' },
      { name: 'Level 1313', type: 'cave', lat: -5, lon: 18, notes: 'Notorious undercity level.' },
    ],
  },
  {
    id: 'naboo', name: 'Naboo', region: 'Mid Rim', typeId: 'temperate', diameter: 12120,
    description: 'Green hills, lakes and swamps. The human Naboo live on the surface and the Gungans in cities beneath the water.',
    params: { seaLevel: 0.45, moisture: 0.35, mountains: 0.35 },
    locations: [
      { name: 'Theed', type: 'capital', lat: 24, lon: 10, notes: 'Royal capital built on cliffs above a river and waterfalls.' },
      { name: 'Theed Royal Palace', type: 'palace', lat: 24.6, lon: 10.8, notes: 'Home of the elected monarch.' },
      { name: 'Otoh Gunga', type: 'city', lat: 19, lon: 22, water: true, notes: 'Gungan bubble city at the bottom of Lake Paonga.' },
      { name: 'Gungan Sacred Place', type: 'temple', lat: 15, lon: 16, notes: 'Ruins hidden in the swamp, used as a refuge.' },
      { name: 'Great Grass Plains', type: 'landmark', lat: 18, lon: 11, notes: 'Site of the battle between the Gungans and the droid army.' },
      { name: 'Varykino', type: 'palace', lat: 36, lon: -6, notes: 'Lake retreat in the Lake Country.' },
      { name: 'Moenia', type: 'city', lat: 30, lon: 46, notes: 'Coastal city.' },
      { name: 'Keren', type: 'city', lat: 4, lon: 62, notes: 'Second city of Naboo.' },
    ],
  },
  {
    id: 'hoth', name: 'Hoth', region: 'Outer Rim', typeId: 'ice', diameter: 7200,
    description: 'A frozen world of snowfields and ice caves, home to tauntauns and wampas. Briefly a secret Rebel base.',
    params: { temperature: -1, seaLevel: 0.2 },
    locations: [
      { name: 'Echo Base', type: 'rebel', lat: 30, lon: -20, notes: 'Rebel base dug into the ice.' },
      { name: 'Shield Generator', type: 'outpost', lat: 31, lon: -24, notes: 'Protects Echo Base from orbital bombardment.' },
      { name: 'Wampa Ice Cave', type: 'cave', lat: 34, lon: -12, notes: 'Do not go in alone.' },
      { name: 'Imperial Landing Zone', type: 'imperial', lat: 25, lon: -36, notes: 'Where the AT-AT walkers came ashore.' },
    ],
  },
  {
    id: 'endor', name: 'Endor (Forest Moon)', region: 'Outer Rim', typeId: 'forest', diameter: 4900,
    description: 'A forest moon of towering trees, home to the Ewoks. The second Death Star\'s shield generator was hidden here.',
    params: { seaLevel: 0.28 },
    locations: [
      { name: 'Bright Tree Village', type: 'town', lat: 10, lon: 10, notes: 'Ewok village high in the trees.' },
      { name: 'Shield Generator Bunker', type: 'imperial', lat: 14, lon: 18, notes: 'Back door is the way in.' },
      { name: 'Imperial Landing Platform', type: 'spaceport', lat: 15.5, lon: 22, notes: 'Shuttle pad near the bunker.' },
    ],
  },
  {
    id: 'dagobah', name: 'Dagobah', region: 'Outer Rim', typeId: 'swamp', diameter: 8900,
    description: 'A misty swamp world teeming with life and strong in the Force. Yoda hid here in exile.',
    locations: [
      { name: 'Yoda\'s Hut', type: 'poi', lat: -5, lon: 30, notes: 'Small mud hut. Rootleaf stew on the stove.' },
      { name: 'Cave of Evil', type: 'cave', lat: -2.5, lon: 34, notes: 'A place strong with the dark side.' },
      { name: 'X-wing Landing Site', type: 'wreck', lat: -6.5, lon: 27, notes: 'Sunk in the bog.' },
    ],
  },
  {
    id: 'bespin', name: 'Bespin', region: 'Outer Rim', typeId: 'gas', diameter: 118000,
    description: 'A gas giant whose atmosphere holds valuable tibanna gas. Floating cities drift in the habitable cloud layer.',
    locations: [
      { name: 'Cloud City', type: 'city', lat: 10, lon: 0, notes: 'Floating mining colony and luxury resort.' },
    ],
  },
  {
    id: 'mustafar', name: 'Mustafar', region: 'Outer Rim', typeId: 'volcanic', diameter: 4200,
    description: 'A small, fiery world of lava rivers and black rock, mined for rare minerals.',
    locations: [
      { name: 'Fortress Vader', type: 'palace', lat: -10, lon: 20, notes: 'Darth Vader\'s castle, built over a lava falls.' },
      { name: 'Klegger Corp Mining Facility', type: 'industry', lat: 12, lon: 52, notes: 'Separatist hideout and site of a famous duel.' },
    ],
  },
  {
    id: 'kashyyyk', name: 'Kashyyyk', region: 'Mid Rim', typeId: 'giant_forest', diameter: 12765,
    description: 'Homeworld of the Wookiees, covered by wroshyr trees so tall the forest floor is a world of its own.',
    locations: [
      { name: 'Kachirho', type: 'city', lat: 4, lon: 30, notes: 'Wookiee tree city on a lagoon coast.' },
      { name: 'Origin Tree', type: 'landmark', lat: 16, lon: 60, notes: 'Ancient tree sacred to the Wookiees.' },
      { name: 'Shadowlands', type: 'landmark', lat: -10, lon: 42, notes: 'The dark lower levels of the forest. Dangerous.' },
    ],
  },
  {
    id: 'kamino', name: 'Kamino', region: 'Wild Space', typeId: 'ocean', diameter: 19720,
    description: 'A storm-wracked ocean world beyond the Outer Rim, famous for its cloners.',
    params: { seaLevel: 0.995, clouds: 0.8 },
    locations: [
      { name: 'Tipoca City', type: 'city', lat: -10, lon: 10, water: true, notes: 'Cloning facility on stilts above the sea.' },
    ],
  },
  {
    id: 'geonosis', name: 'Geonosis', region: 'Outer Rim', typeId: 'canyon', diameter: 11370,
    description: 'A rocky red world of mesas and hive spires, home to insectoid Geonosians and their droid foundries.',
    locations: [
      { name: 'Petranaki Arena', type: 'landmark', lat: 5, lon: 10, notes: 'Execution arena where the Clone Wars began.' },
      { name: 'Droid Foundry', type: 'industry', lat: 8, lon: 20, notes: 'Automated battle droid factory.' },
      { name: 'Stalgasin Hive', type: 'city', lat: 1, lon: 15, notes: 'Geonosian hive colony.' },
    ],
  },
  {
    id: 'yavin4', name: 'Yavin 4', region: 'Outer Rim', typeId: 'jungle', diameter: 10200,
    description: 'A jungle moon orbiting the gas giant Yavin, dotted with ancient Massassi temples.',
    locations: [
      { name: 'Great Temple', type: 'rebel', lat: 12, lon: 20, notes: 'Massassi temple used as the Rebel base.' },
      { name: 'Massassi Ruins', type: 'temple', lat: 18, lon: 35, notes: 'Overgrown temples.' },
    ],
  },
  {
    id: 'alderaan', name: 'Alderaan', region: 'Core Worlds', typeId: 'temperate', diameter: 12500,
    description: 'A peaceful world of grassy plains and snowy mountains, known for art and culture. Destroyed by the first Death Star.',
    params: { seaLevel: 0.28, mountains: 0.75 },
    locations: [
      { name: 'Aldera', type: 'capital', lat: 25, lon: 30, notes: 'Capital city.' },
      { name: 'Royal Palace', type: 'palace', lat: 25.6, lon: 31, notes: 'Seat of House Organa.' },
    ],
  },
  {
    id: 'jakku', name: 'Jakku', region: 'Inner Rim', typeId: 'desert', diameter: 6400,
    description: 'A backwater desert littered with wrecked starships from a final great battle of the Galactic Civil War.',
    params: { seaLevel: 0, mountains: 0.3 },
    locations: [
      { name: 'Niima Outpost', type: 'outpost', lat: 10, lon: 20, notes: 'Junk trading post. Portions for salvage.' },
      { name: 'Starship Graveyard', type: 'wreck', lat: 5, lon: 35, notes: 'Fields of downed Star Destroyers.' },
      { name: 'Tuanul', type: 'town', lat: 14, lon: 9, notes: 'Small village of believers.' },
    ],
  },
  {
    id: 'scarif', name: 'Scarif', region: 'Outer Rim', typeId: 'archipelago', diameter: 11000,
    description: 'A tropical world of island chains and lagoons, home to a secret Imperial data vault behind a planetary shield.',
    locations: [
      { name: 'Citadel Tower', type: 'imperial', lat: -15, lon: 20, notes: 'Imperial archive vault.' },
      { name: 'Landing Pad Nine', type: 'spaceport', lat: -14, lon: 23, notes: 'Shuttle pad near the citadel.' },
    ],
  },
  {
    id: 'lothal', name: 'Lothal', region: 'Outer Rim', typeId: 'plains', diameter: 7000,
    description: 'A grassland world of rock spires and farmland, heavily industrialized by the Empire.',
    locations: [
      { name: 'Lothal City', type: 'capital', lat: 15, lon: 0, notes: 'Capital and Imperial factory hub.' },
      { name: 'Tarkintown', type: 'town', lat: 12, lon: 10, notes: 'Shantytown of displaced farmers.' },
      { name: 'Jedi Temple', type: 'temple', lat: 30, lon: 30, notes: 'Ancient temple hidden among rock spires.' },
      { name: 'Communications Tower', type: 'outpost', lat: 17, lon: 5, notes: 'Abandoned tower used as a hideout.' },
    ],
  },
  {
    id: 'mandalore', name: 'Mandalore', region: 'Outer Rim', typeId: 'desert', diameter: 9200,
    description: 'Homeworld of the Mandalorians. Once home to domed cities, later scorched to glass by the Empire.',
    params: { craters: 0.35, temperature: 0.3, seaLevel: 0.02 },
    locations: [
      { name: 'Sundari', type: 'capital', lat: 10, lon: 20, notes: 'Domed capital city.' },
      { name: 'Living Waters', type: 'landmark', lat: 11, lon: 23, notes: 'Sacred waters beneath the old capital.' },
    ],
  },
  {
    id: 'corellia', name: 'Corellia', region: 'Core Worlds', typeId: 'temperate', diameter: 11000,
    description: 'An industrial Core world famous for shipyards, smugglers and pilots.',
    params: { seaLevel: 0.5 },
    locations: [
      { name: 'Coronet City', type: 'capital', lat: 15, lon: 20, notes: 'Capital and shipbuilding center.' },
      { name: 'Corellian Shipyards', type: 'industry', lat: 18, lon: 26, notes: 'Where freighters are born.' },
    ],
  },
  {
    id: 'dantooine', name: 'Dantooine', region: 'Outer Rim', typeId: 'plains', diameter: 9830,
    description: 'A quiet world of grassy plains, once the site of a Rebel base.',
    params: { seaLevel: 0.2, moisture: 0.1 },
    locations: [
      { name: 'Abandoned Rebel Base', type: 'rebel', lat: 20, lon: 0, notes: 'Empty by the time the Empire looked.' },
    ],
  },
  {
    id: 'felucia', name: 'Felucia', region: 'Outer Rim', typeId: 'fungal', diameter: 9100,
    description: 'A humid world of giant, brightly colored fungi and strange wildlife.',
    locations: [],
  },
  {
    id: 'utapau', name: 'Utapau', region: 'Outer Rim', typeId: 'canyon', diameter: 12900,
    description: 'A windswept world riddled with enormous sinkholes where cities cling to the walls.',
    params: { temperature: 0.2, moisture: -0.2, craters: 0.7 },
    locations: [
      { name: 'Pau City', type: 'city', lat: 0, lon: 20, notes: 'Built into the walls of a giant sinkhole.' },
    ],
  },
  {
    id: 'moncala', name: 'Mon Cala', region: 'Outer Rim', typeId: 'ocean', diameter: 11030,
    description: 'An ocean world of underwater and floating cities, home to the Mon Calamari and Quarren.',
    locations: [],
  },
  {
    id: 'ilum', name: 'Ilum', region: 'Unknown Regions', typeId: 'ice', diameter: 6600,
    description: 'A frozen world whose caves held kyber crystals for Jedi lightsabers. Later hollowed out into Starkiller Base.',
    params: { mountains: 0.85, seaLevel: 0.1 },
    locations: [
      { name: 'Jedi Temple', type: 'temple', lat: 40, lon: 20, notes: 'Crystal caves where younglings found their kyber.' },
    ],
  },
  {
    id: 'crait', name: 'Crait', region: 'Outer Rim', typeId: 'salt', diameter: 6900,
    description: 'A small mineral world with a white salt crust over red soil.',
    locations: [
      { name: 'Old Rebel Outpost', type: 'rebel', lat: 5, lon: 10, notes: 'Mine turned base, with a very large door.' },
    ],
  },
  {
    id: 'exegol', name: 'Exegol', region: 'Unknown Regions', typeId: 'dark', diameter: 9000,
    description: 'A hidden, storm-lashed world in the Unknown Regions. Lair of the Sith Eternal.',
    params: { clouds: 0.75, moisture: -0.6 },
    locations: [
      { name: 'Sith Citadel', type: 'temple', lat: 0, lon: 0, notes: 'The throne of the Sith.' },
    ],
  },
  {
    id: 'takodana', name: 'Takodana', region: 'Mid Rim', typeId: 'forest', diameter: 8500,
    description: 'A lush world of forests and lakes, neutral ground for smugglers.',
    params: { seaLevel: 0.45 },
    locations: [
      { name: 'Maz Kanata\'s Castle', type: 'cantina', lat: 20, lon: 30, notes: 'A lakeside pirate haven for a thousand years.' },
    ],
  },
  {
    id: 'ahchto', name: 'Ahch-To', region: 'Unknown Regions', typeId: 'archipelago', diameter: 8300,
    description: 'A remote ocean world of rocky green islands, site of the first Jedi Temple.',
    params: { temperature: -0.7, seaLevel: 0.9, clouds: 0.55 },
    locations: [
      { name: 'Temple Island', type: 'temple', lat: 15, lon: 40, notes: 'Ancient Jedi temple and the Mirror Cave.' },
    ],
  },
  {
    id: 'batuu', name: 'Batuu', region: 'Outer Rim', typeId: 'forest', diameter: 9000,
    description: 'A forested frontier world at the edge of Wild Space, known for its petrified tree spires.',
    params: { mountains: 0.65 },
    locations: [
      { name: 'Black Spire Outpost', type: 'outpost', lat: 10, lon: 10, notes: 'Last stop before Wild Space.' },
    ],
  },
  {
    id: 'nevarro', name: 'Nevarro', region: 'Outer Rim', typeId: 'volcanic', diameter: 9000,
    description: 'A volcanic world of lava rivers and dusty plains, once a hub for bounty hunters.',
    params: { seaLevel: 0.08, temperature: 0.4, moisture: -0.3 },
    locations: [
      { name: 'Nevarro City', type: 'city', lat: 5, lon: 15, notes: 'Home of the Bounty Hunters\' Guild office.' },
    ],
  },
  {
    id: 'kessel', name: 'Kessel', region: 'Outer Rim', typeId: 'barren', diameter: 7200,
    description: 'A bleak mining world where prisoners and droids dig for spice.',
    params: { craters: 0.25, atmosphere: '#9fb4c8' },
    locations: [
      { name: 'Spice Mines', type: 'industry', lat: 0, lon: 30, notes: 'Brutal mines run by the Pyke Syndicate.' },
    ],
  },
  {
    id: 'ryloth', name: 'Ryloth', region: 'Outer Rim', typeId: 'canyon', diameter: 10600,
    description: 'Homeworld of the Twi\'leks: rocky deserts, canyons and mountain cities.',
    params: { temperature: 0.7 },
    locations: [
      { name: 'Lessu', type: 'city', lat: 10, lon: 20, notes: 'Capital city built on a rock spire.' },
    ],
  },
  {
    id: 'jedha', name: 'Jedha', region: 'Mid Rim', typeId: 'canyon', diameter: 6000,
    description: 'A cold desert moon and holy site of pilgrimage for believers in the Force.',
    params: { temperature: -0.6, iceCaps: 0.6 },
    locations: [
      { name: 'Jedha City', type: 'city', lat: 20, lon: 10, notes: 'Holy City, occupied by the Empire.' },
      { name: 'Temple of the Kyber', type: 'temple', lat: 20.6, lon: 10.8, notes: 'Ancient temple guarded by the Guardians of the Whills.' },
    ],
  },
  {
    id: 'dathomir', name: 'Dathomir', region: 'Outer Rim', typeId: 'dark', diameter: 10480,
    description: 'A blood-red world of dark forests and fog, home to the Nightsisters.',
    params: { moisture: 0.4 },
    locations: [
      { name: 'Nightsister Fortress', type: 'temple', lat: 15, lon: 30, notes: 'Lair of the witches.' },
    ],
  },
  {
    id: 'mimban', name: 'Mimban', region: 'Mid Rim', typeId: 'swamp', diameter: 9000,
    description: 'A muddy, rain-soaked world mined for hyperfuel, scene of a grim Imperial campaign.',
    params: { temperature: 0.2, moisture: 1 },
    locations: [
      { name: 'Imperial Front Line', type: 'imperial', lat: 0, lon: 30, notes: 'Trenches and mud.' },
    ],
  },
  {
    id: 'kijimi', name: 'Kijimi', region: 'Mid Rim', typeId: 'ice', diameter: 8000,
    description: 'A cold mountainous world whose capital is a haven for thieves.',
    params: { temperature: -0.6, mountains: 0.9, seaLevel: 0.15 },
    locations: [
      { name: 'Kijimi City', type: 'city', lat: 30, lon: 10, notes: 'Snowy mountain city of thieves and spice runners.' },
    ],
  },
  {
    id: 'cantonica', name: 'Cantonica', region: 'Outer Rim', typeId: 'temperate', diameter: 8800,
    description: 'A dry world made rich by its casino city on the shore of an artificial sea.',
    params: { temperature: 0.8, moisture: -0.8, seaLevel: 0.15 },
    locations: [
      { name: 'Canto Bight', type: 'city', lat: 15, lon: 30, notes: 'Casino city for the galaxy\'s wealthiest.' },
    ],
  },
  {
    id: 'christophsis', name: 'Christophsis', region: 'Outer Rim', typeId: 'crystal', diameter: 9400,
    description: 'A world of towering crystal formations and crystalline cities.',
    params: { temperature: 0.1 },
    locations: [],
  },
  {
    id: 'moraband', name: 'Moraband', region: 'Outer Rim', typeId: 'dark', diameter: 9000,
    description: 'Ancient homeworld of the Sith: a red, dead world of tombs. Also called Korriban.',
    params: { moisture: -0.8, temperature: 0.5 },
    locations: [
      { name: 'Valley of the Dark Lords', type: 'temple', lat: 10, lon: 20, notes: 'Tombs of ancient Sith lords.' },
    ],
  },
  {
    id: 'sullust', name: 'Sullust', region: 'Outer Rim', typeId: 'volcanic', diameter: 12780,
    description: 'A volcanic world whose people live in cities beneath the surface.',
    params: { seaLevel: 0.15, mountains: 0.9 },
    locations: [],
  },
  {
    id: 'dqar', name: 'D\'Qar', region: 'Outer Rim', typeId: 'jungle', diameter: 9000,
    description: 'A remote jungle world that hid the Resistance base.',
    params: { seaLevel: 0.35 },
    locations: [
      { name: 'Resistance Base', type: 'rebel', lat: 5, lon: 15, notes: 'Hidden in the hills.' },
    ],
  },
  {
    id: 'atollon', name: 'Atollon', region: 'Outer Rim', typeId: 'barren', diameter: 8000,
    description: 'A dusty, rocky world that hid a Rebel cell\'s base. Watch out for krykna.',
    params: { craters: 0.3, mountains: 0.45, atmosphere: '#e8c8a0' },
    locations: [
      { name: 'Chopper Base', type: 'rebel', lat: 10, lon: 30, notes: 'Phoenix Squadron\'s hideout.' },
    ],
  },
  {
    id: 'tython', name: 'Tython', region: 'Deep Core', typeId: 'temperate', diameter: 10000,
    description: 'An ancient, mountainous world deep in the Core, tied to the earliest Jedi.',
    params: { mountains: 0.7, seaLevel: 0.35, temperature: -0.1 },
    locations: [
      { name: 'Ancient Jedi Temple', type: 'temple', lat: 30, lon: 20, notes: 'Ruined temple with a seeing stone.' },
    ],
  },
  {
    id: 'malachor', name: 'Malachor', region: 'Outer Rim', typeId: 'dark', diameter: 8000,
    description: 'A forbidden world scarred by an ancient battle, with a Sith temple at its heart.',
    params: { temperature: -0.2, moisture: -0.8, craters: 0.3 },
    locations: [
      { name: 'Sith Temple', type: 'temple', lat: -10, lon: 20, notes: 'A battle station disguised as a temple.' },
    ],
  },
  {
    id: 'rodia', name: 'Rodia', region: 'Mid Rim', typeId: 'jungle', diameter: 7549,
    description: 'A humid jungle and swamp world, homeworld of the Rodians.',
    params: { seaLevel: 0.5, moisture: 0.9 },
    locations: [],
  },
  {
    id: 'hosnianprime', name: 'Hosnian Prime', region: 'Core Worlds', typeId: 'ecumenopolis', diameter: 12000,
    description: 'A city-world that served as capital of the New Republic until it was destroyed.',
    params: { temperature: 0.3, iceCaps: 0.2, seaLevel: 0.08 },
    locations: [
      { name: 'Republic Senate', type: 'capital', lat: 10, lon: 0, notes: 'New Republic seat of government.' },
    ],
  },
  {
    id: 'mygeeto', name: 'Mygeeto', region: 'Outer Rim', typeId: 'crystal', diameter: 10088,
    description: 'A frozen crystalline world and banking stronghold.',
    params: { temperature: -0.8 },
    locations: [],
  },
  {
    id: 'ordmantell', name: 'Ord Mantell', region: 'Mid Rim', typeId: 'temperate', diameter: 14050,
    description: 'A rough Mid Rim world known for scrapyards, gambling and bounty hunters.',
    params: { seaLevel: 0.6, temperature: -0.1 },
    locations: [],
  },
  {
    id: 'kuat', name: 'Kuat', region: 'Core Worlds', typeId: 'temperate', diameter: 10000,
    description: 'Wealthy Core world ringed by the orbital shipyards that build Star Destroyers.',
    params: { seaLevel: 0.4 },
    locations: [],
  },
];

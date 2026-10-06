// Planets of Hutt Space.
//
// Bootana Hutta comes from your campaign notes (Hutta_DND.pdf): your
// descriptions win over canon where they differ, and campaign spoilers live in
// gmNotes or secret places so Player view hides them. Map positions follow the
// sector map in those notes (see starMaps.js).

import { onSlot, onBootana, resolvePlacements } from './huttSpacePlacement.js';
import { HUTT_SPACE_RESEARCH } from './huttSpaceResearch.js';

const NOTES = 'Your campaign notes (Hutta_DND.pdf)';

export const BOOTANA_HUTTA_PLANETS = [
  {
    id: 'sakiya', name: 'Sakiya (Saki Prime)', region: 'Hutt Space', sector: 'Bootana Hutta', typeId: 'belt', diameter: 16000,
    origin: `${NOTES}; Wookieepedia (Legends)`,
    map: onBootana('saki'),
    description: 'Homeworld of the Sakiyans and the storehouse for the graxitium mines of its sister worlds. A massive planet, 99 percent ice, with one strip of heat along the equator. The Sakiyans resisted the Hutt invasion.',
    gmNotes: 'Your campaign makes Saki a frozen belt world; published sources say little about its climate. The equatorial heat strip is either magical or technological; the floating capital follows it. Graxitium is mined everywhere else on the planet by a substantial slave population. If the party frees the slaves and takes the floating capital, they control the money behind Sakifwanna.',
    locations: [
      { name: 'Kæhaxa', type: 'capital', lat: 1, lon: 30, water: true, notes: 'Capital city, floating in the sky on repulsorlifts and following the warm equatorial strip.', gmNotes: 'Pronounced Kai-axe-uh. Inspired by Amulet.' },
      { name: 'First Stopping Isle', type: 'temple', lat: -2, lon: 60, notes: 'One of two islands where Kæhaxa stops on its circuit, for religious reasons.', gmNotes: 'Possibly propaganda, Snowpiercer style. The stops could happen once a year.' },
      { name: 'Second Stopping Isle', type: 'temple', lat: 3, lon: 150, notes: 'The other island where the floating capital stops.' },
      { name: 'Graxitium Mines', type: 'industry', lat: 35, lon: 40, notes: 'Mines that dig graxitium out of the ice.', gmNotes: 'Worked by Sakiyan slaves.' },
    ],
  },
  {
    id: 'sakidopa', name: 'Sakidopa (Saki Major)', region: 'Hutt Space', sector: 'Bootana Hutta', typeId: 'desert', diameter: 11000,
    origin: NOTES,
    params: { seaLevel: 0.02, craters: 0.5, temperature: 0.3 },
    map: onSlot(20),
    description: '"Dopa" means "two" in Huttese. Settled to feed Saki\'s repulsorlift industry, it was mined for graxitium until little but desert remained.',
    gmNotes: 'Also called Sakidos. Sakiyan scientists enrich graxitium with a secret process at a facility near the Godsheart. Travel between Sakidopa and Sakiya is heavily guarded.',
    locations: [
      { name: 'New DunDee', type: 'city', lat: 12, lon: 25, notes: 'The main settlement of Sakidopa.' },
      { name: 'Over-mined Wastes', type: 'landmark', lat: -15, lon: 60, notes: 'Strip-mined desert, pocked with old graxitium pits.' },
    ],
  },
  {
    id: 'sakiduba', name: 'Sakiduba (Saki Minor)', region: 'Hutt Space', sector: 'Bootana Hutta', typeId: 'ice', diameter: 9000,
    origin: NOTES,
    params: { temperature: -1, seaLevel: 0.25, mountains: 0.7 },
    map: onSlot(21),
    description: '"Duba" means "three" in Huttese. A bitter ice planet, settled to grow the graxitium mining that began on Sakiya. Nearly all of it is deadly, untamed wilderness.',
    gmNotes: 'Also called Sakitres. Officially 99.9 percent untreatable wilderness to the Sakifwanna royal family; unofficially the most contested landmass under the Godsheart. Failed invasion tactics include magically induced sickness through Sakiyan DNA, bounties for "pacifying" beasts and hostile Sakiyans, and encouraged settlement to gather information (this backfires).',
    locations: [
      { name: 'The End', type: 'town', lat: 82, lon: 20, notes: 'A rundown mining town at the pole. Only one building still stands above ground.' },
      { name: '5 Log Haberdashery and Healing Sauna', type: 'cantina', lat: 82.4, lon: 23, notes: 'The only building you can see in the endless blizzard.' },
    ],
  },
  {
    id: 'sakifwanna', name: 'Sakifwanna', region: 'Hutt Space', sector: 'Bootana Hutta', typeId: 'plains', diameter: 12000,
    origin: `${NOTES}; Wookieepedia (Legends), via search summaries`,
    params: { temperature: -0.2, moisture: -0.35, seaLevel: 0.48 },
    map: onBootana('sakifwanna'),
    description: '"Fwanna" means "four" in Huttese: the Fourth Saki, a Sakiyan colony on the Elgit-M\'Hanna Corridor with hyperlanes to Cyax and Saki. Saki\'s ore is shipped here to be refined into repulsorlift circuitry. Its coastal capital, Sak, is run by seven crime bosses; beyond the city lie wastelands full of wild beasts.',
    gmNotes: 'Sakifwanna lies on the same hyperlane as the Godsheart Pulsar. Odger Rune (rebel second in command) runs a bounty hunting guild that fronts for smuggling Saki rebels on the Langoona hyperlane. The 7 Bosses of Sak: Whispers, Spice, Beasts, Slavery, Commerce, Trade, Firearms (Lord 7th). Bjorn leads the planned heist on the royal vault. The mainland beyond Sak is Mad Max meets the Dothraki, with a rival city built from Sak\'s waste.',
    locations: [
      { name: 'Sak', type: 'capital', lat: 10, lon: 20, notes: 'The coastal capital, a city of shanty plazas, shops and seven crime bosses.' },
      { name: 'Royal Palace and Vault', type: 'palace', lat: 10.8, lon: 21.4, notes: 'Seat of the royal family and its treasury.', gmNotes: 'Target of Bjorn\'s heist. The rebels need the money.' },
      { name: 'Coronation Isle', type: 'landmark', lat: 8.5, lon: 23.5, water: true, notes: 'The center island where the Queen is crowned, reached by boats and repulsorlift ships.', gmNotes: 'The tiara is stolen during the coronation; it holds the location of the Godsheart graxitium facility.' },
      { name: 'Marked for Death', type: 'cantina', lat: 9.4, lon: 19.2, notes: 'A half-empty bar on a shanty-town plaza.', gmNotes: 'Lord 7th drinks in the corner. Setting for the desperado story.' },
      { name: 'Swords and Stuff', type: 'cantina', lat: 9.2, lon: 19.8, notes: 'The best sword shop in the city, if you can find it. Only those not looking for it do.', gmNotes: 'Blind swordmaster with a pet that stops rash acts. Nothing good comes easy: pay for a special sword with something other than money (d2 flips and limb wagers, or your own life).' },
      { name: 'Butcher', type: 'cantina', lat: 9.6, lon: 18.8, notes: 'An unnamed butcher that smells of dead alien beasts.' },
      { name: 'Manikins, Manikins, Manikins', type: 'cantina', lat: 10.5, lon: 19, notes: 'Sells appendages from actual people.' },
      { name: 'Blacksmith', type: 'industry', lat: 10.3, lon: 18.4, notes: 'A blacksmith, of course.' },
      { name: 'Monsters R Us', type: 'cantina', lat: 11, lon: 19.5, notes: 'Monsters in crates that would very clearly kill you.' },
      { name: 'Lord 7th\'s Hideout', type: 'poi', lat: 9.3, lon: 19.5, secret: true, notes: 'An underground base next to the bar.', gmNotes: 'Lord 7th (Breck), Boss of Firearms. His crew: the translator (his husband), Lova the Wookiee, and a Steve Buscemi type who plays the seven-string Hallikset.' },
    ],
  },
  {
    id: 'bootanashagplan', name: 'Bootana Shagplan', region: 'Hutt Space', sector: 'Bootana Hutta', typeId: 'archipelago', diameter: 10000,
    origin: `${NOTES}; Wookieepedia (canon and Legends)`,
    params: { temperature: 0.3 },
    map: onSlot(15),
    description: 'An island world that hosts the region\'s most exclusive slave market, where the most expensive slaves are sold. It is also a clearinghouse for luxury goods bound for the Hutt throneworlds, with hyperlanes to Elgit and Langoona.',
    locations: [
      { name: 'Slave Market', type: 'cantina', lat: 8, lon: 15, notes: 'Where the region\'s most expensive and sought-after slaves are sold.' },
    ],
  },
  {
    id: 'kortrinivii', name: 'Kor Trinivii', region: 'Hutt Space', sector: 'Bootana Hutta', typeId: 'swamp', diameter: 10000,
    origin: `${NOTES}; Wookieepedia (Legends)`,
    params: { moisture: 0.5, temperature: 0.4 },
    map: onSlot(19),
    description: 'Throneworld of the Trinivii kajidic, one of the great Hutt clans.',
    locations: [
      { name: 'Trinivii Throne Palace', type: 'palace', lat: 15, lon: 10, notes: 'Seat of the Trinivii kajidic.' },
    ],
  },
  {
    id: 'mulatan', name: 'Mulatan', region: 'Hutt Space', sector: 'Bootana Hutta', typeId: 'canyon', diameter: 10000,
    origin: `${NOTES}; Wookieepedia (Legends)`,
    params: { temperature: 0.2 },
    map: onBootana('mulatan'),
    description: 'Gateway and guardian world of the Bootana Hutta. Dedicated to defending the Garden of the Hutts, it is one of the few places where Hutt warships are commonly seen.',
    gmNotes: 'Source of mysterious technologies that resisted Yuuzhan Vong terraforming. Basically the Area 51 of Hutt Space.',
    locations: [
      { name: 'Hutt War Fleet Anchorage', type: 'spaceport', lat: 20, lon: 15, notes: 'Where the Hutt warships that guard the Bootana Hutta gather.' },
      { name: 'Restricted Zone', type: 'poi', lat: -10, lon: 50, secret: true, notes: 'A sealed research site.', gmNotes: 'The mysterious technology that resisted Yuuzhan Vong terraforming is studied here.' },
    ],
  },
  {
    id: 'pybus', name: 'Pybus', region: 'Hutt Space', sector: 'Bootana Hutta', typeId: 'jungle', diameter: 10000,
    origin: `${NOTES}; Wookieepedia (Legends)`,
    map: onSlot(10),
    description: 'A lush, unpopulated jungle world deep within the Bootana Hutta, covered with hundreds of ancient ruins. The Hutts consider it taboo, for reasons they will not share.',
    locations: [
      { name: 'Ancient Ruins', type: 'temple', lat: 5, lon: 30, notes: 'One of hundreds of ruins hidden in the jungle.' },
    ],
  },
  {
    id: 'groth', name: 'Groth', region: 'Hutt Space', sector: 'Bootana Hutta', typeId: 'temperate', diameter: 10000,
    origin: `${NOTES}; Wookieepedia (Legends, The Old Republic)`,
    map: onSlot(16),
    description: 'A former Hutt throneworld, later a resort famous for gladiatorial exhibitions and gambling.',
    gmNotes: 'During the Cold War of 3643 BBY an information broker on Groth sliced into the Sith Empire\'s military database.',
    locations: [
      { name: 'Gladiatorial Arena', type: 'landmark', lat: 18, lon: 20, notes: 'Fights staged for the resort\'s guests.' },
      { name: 'Gambling Resorts', type: 'cantina', lat: 20, lon: 24, notes: 'Casinos and luxury resorts.' },
    ],
  },
  {
    id: 'huloon', name: 'Huloon', region: 'Hutt Space', sector: 'Bootana Hutta', typeId: 'forest', diameter: 10000,
    origin: `${NOTES}; Wookieepedia (Legends)`,
    map: onSlot(13),
    description: 'Once home to the Huloon, a species enslaved by the Hutts. The Hutts emptied the planet and turned it into a nature preserve.',
    locations: [],
  },
  {
    id: 'varl', name: 'Varl', region: 'Hutt Space', sector: 'Bootana Hutta', typeId: 'barren', diameter: 10000,
    origin: `${NOTES}; Wookieepedia (Legends), via search summaries`,
    params: { craters: 0.35, mountains: 0.5, atmosphere: '#c9a27a' },
    map: onBootana('varl'),
    description: 'The world where the Hutts first arose, now a devastated wasteland on the Pabol Hutta, where it meets the Dead Road. Most likely also the homeworld of the Rybets, an amphibious race of shapeshifters.',
    gmNotes: 'The Rybet link comes from your campaign notes. Hutt pilgrims travel the Varl Circuit across its moons.',
    locations: [],
  },
  {
    id: 'goshutta', name: 'Gos Hutta', region: 'Hutt Space', sector: 'Bootana Hutta', typeId: 'canyon', diameter: 10000,
    origin: 'Wookieepedia (Legends); your campaign notes',
    map: onBootana('goshutta'),
    description: 'A heavily defended Hutt fortress world guarding the Pabol Hutta, the route from Nal Hutta into the Garden of the Hutts. Its system also holds three lush worlds that no record names.',
    gmNotes: 'Your notes also name a Gos Hutta hyperlane.',
    locations: [],
  },
  {
    id: 'langoona', name: 'Langoona', region: 'Hutt Space', sector: 'Bootana Hutta', typeId: 'temperate', diameter: 10000,
    origin: 'Wookieepedia (Legends), via search summaries; your campaign notes',
    map: onBootana('langoona'),
    description: 'An out-of-the-way world on the eastern edge of the Bootana Hutta, home of the Langoonans, a species the Hutts once favored as slaves.',
    gmNotes: 'Your notes name the Langoona hyperlane, used to smuggle Saki rebels to and from the Sakiyan collective.',
    locations: [],
  },
];

// Everything in Hutt Space, with star map positions worked out.
export const HUTT_SPACE_PLANETS = resolvePlacements([...BOOTANA_HUTTA_PLANETS, ...HUTT_SPACE_RESEARCH]);

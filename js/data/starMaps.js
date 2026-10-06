// Star maps: 2D charts used to find and open planets.
//
// A map has areas (sectors drawn as shaded outlines around their worlds),
// systems (uncharted star systems with no planet page yet), features (stars,
// pulsars and other landmarks) and lanes (hyperspace routes).
// Planets put themselves on a map with `map: { id, x, y }` in the planet data,
// and dragging one in the app only stores the new position for that planet.
//
// Lane paths can name planets, systems or features by id; those points follow
// the object if you move it. Plain [x, y] pairs stay fixed.

// ---------- The galactic grid ----------
// Hutt Space covers grid squares R to T and 9 to 14 (letters run west to east,
// numbers north to south). Each square is GRID map units wide.
const GRID = 450;
const COLUMNS = 'QRSTU';
const ORIGIN = { x: -600, y: -3900 }; // so square S-11 starts at (300, 600)
export const GRID_INFO = { size: GRID, origin: ORIGIN, columns: COLUMNS };

// Map position of a point inside grid square `square` (like "S-12").
// fx and fy (0 to 1) say where inside the square: 0.5, 0.5 is its center.
export function grid(square, fx = 0.5, fy = 0.5) {
  const m = /^([A-Z])-(\d+)$/.exec(String(square).trim().toUpperCase());
  if (!m || !COLUMNS.includes(m[1])) return null;
  const col = COLUMNS.indexOf(m[1]);
  const row = +m[2];
  return [Math.round(ORIGIN.x + (col + fx) * GRID), Math.round(ORIGIN.y + (row - 1 + fy) * GRID)];
}

// ---------- Bootana Hutta, traced from your campaign notes ----------
// The sector map in Hutta_DND.pdf is a 350 x 427 pixel crop. bh() converts its
// pixels to map units, scaled so it lands in squares S-10 and S-11.
const BH = { x: 300, y: 260, s: 1.6 };
export function bh(x, y) {
  return [Math.round(BH.x + x * BH.s), Math.round(BH.y + y * BH.s)];
}

// Dot positions on that image. Points past its edges (negative, or beyond
// 350 x 427) are worlds that sit just off your crop.
export const BOOTANA_POINTS = {
  1: [57, 22], 2: [43, 79], 3: [86, 85], 4: [79, 128], 5: [117.5, 98], 6: [88, 197], 7: [46, 265],
  8: [73, 333], 9: [100, 271], 10: [92, 385], 11: [104, 328], 12: [161, 260], 13: [186, 236], 14: [214, 222],
  15: [265, 200], 16: [190, 296], 17: [218, 273], 18: [218, 318], 19: [257, 292], 20: [228, 372], 21: [202, 388],
  mulatan: [135.5, 142.5], langoona: [231, 200], goshutta: [132, 293.5], saki: [194.3, 344.3], cyax: [269.3, 405.3],
  elgit: [344.4, 113.8], usk: [335, 297],
  // Off the crop, placed from the hyperlane links:
  sleheyron: [175, -50], korgorensla: [30, -40], korbareesh: [10, 160], korqunaalac: [20, 400], korvanderijar: [262, 252],
  saqqar: [342, 378], tisht: [347, 432], mhanna: [335, 488], sakifwanna: [300, 455], varl: [160, 485], godsheart: [300, 520],
};
export const bhPoint = (key) => bh(...BOOTANA_POINTS[key]);

// Which world sits on each numbered dot. Your map has no legend, so this was
// worked out by matching the hyperlane links Wookieepedia lists (from The
// Essential Atlas) against the lines on the map. For example, Kor Hestilic is
// the only world with five links, like dot 4, and Groth links to Kor Gejalli,
// which links to Kor Trinivii, like dots 16, 18 and 19. Dots 1-3 and 5-9 have
// fewer clues and could be swapped among themselves.
export const BOOTANA_SLOTS = {
  1: 'korutoradii', 2: 'narchunna', 3: 'korbesadii', 4: 'korhestilic', 5: 'kornijiladii', 6: 'korvosadii', 7: 'kornasirii',
  8: 'korhunamma', 9: 'korusilic', 10: 'pybus', 11: 'koroktanivii', 12: 'kordesilijic', 13: 'huloon', 14: 'koranjiliac',
  15: 'bootanashagplan', 16: 'groth', 17: 'korjiramma', 18: 'korgejalli', 19: 'kortrinivii', 20: 'sakidopa', 21: 'sakiduba',
};

const at = ([x, y]) => ({ x, y });

export const STAR_MAPS = [
  {
    id: 'hutt-space',
    name: 'Hutt Space',
    description: 'The Hutt-ruled region of the Mid and Outer Rim, laid out on the galactic grid (squares R-9 to T-14). Bootana Hutta follows the sector map in your campaign notes. Positions elsewhere are approximate: drag anything in Edit layout mode.',
    bounds: [-150, -300, 1200, 2400],
    gridLabels: { columns: ['R', 'S', 'T'], rows: [9, 10, 11, 12, 13, 14] },
    areas: [
      { id: 'bootana-hutta', name: 'Bootana Hutta', subtitle: 'Garden of the Hutts', color: '#5fd4e0', padding: 30, label: bh(30, 245), labelAngle: -0.36 },
      { id: 'siklaata', name: 'Si\'Klaata Cluster', color: '#ff9f43', padding: 34 },
      { id: 'ytoub', name: 'Y\'Toub system', subtitle: 'Nal Hutta', color: '#c8d65a', padding: 26 },
      { id: 'kor-gorensla', name: 'Kor Gorensla system', color: '#a98bff', padding: 22 },
      { id: 'cha-raaba', name: 'Cha Raaba system', subtitle: 'Ylesia', color: '#ff6fa8', padding: 24 },
      { id: 'unplaced', name: 'Location unknown', subtitle: 'Drag these where they belong', color: '#8a9bb8', padding: 30 },
    ],
    systems: [],
    features: [
      {
        id: 'godsheart',
        name: 'Godsheart Pulsar',
        kind: 'pulsar',
        ...at(bhPoint('godsheart')),
        notes: 'A pulsar that shines over the whole region. Locals measure distance by "this side of the Godsheart".',
        gmNotes: 'From your campaign notes. An unidentified Sakiyan facility orbits the pulsar: the Godsheart graxitium processing facility. The Queen\'s tiara holds its coordinates.',
      },
      { id: 'cyax', name: 'Cyax', kind: 'star', ...at(bhPoint('cyax')), notes: 'Star system of Da Soocha, linked to Sakifwanna by a short hyperlane.' },
      { id: 'oktos', name: 'Oktos Nebula', kind: 'nebula', ...at(grid('R-12', 0.45, 0.55)), notes: 'A nebula on the western edge of Hutt Space that hides Ganath.' },
      { id: 'cairns', name: 'The Cairns', kind: 'nebula', ...at(grid('T-10', 0.7, 0.85)), notes: 'A region on the eastern edge of Hutt Space; the Dead Road runs nearby.' },
    ],
    lanes: [
      {
        name: 'Pabol Hutta',
        style: 'major',
        notes: 'The main route through Hutt Space: from Nal Hutta through Varl, Gos Hutta and Mulatan to Sleheyron and on toward Topa, guarded by the fortress worlds of Mulatan and Gos Hutta.',
        path: [grid('S-9', 0.62, 0.15), 'sleheyron', bh(162, 40), 'mulatan', bh(126, 220), 'goshutta', bh(150, 400), 'varl', 'hosko', 'kiskua', 'nalhutta'],
      },
      {
        name: 'The Dead Road',
        style: 'major',
        notes: 'Also called the Pabol Puchukay. Runs from Nimia past Ulmatra, Elgit and Usk down to Varl. Your map shows it as "The Dead...".',
        path: ['nimia', 'kafane', 'ulmatra', 'zisia', 'elgit', bh(342, 200), 'usk', 'saqqar', 'tisht', 'mhanna', 'varl'],
      },
      { name: 'Pabol Sleheyron', style: 'major', notes: 'Crosses Hutt Space from the Si\'Klaata Cluster through Sleheyron toward Kessel.', path: ['kintan', 'sleheyron', 'ulmatra', grid('T-9', 0.9, 0.6)] },
      { name: '', style: 'minor', path: ['nimban', 'sleheyron'] },
      { name: 'Ootmian Pabol', style: 'major', notes: 'The Outlanders\' Route, from Nal Hutta past Keldooine (a shadowport on the edge of Hutt Space) toward Kwenn and the Core.', path: ['nalhutta', 'narhekka', 'duhutta', 'irith', 'narbosholla', grid('R-11', 0.2, 0.5), grid('R-11', -0.2, 0.5)] },
      { name: 'Pabol Kreeta', style: 'minor', path: ['narkreeta', 'narbosholla'] },
      { name: 'Shag Pabol', style: 'major', notes: 'The Slave Road: Nal Hutta to Ylesia and on toward Teth.', path: ['kiskua', 'rorak', 'diyu', 'ylesia', 'ziugen', grid('T-12', 0.95, 0.9)] },
      { name: 'Oktos Route', style: 'minor', path: ['nalhutta', 'kleeva', 'toydaria', 'tolamn'] },
      { name: 'Gamor Run', style: 'minor', path: ['rorak', 'circumtore'] },
      { name: 'Hollastin Run', style: 'minor', path: ['circumtore', 'affavan', 'hollastin', 'aylayl'] },
      { name: 'Pando Spur', style: 'minor', path: ['hollastin', 'xolu', 'farpando'] },
      { name: '', style: 'minor', path: ['narhaaska', 'saqqar'] },
      { name: '', style: 'minor', path: ['usk', 'moralan'] },
      { name: 'Elgit-M\'Hanna Corridor', style: 'minor', notes: 'Passes Sakifwanna, the "Fourth Saki".', path: ['elgit', bh(318, 300), 'sakifwanna', 'mhanna'] },
      { name: '', style: 'minor', path: ['elgit', 'bootanashagplan'] },
      // Bootana Hutta, as drawn on your map.
      { name: 'Langoona hyperlane', style: 'minor', notes: 'Smugglers run Saki rebels along this lane (your notes).', path: ['kordesilijic', 'huloon', 'koranjiliac', 'langoona', 'bootanashagplan'] },
      { name: 'Gos Hutta hyperlane', style: 'minor', notes: 'Links Gos Hutta to the Saki worlds (your notes).', path: ['goshutta', 'kordesilijic', 'groth', 'sakiya'] },
      { name: '', style: 'minor', path: ['groth', 'korgejalli', 'kortrinivii'] },
      { name: '', style: 'minor', path: ['huloon', 'korjiramma', 'korvanderijar'] },
      { name: '', style: 'minor', path: ['sakidopa', 'sakiya', 'sakiduba'] },
      { name: 'Godsheart lane', style: 'minor', notes: 'Sakifwanna shares this lane with the Godsheart Pulsar (your notes).', path: ['sakiya', 'sakifwanna', 'godsheart'] },
      { name: '', style: 'dashed', path: ['usk', 'cyax'] },
      { name: '', style: 'minor', path: ['cyax', 'sakifwanna'] },
      { name: '', style: 'minor', path: ['korutoradii', 'narchunna', 'korhestilic', 'mulatan'] },
      { name: '', style: 'minor', path: ['korbesadii', 'korhestilic', 'kornijiladii'] },
      { name: '', style: 'minor', path: ['korhestilic', 'korvosadii', 'kornasirii', 'korhunamma', 'korusilic', 'goshutta'] },
      { name: '', style: 'minor', path: ['pybus', 'koroktanivii', 'goshutta'] },
    ],
  },
];

export function getStarMap(id) {
  return STAR_MAPS.find((m) => m.id === id) || null;
}

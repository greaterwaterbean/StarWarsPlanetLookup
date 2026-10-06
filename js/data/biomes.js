// Every kind of terrain a cell can be. Planet types pick from this list.
//   water:  counts as liquid (coastlines are drawn where water meets land)
//   glow:   ignores shading, so lava and city lights stay bright on the dark side
//   vary:   how much each cell's brightness is randomly nudged (gives the mosaic look)

export const BIOMES = [
  // Liquids
  { id: 'deep_ocean', name: 'Deep Ocean', color: '#1b3766', water: true },
  { id: 'ocean', name: 'Ocean', color: '#234f8c', water: true },
  { id: 'shallows', name: 'Shallows', color: '#3576b0', water: true },
  { id: 'lagoon', name: 'Tropical Lagoon', color: '#36a3b0', water: true },
  { id: 'sea_ice', name: 'Sea Ice', color: '#c6dcec', water: true },
  { id: 'murky_water', name: 'Murky Water', color: '#34503a', water: true },
  { id: 'dark_sea', name: 'Black Sea', color: '#2a1018', water: true },
  { id: 'lava', name: 'Lava', color: '#ff6a1a', water: true, glow: true },
  { id: 'magma', name: 'Magma Sea', color: '#ffae3a', water: true, glow: true },

  // Temperate and wet land
  { id: 'beach', name: 'Beach', color: '#e2d196' },
  { id: 'grassland', name: 'Grassland', color: '#7aab4c' },
  { id: 'plains', name: 'Plains', color: '#9dbe5a' },
  { id: 'savanna', name: 'Savanna', color: '#b9b25a' },
  { id: 'scrub', name: 'Scrubland', color: '#a59d62' },
  { id: 'forest', name: 'Forest', color: '#3d7d38' },
  { id: 'dense_forest', name: 'Dense Forest', color: '#2a5f2e' },
  { id: 'conifer', name: 'Conifer Forest', color: '#3a6748' },
  { id: 'giant_forest', name: 'Giant Wroshyr Forest', color: '#2e5527', vary: 0.07 },
  { id: 'jungle', name: 'Jungle', color: '#2e8838' },
  { id: 'swamp', name: 'Swamp', color: '#4d683a' },
  { id: 'swamp_forest', name: 'Swamp Forest', color: '#37573a' },
  { id: 'bog', name: 'Bog', color: '#5a5838' },
  { id: 'marsh', name: 'Marsh', color: '#6b8a4b' },
  { id: 'highlands', name: 'Highlands', color: '#8b8d63' },

  // Dry land
  { id: 'dunes', name: 'Sand Dunes', color: '#e6c07a' },
  { id: 'desert', name: 'Desert Flats', color: '#d6a65e' },
  { id: 'red_sand', name: 'Red Sand', color: '#c46a3c' },
  { id: 'badlands', name: 'Badlands', color: '#b5743e' },
  { id: 'mesa', name: 'Mesa', color: '#a3552f' },
  { id: 'salt_flats', name: 'Salt Flats', color: '#ebe6da' },
  { id: 'red_soil', name: 'Red Mineral Soil', color: '#9c2f24' },

  // Cold
  { id: 'tundra', name: 'Tundra', color: '#8b9b7c' },
  { id: 'snow', name: 'Snow', color: '#eef3f7' },
  { id: 'glacier', name: 'Glacier', color: '#cde2f0' },
  { id: 'ice_field', name: 'Ice Field', color: '#b4d1e8' },
  { id: 'ice_rock', name: 'Frozen Rock', color: '#94a3b5' },
  { id: 'crystal', name: 'Crystal Formations', color: '#86defa', vary: 0.1 },
  { id: 'crystal_dark', name: 'Dark Crystal', color: '#5866a8', vary: 0.1 },

  // Mountains and barren
  { id: 'rock', name: 'Mountains', color: '#7b7168' },
  { id: 'snow_peaks', name: 'Snowy Peaks', color: '#e6ebf0' },
  { id: 'regolith', name: 'Regolith', color: '#8c8782' },
  { id: 'dust', name: 'Dust Plains', color: '#ada190' },
  { id: 'crater', name: 'Crater Floor', color: '#67625d' },

  // Volcanic and dark side
  { id: 'ash', name: 'Ash Plains', color: '#4c4549' },
  { id: 'basalt', name: 'Basalt', color: '#2f2b2e' },
  { id: 'obsidian', name: 'Obsidian', color: '#1f1a26' },
  { id: 'dark_rock', name: 'Dark Rock', color: '#3b2a31' },
  { id: 'blood_rock', name: 'Blood Rock', color: '#6d1c1c' },
  { id: 'wasteland', name: 'Wasteland', color: '#6b5a48' },

  // Exotic
  { id: 'fungal', name: 'Fungal Forest', color: '#b25ab0', vary: 0.08 },
  { id: 'fungal_alt', name: 'Giant Fungi', color: '#e09f32', vary: 0.08 },
  { id: 'fungal_grass', name: 'Lime Undergrowth', color: '#9bc93f' },

  // City (ecumenopolis)
  { id: 'city', name: 'City', color: '#8a8f9b', vary: 0.18 },
  { id: 'city_dense', name: 'Dense City', color: '#a9afba', vary: 0.18 },
  { id: 'city_spires', name: 'City Spires', color: '#d2d8e2', vary: 0.15 },
  { id: 'city_industrial', name: 'Industrial Zone', color: '#6c6660', vary: 0.2 },
  { id: 'city_polar', name: 'Polar City', color: '#c1cdd9', vary: 0.12 },

  // Gas giant bands
  { id: 'gas_1', name: 'Pale Band', color: '#f2dfb4' },
  { id: 'gas_2', name: 'Light Band', color: '#e1ba82' },
  { id: 'gas_3', name: 'Mid Band', color: '#c98c52' },
  { id: 'gas_4', name: 'Dark Band', color: '#a96b3b' },
  { id: 'gas_5', name: 'Deep Band', color: '#87512e' },
  { id: 'gas_storm', name: 'Storm', color: '#f6f1e2' },
];

export const BIOME_INDEX = new Map(BIOMES.map((b, i) => [b.id, i]));

export function biomeIndex(id) {
  return BIOME_INDEX.has(id) ? BIOME_INDEX.get(id) : -1;
}

export function hexToRgb(hex) {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
}

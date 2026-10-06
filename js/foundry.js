// Export for Foundry VTT (v12 to v14).
//
// Foundry scenes are flat, so the planet goes in as a flat (equirectangular)
// map image plus a Scene document whose map notes mark your places. The full
// planet data also rides along in the scene's flags, so a future Foundry module
// could rebuild the spinning globe from it.
//
// Import in Foundry: upload the image, create a Scene, right-click it, choose
// "Import Data" and pick the scene JSON. The README walks through it.

import { flatPosition } from './render/flatMap.js';
import { getLocationType } from './data/locationTypes.js';

export const FLAG_SCOPE = 'starwars-planet-lookup';

// Closest Foundry core note icon for each place type.
export const NOTE_ICONS = {
  capital: 'icons/svg/castle.svg',
  city: 'icons/svg/city.svg',
  town: 'icons/svg/village.svg',
  spaceport: 'icons/svg/anchor.svg',
  imperial: 'icons/svg/tower.svg',
  rebel: 'icons/svg/sword.svg',
  outpost: 'icons/svg/tower.svg',
  palace: 'icons/svg/castle.svg',
  temple: 'icons/svg/temple.svg',
  cantina: 'icons/svg/tankard.svg',
  landmark: 'icons/svg/mountain.svg',
  cave: 'icons/svg/cave.svg',
  wreck: 'icons/svg/skull.svg',
  industry: 'icons/svg/windmill.svg',
  poi: 'icons/svg/book.svg',
};

function escapeHTML(text) {
  return String(text ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

function paragraphs(text) {
  return String(text || '').split(/\n+/).filter(Boolean).map((p) => `<p>${escapeHTML(p)}</p>`).join('');
}

// Places that go into the export. Secret places are left out unless asked for,
// because Foundry shows unlinked map notes to every player.
export function exportedLocations(planet, includeSecret = false) {
  return planet.locations.filter((l) => includeSecret || !l.secret);
}

/**
 * Builds a Foundry Scene document (plain JSON) for the planet.
 * options: width, height (image size in px), imagePath (where you will upload the
 * image inside Foundry's data folder), includeSecret, planetData (full planet JSON for flags)
 */
export function foundryScene(planet, options) {
  const { width, height, imagePath, includeSecret = false } = options;
  // Distance across 100 px of map, at the equator.
  const kmPer100px = Math.round(((Math.PI * planet.diameter) / width) * 100);
  const iconSize = Math.max(32, Math.round(width / 90));
  const fontSize = Math.max(18, Math.round(width / 160));
  const notes = exportedLocations(planet, includeSecret).map((loc) => {
    const { x, y } = flatPosition(loc.lat, loc.lon, width, height);
    return {
      x: Math.round(x),
      y: Math.round(y),
      entryId: null,
      pageId: null,
      texture: { src: NOTE_ICONS[loc.type] || NOTE_ICONS.poi },
      iconSize,
      text: loc.name,
      fontSize,
      textAnchor: 1,
      textColor: '#ffffff',
      global: true,
      flags: { [FLAG_SCOPE]: { locationId: loc.id, type: getLocationType(loc.type).name, notes: loc.notes || '' } },
    };
  });
  return {
    name: planet.name,
    navigation: true,
    navName: planet.name,
    width,
    height,
    padding: 0,
    backgroundColor: '#04060d',
    background: { src: imagePath, offsetX: 0, offsetY: 0, scaleX: 1, scaleY: 1, rotation: 0 },
    grid: { type: 0, size: 100, distance: kmPer100px, units: 'km' },
    tokenVision: false,
    fog: { exploration: false },
    environment: { globalLight: { enabled: true } },
    initial: { x: Math.round(width / 2), y: Math.round(height / 2), scale: 0.5 },
    notes,
    tokens: [],
    drawings: [],
    lights: [],
    sounds: [],
    templates: [],
    tiles: [],
    walls: [],
    flags: {
      [FLAG_SCOPE]: {
        format: 'equirectangular',
        note: 'Longitude runs left to right (-180 to 180), latitude top to bottom (90 to -90). Distances are true only near the equator.',
        planet: options.planetData || null,
      },
    },
  };
}

/**
 * Builds a Foundry JournalEntry with an overview page and one page per place.
 * options: includeSecret, includeGmNotes, globeUrl (link to the interactive globe), embedGlobe
 */
export function foundryJournal(planet, options = {}) {
  const { includeSecret = false, includeGmNotes = false, globeUrl = '', embedGlobe = false } = options;
  const facts = [planet.region, planet.sector, `${Number(planet.diameter).toLocaleString('en-US')} km across`].filter(Boolean).join(' / ');
  let overview = `<p><strong>${escapeHTML(facts)}</strong></p>${paragraphs(planet.description)}`;
  if (globeUrl) {
    overview += `<p><a href="${escapeHTML(globeUrl)}">Open the interactive globe</a></p>`;
    if (embedGlobe) overview += `<p><iframe src="${escapeHTML(globeUrl)}" width="100%" height="600" style="border:0"></iframe></p>`;
  }
  if (includeGmNotes && planet.gmNotes) overview += `<h2>GM notes</h2>${paragraphs(planet.gmNotes)}`;

  const pages = [{ name: 'Overview', type: 'text', title: { show: true, level: 1 }, text: { content: overview, format: 1 }, sort: 0 }];
  exportedLocations(planet, includeSecret).forEach((loc, i) => {
    let content = `<p><em>${escapeHTML(getLocationType(loc.type).name)}</em></p>${paragraphs(loc.notes)}`;
    if (includeGmNotes && loc.gmNotes) content += `<h3>GM notes</h3>${paragraphs(loc.gmNotes)}`;
    pages.push({ name: loc.name, type: 'text', title: { show: true, level: 1 }, text: { content, format: 1 }, sort: (i + 1) * 100000 });
  });
  return { name: planet.name, pages, flags: { [FLAG_SCOPE]: { planetId: planet.id } } };
}

export function foundryReadme(planet, files, imagePath) {
  return `${planet.name}: Foundry VTT package (made for Foundry v12 to v14)

Files
  ${files.image}    flat map image (equirectangular, 2:1)
  ${files.scene}    Foundry Scene with map notes for each place
  ${files.journal}  Foundry Journal Entry: overview + one page per place
  ${files.planet}   the planet in Planet Lookup format (re-import it in the app)

1. Upload the map
   In Foundry, open any file picker (for example Configure Scene > Background
   image > browse), go to your User Data, create the folder
   "${imagePath.split('/').slice(0, -1).join('/')}" and upload ${files.image} into it.
   The scene expects the image at: ${imagePath}

2. Import the scene
   Scenes sidebar > Create Scene (any name) > right-click it > Import Data >
   choose ${files.scene} > Import. Open the scene. Your places are map notes.

3. Import the journal (optional)
   Journal sidebar > Create Journal Entry > right-click it > Import Data >
   choose ${files.journal}.

Notes
  - Map notes in Foundry are visible to everyone. Secret places are only included
    if you ticked "Include secret places" when exporting.
  - The grid is gridless; the ruler measures km correctly near the equator only,
    because a flat map stretches the poles.
  - The full planet data is stored in the scene flags under "${FLAG_SCOPE}",
    ready for a future Foundry module that shows the spinning globe.
`;
}

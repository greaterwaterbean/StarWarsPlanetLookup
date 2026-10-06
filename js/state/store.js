// Saving and loading.
//
// Everything lives in the browser's localStorage under one key. Canon planets
// are not saved until you change them; until then they come straight from
// canonPlanets.js. localStorage can be wiped (clearing site data, private
// windows), so the Data tab offers export/import of plain JSON files too.

import { CANON_PLANETS } from '../data/canonPlanets.js';
import { DEFAULT_CELLS } from '../core/generator.js';
import { randomSeed } from '../core/rng.js';

export const STORAGE_KEY = 'swpl:v1';
export const SCHEMA_VERSION = 1;
export const APP_ID = 'starwars-planet-lookup';

export function makeId(prefix) {
  return `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

export function emptyEdits() {
  return { h: {}, b: {}, r: {} };
}

// A fresh copy of a canon planet, ready to edit.
export function canonDefault(id) {
  const src = CANON_PLANETS.find((p) => p.id === id);
  if (!src) return null;
  return {
    id: src.id,
    name: src.name,
    region: src.region,
    typeId: src.typeId,
    diameter: src.diameter,
    sector: src.sector || '',
    origin: src.origin || '',
    description: src.description || '',
    gmNotes: src.gmNotes || '',
    seed: src.id,
    cells: DEFAULT_CELLS,
    params: { ...(src.params || {}) },
    map: src.map ? { ...src.map } : null,
    edits: emptyEdits(),
    regions: [],
    locations: (src.locations || []).map((l, i) => ({
      id: `${src.id}-loc${i}`,
      name: l.name,
      type: l.type,
      lat: l.lat,
      lon: l.lon,
      notes: l.notes || '',
      gmNotes: l.gmNotes || '',
      secret: !!l.secret,
      water: !!l.water,
      snap: !l.water,
    })),
    canon: true,
  };
}

export function newPlanet({ name, typeId, seed, region, sector, map }) {
  return {
    id: makeId('planet'),
    name: name || 'New Planet',
    region: region || 'Homebrew',
    sector: sector || '',
    origin: '',
    map: map || null,
    typeId: typeId || 'temperate',
    diameter: 10000,
    description: '',
    gmNotes: '',
    seed: seed ?? randomSeed(),
    cells: DEFAULT_CELLS,
    params: {},
    edits: emptyEdits(),
    regions: [],
    locations: [],
    canon: false,
  };
}

// Fill in anything missing (older exports, hand-edited JSON).
export function normalizePlanet(p) {
  const planet = { ...p };
  planet.id = String(planet.id || makeId('planet'));
  planet.name = String(planet.name || 'Unnamed Planet');
  planet.region = planet.region || 'Homebrew';
  planet.sector = planet.sector ? String(planet.sector) : '';
  planet.origin = planet.origin ? String(planet.origin) : '';
  const m = planet.map;
  planet.map = m && typeof m === 'object' && m.id && Number.isFinite(+m.x) && Number.isFinite(+m.y) ? { id: String(m.id), x: +m.x, y: +m.y } : null;
  if (planet.map && typeof m.replaces === 'string') planet.map.replaces = m.replaces;
  if (planet.map && typeof m.area === 'string') planet.map.area = m.area;
  planet.typeId = planet.typeId || 'temperate';
  planet.diameter = Number.isFinite(+planet.diameter) && +planet.diameter > 0 ? +planet.diameter : 10000;
  planet.description = planet.description || '';
  planet.gmNotes = planet.gmNotes || '';
  planet.seed = planet.seed ?? planet.id;
  planet.cells = +planet.cells || DEFAULT_CELLS;
  planet.params = planet.params && typeof planet.params === 'object' ? planet.params : {};
  const e = planet.edits && typeof planet.edits === 'object' ? planet.edits : {};
  planet.edits = { h: e.h || {}, b: e.b || {}, r: e.r || {} };
  planet.regions = Array.isArray(planet.regions) ? planet.regions : [];
  planet.locations = (Array.isArray(planet.locations) ? planet.locations : []).map((l) => ({
    id: String(l.id || makeId('loc')),
    name: String(l.name ?? 'Unnamed'),
    type: l.type || 'poi',
    lat: +l.lat || 0,
    lon: +l.lon || 0,
    notes: l.notes || '',
    gmNotes: l.gmNotes || '',
    secret: !!l.secret,
    water: !!l.water,
  }));
  return planet;
}

export class Store {
  constructor(storage, { onError, onSaved } = {}) {
    this.storage = storage;
    this.onError = onError || (() => {});
    this.onSaved = onSaved || (() => {});
    this.cache = new Map();
    this.timer = null;
    this.lastSaved = null;
    this.data = { app: APP_ID, version: SCHEMA_VERSION, planets: {}, deletedCanon: [], customTypes: [], settings: {}, mapLayout: {} };
  }

  load() {
    try {
      const raw = this.storage?.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          this.data = { ...this.data, ...parsed };
          for (const id of Object.keys(this.data.planets)) this.data.planets[id] = normalizePlanet(this.data.planets[id]);
        }
      }
    } catch (err) {
      this.onError(`Could not read saved data (${err.message}). Starting fresh; nothing was deleted.`);
    }
    return this;
  }

  scheduleSave() {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.saveNow(), 400);
  }

  saveNow() {
    clearTimeout(this.timer);
    this.timer = null;
    try {
      this.storage?.setItem(STORAGE_KEY, JSON.stringify(this.data, roundFloats));
      this.lastSaved = new Date();
      this.onSaved(this.lastSaved);
      return true;
    } catch (err) {
      this.onError('Browser storage is full or blocked. Use Data > Export to keep a copy of your work.');
      return false;
    }
  }

  // All planets for the list: canon (minus deleted) plus your own.
  listPlanets() {
    const out = [];
    const deleted = new Set(this.data.deletedCanon);
    for (const c of CANON_PLANETS) {
      if (deleted.has(c.id)) continue;
      const saved = this.data.planets[c.id];
      out.push(saved || this.getPlanet(c.id));
    }
    for (const p of Object.values(this.data.planets)) {
      if (!p.canon) out.push(p);
    }
    return out;
  }

  isModified(id) {
    return !!this.data.planets[id];
  }

  getPlanet(id) {
    if (this.data.planets[id]) return this.data.planets[id];
    if (this.cache.has(id)) return this.cache.get(id);
    const fresh = canonDefault(id);
    if (fresh) this.cache.set(id, fresh);
    return fresh;
  }

  // Call after changing a planet. Canon planets become "saved" from here on.
  touch(planet) {
    this.data.planets[planet.id] = planet;
    this.scheduleSave();
  }

  addPlanet(planet) {
    this.data.planets[planet.id] = planet;
    this.scheduleSave();
    return planet;
  }

  resetPlanet(id) {
    delete this.data.planets[id];
    this.cache.delete(id);
    this.scheduleSave();
    return this.getPlanet(id);
  }

  deletePlanet(id) {
    const planet = this.getPlanet(id);
    delete this.data.planets[id];
    this.cache.delete(id);
    if (planet?.canon && !this.data.deletedCanon.includes(id)) this.data.deletedCanon.push(id);
    this.scheduleSave();
  }

  restoreCanon() {
    this.data.deletedCanon = [];
    this.scheduleSave();
  }

  get settings() {
    return this.data.settings;
  }

  setSetting(key, value) {
    this.data.settings[key] = value;
    this.scheduleSave();
  }

  // Star map positions you dragged, per map: { [mapId]: { [nodeId]: { x, y } } }.
  mapLayout(mapId) {
    if (!this.data.mapLayout) this.data.mapLayout = {};
    return this.data.mapLayout[mapId] || {};
  }

  setMapPosition(mapId, nodeId, x, y) {
    if (!this.data.mapLayout) this.data.mapLayout = {};
    if (!this.data.mapLayout[mapId]) this.data.mapLayout[mapId] = {};
    this.data.mapLayout[mapId][nodeId] = { x: Math.round(x), y: Math.round(y) };
    this.scheduleSave();
  }

  resetMapLayout(mapId) {
    if (this.data.mapLayout) delete this.data.mapLayout[mapId];
    this.scheduleSave();
  }

  get customTypes() {
    return this.data.customTypes;
  }

  setCustomTypes(list) {
    this.data.customTypes = list;
    this.scheduleSave();
  }

  exportData(planets) {
    return {
      app: APP_ID,
      version: SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      planets: JSON.parse(JSON.stringify(planets, roundFloats)).map((p) => {
        // Bake dragged star map positions into the exported planet.
        const moved = p.map && this.mapLayout(p.map.id)[p.id];
        if (moved) p.map = { ...p.map, x: moved.x, y: moved.y };
        return p;
      }),
      customTypes: this.data.customTypes,
      mapLayout: this.data.mapLayout || {},
    };
  }

  // Returns how many planets were added/replaced. Throws on invalid files.
  importData(obj, { overwrite = true } = {}) {
    if (!obj || typeof obj !== 'object') throw new Error('That file is not valid JSON data.');
    const list = Array.isArray(obj.planets) ? obj.planets : obj.id ? [obj] : null;
    if (!list) throw new Error('No planets found in that file.');
    let added = 0, replaced = 0, skipped = 0;
    for (const raw of list) {
      const planet = normalizePlanet(raw);
      const exists = !!this.data.planets[planet.id] || CANON_PLANETS.some((c) => c.id === planet.id);
      if (exists && !overwrite) { skipped++; continue; }
      if (exists) replaced++;
      else added++;
      planet.canon = CANON_PLANETS.some((c) => c.id === planet.id);
      this.data.planets[planet.id] = planet;
      this.cache.delete(planet.id);
      this.data.deletedCanon = this.data.deletedCanon.filter((id) => id !== planet.id);
    }
    if (obj.mapLayout && typeof obj.mapLayout === 'object') {
      if (!this.data.mapLayout) this.data.mapLayout = {};
      for (const [mapId, nodes] of Object.entries(obj.mapLayout)) {
        if (nodes && typeof nodes === 'object') this.data.mapLayout[mapId] = { ...(this.data.mapLayout[mapId] || {}), ...nodes };
      }
    }
    if (Array.isArray(obj.customTypes)) {
      const ids = new Set(this.data.customTypes.map((t) => t.id));
      for (const t of obj.customTypes) if (t && t.id && !ids.has(t.id)) this.data.customTypes.push(t);
    }
    this.scheduleSave();
    return { added, replaced, skipped };
  }

  eraseAll() {
    this.data = { app: APP_ID, version: SCHEMA_VERSION, planets: {}, deletedCanon: [], customTypes: [], settings: {}, mapLayout: {} };
    this.cache.clear();
    try {
      this.storage?.removeItem(STORAGE_KEY);
    } catch {
      /* storage blocked: nothing to remove */
    }
  }
}

// Keep saved files small: 3 decimals is plenty for elevations and coordinates.
function roundFloats(key, value) {
  if (typeof value === 'number' && !Number.isInteger(value)) return Math.round(value * 1000) / 1000;
  return value;
}

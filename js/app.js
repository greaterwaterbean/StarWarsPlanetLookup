// The app controller: owns the current planet, its generated world, the camera
// and the render loop. UI panels and input handlers call methods on it.

import { buildWorld, refreshWorld, deriveWorld, nearestCell } from './core/generator.js';
import { findCell, cellsWithin } from './core/mesh.js';
import { DEG, clamp, wrapLon, vecToLatLon, latLonToVec, angleBetween, greatCircle } from './core/sphere.js';
import { setCustomTypes } from './core/types.js';
import { createCamera, makeView, unproject, clampCamera } from './render/camera.js';
import { createTarget, renderGlobe } from './render/globeRenderer.js';
import { drawOverlay } from './render/overlay.js';
import { drawStars } from './render/stars.js';
import { Store, makeId, newPlanet, emptyEdits, normalizePlanet } from './state/store.js';
import { History, restoreSnapshot } from './state/history.js';
import { BIOMES, hexToRgb } from './data/biomes.js';
import { getLocationType } from './data/locationTypes.js';
import { UI } from './ui/ui.js';
import { StarMap } from './ui/starmap.js';
import { bindControls } from './controls.js';
import { download, slug } from './ui/dom.js';
import { renderFlatMap } from './render/flatMap.js';
import { foundryScene, foundryJournal, foundryReadme, exportedLocations } from './foundry.js';
import { makeZip } from './state/zip.js';

export const DEFAULT_LAYERS = {
  shading: true,
  relief: true,
  dither: true,
  clouds: false,
  atmosphere: true,
  coast: true,
  grid: false,
  regions: true,
  graticule: false,
  markers: true,
  labels: true,
  stars: true,
  spin: false,
};

export const REGION_COLORS = ['#ff595e', '#ffca3a', '#8ac926', '#1982c4', '#6a4c93', '#ff924c', '#52d1dc', '#f15bb5', '#c5ca30', '#ffffff'];

function safeStorage() {
  try {
    const k = '__swpl_test__';
    window.localStorage.setItem(k, '1');
    window.localStorage.removeItem(k);
    return window.localStorage;
  } catch {
    return null;
  }
}

export class App {
  constructor() {
    this.stage = document.getElementById('stage');
    this.starsCanvas = document.getElementById('stars');
    this.globeCanvas = document.getElementById('globe');
    this.overlay = document.getElementById('overlay');
    this.gctx = this.globeCanvas.getContext('2d');
    this.octx = this.overlay.getContext('2d');

    const storage = safeStorage();
    this.store = new Store(storage, {
      onError: (msg) => this.toast(msg, 'error'),
      onSaved: () => this.ui?.updateSaveStatus(),
    });
    this.storageAvailable = !!storage;
    this.history = new History();
    this.camera = createCamera();
    this.layers = { ...DEFAULT_LAYERS };
    this.pixelSize = 3;
    this.tool = 'select';
    this.paint = { mode: 'biome', biome: 'forest', regionId: null, size: 2.5, strength: 0.5 };
    this.lastLocationType = 'city';
    this.playerView = false;

    this.planet = null;
    this.world = null;
    this.selectedId = null;
    this.selectedCell = -1;
    this.hoverId = null;
    this.measure = { points: [], cursor: null };
    this.brushVec = null;
    this.pending = null;

    this.width = 1;
    this.height = 1;
    this.dpr = 1;
    this.target = null;
    this.globeDirty = true;
    this.overlayDirty = true;
    this.raf = 0;
    this.lastFrame = 0;
    this.velocity = null;
    this.fly = null;
    this.interactiveUntil = 0;
    this.drawnPixel = 0;
    this.lastCell = 0;
    this.lastBrushCell = 0;
    this.markerHits = [];
    this.pointer = null;
    this.refreshPending = false;
  }

  init() {
    this.store.load();
    setCustomTypes(this.store.customTypes);
    const s = this.store.settings;
    if (s.layers) Object.assign(this.layers, s.layers);
    if (s.pixelSize) this.pixelSize = s.pixelSize;
    if (s.paint) Object.assign(this.paint, s.paint, { regionId: null });
    if (s.lastLocationType) this.lastLocationType = s.lastLocationType;
    this.playerView = !!s.playerView;
    document.body.classList.toggle('player-view', this.playerView);

    this.ui = new UI(this);
    this.ui.init();
    this.starmap = new StarMap(this);
    bindControls(this);

    new ResizeObserver(() => this.resize()).observe(this.stage);
    this.resize();

    const initialHash = location.hash;
    const fromHash = this.planetIdFromHash();
    const candidates = [fromHash, s.lastPlanetId, 'tatooine'];
    let id = candidates.find((c) => c && this.store.getPlanet(c) && !this.store.data.deletedCanon.includes(c));
    if (!id) id = this.store.listPlanets()[0]?.id;
    if (id) this.selectPlanet(id);
    this.openMapFromHash(initialHash);

    window.addEventListener('hashchange', () => {
      const hid = this.planetIdFromHash();
      if (hid && hid !== this.planet?.id && this.store.getPlanet(hid)) {
        this.starmap.close();
        this.selectPlanet(hid);
      }
      this.openMapFromHash();
    });
    window.addEventListener('beforeunload', () => {
      this.commitEdit();
      this.store.saveNow();
    });

    if (!this.storageAvailable) this.toast('Browser storage is blocked, so changes will not be saved. Use Data > Export.', 'error');
    if (!s.seenHelp) {
      this.store.setSetting('seenHelp', true);
      setTimeout(() => document.getElementById('helpDialog').showModal(), 400);
    }
  }

  planetIdFromHash() {
    const m = /planet=([^&]+)/.exec(location.hash);
    return m ? decodeURIComponent(m[1]) : null;
  }

  // Links like #map=hutt-space&area=bootana-hutta open the star map.
  openMapFromHash(hash = location.hash) {
    const m = /map=([^&]+)/.exec(hash);
    if (!m) return;
    const area = /area=([^&]+)/.exec(hash);
    const mapId = decodeURIComponent(m[1]);
    const areaId = area ? decodeURIComponent(area[1]) : null;
    if (this.starmap.isOpen && this.starmap.mapId === mapId) return;
    this.starmap.open(mapId, { area: areaId });
  }

  planetLink(id = this.planet?.id) {
    return `${location.origin}${location.pathname}#planet=${encodeURIComponent(id)}`;
  }

  // ---------- Planets ----------

  selectPlanet(id, { keepCamera = false } = {}) {
    const planet = this.store.getPlanet(id);
    if (!planet) return;
    this.commitEdit();
    this.planet = planet;
    this.world = buildWorld(planet);
    this.snapLocations();
    this.history.clear();
    this.selectedId = null;
    this.selectedCell = -1;
    this.measure.points = [];
    this.velocity = null;
    this.fly = null;
    if (!keepCamera) {
      const c = this.defaultCenter();
      Object.assign(this.camera, { lat: c.lat, lon: c.lon, zoom: 1 });
    }
    this.paint.regionId = planet.regions[0]?.id ?? null;
    this.store.setSetting('lastPlanetId', id);
    history.replaceState(null, '', `#planet=${encodeURIComponent(id)}`);
    document.title = `${planet.name} | Planet Lookup`;
    this.ui.onPlanetChanged();
    this.requestRender();
  }

  defaultCenter() {
    const locs = this.planet.locations;
    if (locs.length) {
      const best = locs.slice().sort((a, b) => getLocationType(b.type).size - getLocationType(a.type).size)[0];
      return { lat: clamp(best.lat, -60, 60), lon: best.lon + 12 };
    }
    return { lat: 15, lon: 20 };
  }

  // Canon locations have made-up coordinates, so some land in water. Nearby
  // places (like Theed and its palace) are moved together as a group, keeping
  // their layout, to the closest spot where they are all on land.
  snapLocations() {
    const { world } = this;
    const mesh = world.mesh;
    const xyz = mesh.xyz;
    const pending = this.planet.locations.filter((l) => l.snap);
    if (!pending.length) return;
    let hint = this.lastCell;
    const isLand = (lat, lon) => {
      const v = latLonToVec(clamp(lat, -89, 89), lon);
      hint = findCell(mesh, v[0], v[1], v[2], hint);
      return !world.isWater[hint];
    };

    // Group places that are within 8 degrees of each other.
    const groups = [];
    const used = new Set();
    for (const start of pending) {
      if (used.has(start)) continue;
      const group = [start];
      used.add(start);
      for (let i = 0; i < group.length; i++) {
        const a = latLonToVec(group[i].lat, group[i].lon);
        for (const other of pending) {
          if (used.has(other)) continue;
          if (angleBetween(a, latLonToVec(other.lat, other.lon)) < 8 * DEG) {
            used.add(other);
            group.push(other);
          }
        }
      }
      groups.push(group);
    }

    for (const group of groups) {
      group.forEach((l) => delete l.snap);
      const fits = (dLat, dLon) => group.every((l) => isLand(l.lat + dLat, l.lon + dLon));
      if (fits(0, 0)) continue;
      let found = null;
      // Search outward in rings for an offset that puts the whole group on land.
      for (let r = 1.5; r <= 50 && !found; r += 1.5) {
        const steps = Math.ceil(r * 4);
        for (let s = 0; s < steps; s++) {
          const a = (s / steps) * Math.PI * 2;
          const dLat = r * Math.sin(a);
          const dLon = r * Math.cos(a);
          if (fits(dLat, dLon)) { found = [dLat, dLon]; break; }
        }
      }
      for (const loc of group) {
        if (found) {
          loc.lat = clamp(loc.lat + found[0], -89, 89);
          loc.lon = wrapLon(loc.lon + found[1]);
        } else {
          // No spot fits everyone: fall back to the nearest land cell for each place.
          const v = latLonToVec(loc.lat, loc.lon);
          const c = findCell(mesh, v[0], v[1], v[2], hint);
          const land = world.isWater[c] ? nearestCell(world, c, (n) => !world.isWater[n]) : c;
          if (land < 0) continue;
          const ll = vecToLatLon(xyz[land * 3], xyz[land * 3 + 1], xyz[land * 3 + 2]);
          loc.lat = ll.lat;
          loc.lon = ll.lon;
        }
        loc.lat = Math.round(loc.lat * 1000) / 1000;
        loc.lon = Math.round(loc.lon * 1000) / 1000;
      }
    }
  }

  createPlanet(opts) {
    const planet = this.store.addPlanet(newPlanet(opts));
    this.starmap.close();
    this.selectPlanet(planet.id);
    this.ui.showTab('planet');
    this.toast(`Created ${planet.name}`);
  }

  duplicatePlanet() {
    const copy = normalizePlanet(JSON.parse(JSON.stringify(this.planet)));
    copy.id = makeId('planet');
    copy.name = `${this.planet.name} (copy)`;
    copy.canon = false;
    this.store.addPlanet(copy);
    this.selectPlanet(copy.id);
    this.toast('Planet duplicated');
  }

  async deletePlanet() {
    const p = this.planet;
    const ok = await this.ui.confirm(`Delete ${p.name}?`, p.canon ? 'Canon planets can be restored later from the Data tab.' : 'This cannot be undone. Export it first if you might want it back.', 'Delete', true);
    if (!ok) return;
    this.store.deletePlanet(p.id);
    const next = this.store.listPlanets()[0];
    if (next) this.selectPlanet(next.id);
    this.ui.renderPlanets();
    this.toast(`Deleted ${p.name}`);
  }

  async resetPlanet() {
    const ok = await this.ui.confirm(`Reset ${this.planet.name}?`, 'All your changes to this planet (places, painting, settings) will be replaced by the original version.', 'Reset', true);
    if (!ok) return;
    const id = this.planet.id;
    this.store.resetPlanet(id);
    this.planet = null;
    this.selectPlanet(id);
    this.toast('Planet reset');
  }

  // ---------- World updates ----------

  refresh({ full = false } = {}) {
    if (!this.planet) return;
    if (full || this.world.mesh.count !== (this.planet.cells || 0)) this.world = buildWorld(this.planet);
    else refreshWorld(this.world);
    this.requestRender();
    this.ui.onWorldChanged();
  }

  // For sliders: refresh at most once per frame.
  scheduleRefresh() {
    this.refreshPending = true;
    this.requestRender();
  }

  // ---------- Edits and undo ----------

  beginEdit() {
    if (!this.pending && this.planet) this.pending = History.snapshot(this.planet);
  }

  commitEdit() {
    if (!this.planet || !this.pending) return;
    const before = this.pending;
    this.pending = null;
    if (before === History.snapshot(this.planet)) return;
    this.history.push(before);
    this.store.touch(this.planet);
    this.ui.onEdited();
  }

  edit(fn) {
    this.beginEdit();
    fn();
    this.commitEdit();
  }

  undo() {
    this.commitEdit();
    const snap = this.history.undo(History.snapshot(this.planet));
    if (snap) this.applySnapshot(snap, 'Undone');
  }

  redo() {
    this.commitEdit();
    const snap = this.history.redo(History.snapshot(this.planet));
    if (snap) this.applySnapshot(snap, 'Redone');
  }

  applySnapshot(snap, message) {
    const oldCells = this.planet.cells;
    restoreSnapshot(this.planet, snap);
    this.refresh({ full: this.planet.cells !== oldCells });
    if (this.selectedId && !this.getLocation(this.selectedId)) this.selectedId = null;
    this.store.touch(this.planet);
    this.ui.onPlanetDataRestored();
    this.toast(message);
  }

  setType(typeId) {
    if (typeId === this.planet.typeId) return;
    this.edit(() => { this.planet.typeId = typeId; });
    this.refresh();
    this.ui.renderPlanetPanel();
    this.ui.renderPaint();
    this.ui.renderPlanets();
  }

  setSeed(seed) {
    this.edit(() => { this.planet.seed = seed; });
    this.refresh();
    this.ui.renderPlanets();
  }

  async setCells(cells) {
    if (cells === this.planet.cells) return;
    const e = this.planet.edits;
    const painted = Object.keys(e.h).length + Object.keys(e.b).length + Object.keys(e.r).length;
    if (painted) {
      const ok = await this.ui.confirm('Change the cell resolution?', 'Painted terrain and regions are tied to the current cells, so they will be cleared. Places stay where they are.', 'Change it', true);
      if (!ok) {
        this.ui.renderPlanetPanel();
        return;
      }
    }
    this.edit(() => {
      this.planet.cells = cells;
      this.planet.edits = emptyEdits();
    });
    this.refresh({ full: true });
    this.ui.renderPaint();
  }

  resetParams() {
    this.edit(() => { this.planet.params = {}; });
    this.refresh();
    this.ui.renderPlanetPanel();
  }

  // ---------- Locations ----------

  visibleLocations() {
    if (!this.planet) return [];
    return this.playerView ? this.planet.locations.filter((l) => !l.secret) : this.planet.locations;
  }

  getLocation(id) {
    return id ? this.planet?.locations.find((l) => l.id === id) || null : null;
  }

  selectLocation(id, { fly = false } = {}) {
    this.selectedId = id;
    this.selectedCell = -1;
    const loc = this.getLocation(id);
    if (loc && fly) this.flyTo(loc.lat, loc.lon, Math.max(this.camera.zoom, 2.2));
    this.ui.onSelectionChanged();
    this.requestRender();
  }

  addLocationAt(vec) {
    const ll = vecToLatLon(vec[0], vec[1], vec[2]);
    const loc = {
      id: makeId('loc'),
      name: 'New place',
      type: this.lastLocationType,
      lat: Math.round(ll.lat * 1000) / 1000,
      lon: Math.round(ll.lon * 1000) / 1000,
      notes: '',
      gmNotes: '',
      secret: false,
      water: false,
    };
    this.edit(() => this.planet.locations.push(loc));
    this.setTool('select');
    this.selectLocation(loc.id);
    this.ui.renderPlaces();
    this.ui.focusInspectorName();
  }

  deleteLocation(id) {
    const loc = this.getLocation(id);
    if (!loc) return;
    this.edit(() => { this.planet.locations = this.planet.locations.filter((l) => l.id !== id); });
    if (this.selectedId === id) this.selectedId = null;
    this.ui.onSelectionChanged();
    this.ui.renderPlaces();
    this.requestRender();
    this.toast(`Deleted ${loc.name}. Ctrl+Z to undo.`);
  }

  moveLocation(loc, vec) {
    const ll = vecToLatLon(vec[0], vec[1], vec[2]);
    loc.lat = Math.round(ll.lat * 1000) / 1000;
    loc.lon = Math.round(ll.lon * 1000) / 1000;
    this.requestRender(false);
  }

  // ---------- Cells ----------

  cellAtScreen(sx, sy) {
    const v = unproject(this.view(), sx, sy);
    if (!v) return -1;
    return findCell(this.world.mesh, v[0], v[1], v[2], this.lastCell);
  }

  selectCell(cell) {
    this.selectedCell = cell;
    this.selectedId = null;
    this.ui.onSelectionChanged();
    this.requestRender();
  }

  // Human-friendly numbers for a cell. The units are flavor, not science.
  cellInfo(c) {
    const w = this.world;
    const xyz = w.mesh.xyz;
    const ll = vecToLatLon(xyz[c * 3], xyz[c * 3 + 1], xyz[c * 3 + 2]);
    const h = w.h[c];
    const bands = w.base.bands;
    const regionIdx = w.region[c];
    return {
      cell: c,
      biome: BIOMES[w.biome[c]],
      color: w.biomeRGB[w.biome[c]],
      lat: ll.lat,
      lon: ll.lon,
      elevation: bands ? null : Math.round(h >= 0 ? h * 8800 : h * 7000),
      temperature: bands ? null : Math.round(w.t[c] * 110 - 50),
      moisture: bands ? null : Math.round(w.m[c] * 100),
      region: regionIdx >= 0 ? this.planet.regions[regionIdx] : null,
      edited: c in this.planet.edits.h || c in this.planet.edits.b,
    };
  }

  // ---------- Painting ----------

  // Applies the brush along the path from `from` to `to` (both world vectors).
  paintStroke(from, to) {
    const radius = this.paint.size * DEG;
    const steps = from ? Math.max(1, Math.ceil(angleBetween(from, to) / (radius * 0.35))) : 1;
    const points = from ? greatCircle(from, to, steps).slice(1) : [to];
    for (const p of points) this.paintCells(p, radius);
    deriveWorld(this.world);
    this.requestRender();
  }

  paintCells(vec, radius) {
    const { world, planet } = this;
    const mesh = world.mesh;
    const xyz = mesh.xyz;
    const e = planet.edits;
    const cells = cellsWithin(mesh, vec, radius, this.lastBrushCell);
    this.lastBrushCell = cells[0];
    const { mode, strength } = this.paint;
    for (const c of cells) {
      if (mode === 'biome') {
        e.b[c] = this.paint.biome;
      } else if (mode === 'raise' || mode === 'lower') {
        const d = Math.acos(clamp(xyz[c * 3] * vec[0] + xyz[c * 3 + 1] * vec[1] + xyz[c * 3 + 2] * vec[2], -1, 1)) / radius;
        const falloff = 1 - d * d;
        const delta = (mode === 'raise' ? 1 : -1) * (0.01 + 0.05 * strength) * falloff;
        e.h[c] = Math.round(clamp(world.h[c] + delta, -1, 1) * 1000) / 1000;
        world.h[c] = e.h[c];
      } else if (mode === 'smooth') {
        let sum = 0, n = 0;
        for (let k = mesh.offsets[c]; k < mesh.offsets[c + 1]; k++) { sum += world.h[mesh.adj[k]]; n++; }
        const target = sum / n;
        e.h[c] = Math.round((world.h[c] + (target - world.h[c]) * (0.2 + 0.6 * strength)) * 1000) / 1000;
        world.h[c] = e.h[c];
      } else if (mode === 'region') {
        if (this.paint.regionId) e.r[c] = this.paint.regionId;
        else delete e.r[c];
      } else if (mode === 'erase') {
        delete e.h[c];
        delete e.b[c];
      }
    }
  }

  async clearPainting() {
    const ok = await this.ui.confirm('Clear all painted terrain?', 'Biome paint and raised or lowered land go back to the generated terrain. Regions and places are kept.', 'Clear', true);
    if (!ok) return;
    this.edit(() => {
      this.planet.edits.h = {};
      this.planet.edits.b = {};
    });
    this.refresh();
  }

  addRegion() {
    const n = this.planet.regions.length;
    const region = { id: makeId('region'), name: `Region ${n + 1}`, color: REGION_COLORS[n % REGION_COLORS.length] };
    this.edit(() => this.planet.regions.push(region));
    this.paint.regionId = region.id;
    this.paint.mode = 'region';
    this.refresh();
    this.ui.renderPaint();
    return region;
  }

  deleteRegion(id) {
    this.edit(() => {
      this.planet.regions = this.planet.regions.filter((r) => r.id !== id);
      for (const k of Object.keys(this.planet.edits.r)) if (this.planet.edits.r[k] === id) delete this.planet.edits.r[k];
    });
    if (this.paint.regionId === id) this.paint.regionId = this.planet.regions[0]?.id ?? null;
    this.refresh();
    this.ui.renderPaint();
  }

  // ---------- Tools and modes ----------

  setTool(tool) {
    if (this.playerView && (tool === 'add' || tool === 'paint')) return;
    this.tool = tool;
    if (tool !== 'measure') {
      this.measure.points = [];
      this.measure.cursor = null;
    }
    if (tool !== 'paint') this.brushVec = null;
    this.overlay.className = `tool-${tool}`;
    if (tool === 'paint') this.ui.showTab('paint');
    if (tool === 'add') this.toast('Click on the planet to place it');
    if (tool === 'measure') this.toast('Click points to measure. Esc or right-click clears.');
    this.ui.updateToolbar();
    this.ui.updateMeasure();
    this.requestRender(false);
  }

  setPlayerView(on) {
    this.commitEdit();
    this.playerView = on;
    document.body.classList.toggle('player-view', on);
    if (on && (this.tool === 'add' || this.tool === 'paint')) this.setTool('select');
    const sel = this.getLocation(this.selectedId);
    if (on && sel?.secret) this.selectedId = null;
    this.store.setSetting('playerView', on);
    this.ui.onPlayerViewChanged();
    this.requestRender();
    this.toast(on ? 'Player view: secrets and editing hidden' : 'GM view');
  }

  setLayer(key, value) {
    this.layers[key] = value;
    this.store.setSetting('layers', this.layers);
    if (key === 'stars') this.drawBackground();
    this.requestRender();
    this.ui.renderView();
  }

  setPixelSize(p) {
    this.pixelSize = clamp(Math.round(p), 1, 8);
    this.store.setSetting('pixelSize', this.pixelSize);
    this.requestRender();
  }

  // ---------- Camera ----------

  view() {
    return makeView(this.camera, this.width, this.height);
  }

  markInteractive() {
    this.interactiveUntil = performance.now() + 160;
    clearTimeout(this.crispTimer);
    this.crispTimer = setTimeout(() => this.requestRender(), 200);
  }

  rotateBy(dx, dy) {
    const R = this.view().R;
    const lat = this.camera.lat * DEG;
    this.camera.lon -= (dx / R) / Math.max(Math.cos(lat), 0.3) / DEG;
    this.camera.lat += (dy / R) / DEG;
    clampCamera(this.camera);
    this.fly = null;
    this.markInteractive();
    this.requestRender();
  }

  // Zoom so the point under (sx, sy) stays under the cursor.
  zoomAt(sx, sy, factor) {
    const before = unproject(this.view(), sx, sy);
    this.camera.zoom *= factor;
    clampCamera(this.camera);
    if (before) {
      const target = vecToLatLon(before[0], before[1], before[2]);
      for (let i = 0; i < 3; i++) {
        const after = unproject(this.view(), sx, sy);
        if (!after) break;
        const now = vecToLatLon(after[0], after[1], after[2]);
        this.camera.lon += wrapLon(target.lon - now.lon);
        this.camera.lat += target.lat - now.lat;
        clampCamera(this.camera);
      }
    }
    this.fly = null;
    this.velocity = null;
    this.markInteractive();
    this.requestRender();
  }

  zoomBy(factor) {
    this.zoomAt(this.width / 2, this.height / 2, factor);
  }

  flyTo(lat, lon, zoom = this.camera.zoom) {
    const from = { ...this.camera };
    this.fly = { from, to: { lat: clamp(lat, -89.9, 89.9), lon: from.lon + wrapLon(lon - from.lon), zoom }, t0: performance.now(), dur: 650 };
    this.velocity = null;
    this.requestRender();
  }

  resetView() {
    const c = this.defaultCenter();
    this.flyTo(c.lat, c.lon, 1);
  }

  // ---------- Rendering ----------

  resize() {
    const r = this.stage.getBoundingClientRect();
    this.width = Math.max(1, Math.round(r.width));
    this.height = Math.max(1, Math.round(r.height));
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.overlay.width = Math.round(this.width * this.dpr);
    this.overlay.height = Math.round(this.height * this.dpr);
    this.overlay.style.width = `${this.width}px`;
    this.overlay.style.height = `${this.height}px`;
    this.drawBackground();
    this.target = null;
    this.requestRender();
  }

  drawBackground() {
    if (this.layers.stars) {
      drawStars(this.starsCanvas, this.width, this.height, 2);
    } else {
      const ctx = this.starsCanvas.getContext('2d');
      this.starsCanvas.width = 1;
      this.starsCanvas.height = 1;
      this.starsCanvas.style.width = `${this.width}px`;
      this.starsCanvas.style.height = `${this.height}px`;
      ctx.fillStyle = '#04060d';
      ctx.fillRect(0, 0, 1, 1);
    }
  }

  requestRender(globe = true) {
    if (globe) this.globeDirty = true;
    this.overlayDirty = true;
    if (!this.raf) this.raf = requestAnimationFrame((t) => this.frame(t));
  }

  frame(now) {
    this.raf = 0;
    const dt = Math.min(50, this.lastFrame ? now - this.lastFrame : 16);
    this.lastFrame = now;
    if (!this.world) return;
    let animating = false;

    if (this.refreshPending) {
      this.refreshPending = false;
      this.refresh();
    }

    if (this.fly) {
      const f = this.fly;
      const t = Math.min(1, (now - f.t0) / f.dur);
      const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      this.camera.lat = f.from.lat + (f.to.lat - f.from.lat) * e;
      this.camera.lon = f.from.lon + (f.to.lon - f.from.lon) * e;
      this.camera.zoom = Math.exp(Math.log(f.from.zoom) + (Math.log(f.to.zoom) - Math.log(f.from.zoom)) * e);
      clampCamera(this.camera);
      if (t >= 1) this.fly = null;
      animating = true;
    } else if (this.velocity && !this.pointer) {
      const v = this.velocity;
      this.camera.lon += v.lon * dt;
      this.camera.lat += v.lat * dt;
      clampCamera(this.camera);
      const decay = Math.exp(-dt / 280);
      v.lon *= decay;
      v.lat *= decay;
      if (Math.abs(v.lon) + Math.abs(v.lat) < 0.0004) this.velocity = null;
      animating = true;
    } else if (this.layers.spin && !this.pointer) {
      this.camera.lon += dt * 0.005;
      clampCamera(this.camera);
      animating = true;
    }
    if (animating) {
      this.globeDirty = true;
      this.overlayDirty = true;
      this.markInteractive();
    }

    const interactive = animating || now < this.interactiveUntil;
    if (this.globeDirty) this.drawGlobe(interactive);
    if (this.overlayDirty) this.drawOverlayLayer();
    if (animating) this.requestRender();
  }

  drawGlobe(interactive) {
    const p = interactive && this.pixelSize === 1 ? 2 : this.pixelSize;
    const bw = Math.ceil(this.width / p);
    const bh = Math.ceil(this.height / p);
    if (!this.target || this.target.width !== bw || this.target.height !== bh) {
      this.target = createTarget(bw, bh);
      this.globeCanvas.width = bw;
      this.globeCanvas.height = bh;
      this.globeCanvas.style.width = `${bw * p}px`;
      this.globeCanvas.style.height = `${bh * p}px`;
    }
    const view = this.view();
    renderGlobe(this.target, this.world, { cx: view.cx / p, cy: view.cy / p, R: view.R / p, m: view.m }, {
      ...this.layers,
      dither: this.layers.dither && p > 1,
      regionColors: this.planet.regions.map((r) => hexToRgb(r.color)),
      selectedCell: this.selectedCell,
      startCell: this.lastCell,
    });
    this.gctx.putImageData(this.target.image, 0, 0);
    const mid = this.target.index[Math.floor(bh / 2) * bw + Math.floor(bw / 2)];
    if (mid >= 0) this.lastCell = mid;
    this.drawnPixel = p;
    this.globeDirty = false;
  }

  drawOverlayLayer() {
    const ctx = this.octx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.markerHits = drawOverlay(ctx, {
      view: this.view(),
      world: this.world,
      planet: this.planet,
      layers: this.layers,
      locations: this.visibleLocations(),
      selectedId: this.selectedId,
      hoverId: this.hoverId,
      brush: this.tool === 'paint' && this.brushVec ? { vec: this.brushVec, radius: this.paint.size * DEG } : null,
      measure: this.measure.points.length ? { ...this.measure, diameter: this.planet.diameter } : null,
    });
    this.overlayDirty = false;
  }

  exportImage() {
    const c = document.createElement('canvas');
    c.width = Math.round(this.width * this.dpr);
    c.height = Math.round(this.height * this.dpr);
    const ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    const sw = parseFloat(this.starsCanvas.style.width) || this.width;
    const sh = parseFloat(this.starsCanvas.style.height) || this.height;
    ctx.drawImage(this.starsCanvas, 0, 0, sw * this.dpr, sh * this.dpr);
    const gw = parseFloat(this.globeCanvas.style.width);
    const gh = parseFloat(this.globeCanvas.style.height);
    ctx.drawImage(this.globeCanvas, 0, 0, gw * this.dpr, gh * this.dpr);
    ctx.drawImage(this.overlay, 0, 0);
    c.toBlob((blob) => blob && download(`${slug(this.planet.name)}.png`, blob));
  }

  flatMapCanvas({ width = 4096, pixel = 4, bakeLabels = false, includeSecret = false } = {}) {
    return renderFlatMap(this.world, {
      width,
      pixel,
      relief: this.layers.relief,
      coast: this.layers.coast,
      grid: this.layers.grid,
      regions: this.layers.regions,
      clouds: false,
      regionColors: this.planet.regions.map((r) => hexToRgb(r.color)),
      labels: bakeLabels ? exportedLocations(this.planet, includeSecret) : null,
    });
  }

  exportFlatMap(options) {
    const canvas = this.flatMapCanvas(options);
    canvas.toBlob((blob) => blob && download(`${slug(this.planet.name)}-map.png`, blob));
  }

  // Zip with a flat map image, a Foundry scene, a journal and the planet data.
  async exportFoundry(options) {
    const { width = 4096, pixel = 4, includeSecret = false, includeGmNotes = false, bakeLabels = false, folder = 'planet-lookup', globeUrl = '', embedGlobe = false } = options;
    const planet = this.planet;
    const name = slug(planet.name);
    const canvas = this.flatMapCanvas({ width, pixel, bakeLabels, includeSecret });
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error('Could not create the map image (it may be too large for this browser).');
    const png = new Uint8Array(await blob.arrayBuffer());
    const cleanFolder = folder.trim().replace(/^\/+|\/+$/g, '') || 'planet-lookup';
    const files = { image: `${name}-map.png`, scene: `${name}-scene.json`, journal: `${name}-journal.json`, planet: `${name}.planet.json` };
    const imagePath = `${cleanFolder}/${files.image}`;
    const planetData = this.store.exportData([planet]).planets[0];
    if (!includeSecret) planetData.locations = planetData.locations.filter((l) => !l.secret);
    if (!includeGmNotes) {
      planetData.gmNotes = '';
      planetData.locations.forEach((l) => { l.gmNotes = ''; });
    }
    const scene = foundryScene(planet, { width: canvas.width, height: canvas.height, imagePath, includeSecret, planetData });
    const journal = foundryJournal(planet, { includeSecret, includeGmNotes, globeUrl, embedGlobe });
    const zip = makeZip([
      { name: files.image, data: png },
      { name: files.scene, data: JSON.stringify(scene, null, 2) },
      { name: files.journal, data: JSON.stringify(journal, null, 2) },
      { name: files.planet, data: JSON.stringify(this.store.exportData([planet]), null, 2) },
      { name: 'README.txt', data: foundryReadme(planet, files, imagePath) },
    ]);
    download(`${name}-foundry.zip`, new Blob([zip], { type: 'application/zip' }));
  }

  toast(message, kind = 'info') {
    this.ui?.toast(message, kind);
  }
}

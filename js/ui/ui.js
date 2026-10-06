// Glue between the app and the page: tabs, toolbar, HUD, toasts, and which
// panels to redraw when something changes.

import { $, $$, h, fill } from './dom.js';
import { applyIcons } from './icons.js';
import { renderPlanetsPanel, renderPlanetPanel, renderPlacesPanel, renderPaintPanel, renderViewPanel, renderDataPanel, updatePlanetStats } from './panels.js';
import { renderInspector } from './inspector.js';
import { confirmDialog } from './dialogs.js';
import { getType } from '../core/types.js';
import { formatDistance } from '../render/overlay.js';
import { angleBetween } from '../core/sphere.js';

const TRAVEL = [
  { name: 'On foot', kmh: 5 },
  { name: 'Beast mount', kmh: 15 },
  { name: 'Landspeeder', kmh: 250 },
  { name: 'Speeder bike', kmh: 500 },
  { name: 'Airspeeder', kmh: 900 },
];

function formatDuration(hours) {
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))} min`;
  if (hours < 48) return `${hours.toFixed(hours < 10 ? 1 : 0)} h`;
  return `${(hours / 24).toFixed(1)} days`;
}

export class UI {
  constructor(app) {
    this.app = app;
    this.activeTab = 'planets';
    this.planetQuery = '';
    this.placeQuery = '';
    this.placeType = '';
    // Regions open in the planet list. The current planet's region always opens.
    this.expanded = new Set();
    this.panels = {};
    this.toastTimer = null;
  }

  init() {
    applyIcons();
    $$('[data-panel]').forEach((el) => { this.panels[el.dataset.panel] = el; });

    $$('.tabs [data-tab]').forEach((btn) => btn.addEventListener('click', () => this.showTab(btn.dataset.tab)));

    $('#toolbar').addEventListener('click', (e) => {
      const btn = e.target.closest('button');
      if (!btn || btn.disabled) return;
      const app = this.app;
      if (btn.dataset.tool) app.setTool(btn.dataset.tool);
      const action = btn.dataset.action;
      if (action === 'undo') app.undo();
      else if (action === 'redo') app.redo();
      else if (action === 'zoomIn') app.zoomBy(1.5);
      else if (action === 'zoomOut') app.zoomBy(1 / 1.5);
      else if (action === 'resetView') app.resetView();
      else if (action === 'playerView') app.setPlayerView(!app.playerView);
      else if (action === 'starMap') app.starmap.toggle();
      else if (action === 'help') $('#helpDialog').showModal();
    });

    $('#menuOpen').addEventListener('click', () => document.body.classList.add('menu-open'));
    $('#menuClose').addEventListener('click', () => document.body.classList.remove('menu-open'));
    this.updateToolbar();
  }

  showTab(name) {
    if (this.app.playerView && (name === 'paint' || name === 'data')) name = 'planets';
    this.activeTab = name;
    $$('.tabs [data-tab]').forEach((b) => b.classList.toggle('active', b.dataset.tab === name));
    Object.entries(this.panels).forEach(([k, el]) => el.classList.toggle('active', k === name));
    if (name === 'planets') this.scrollActivePlanetIntoView();
  }

  closeMobileMenu() {
    document.body.classList.remove('menu-open');
  }

  // ---------- Panel renderers ----------
  renderPlanets() { renderPlanetsPanel(this.panels.planets, this.app); }
  renderPlanetPanel() { renderPlanetPanel(this.panels.planet, this.app); }
  renderPlaces() { renderPlacesPanel(this.panels.places, this.app); }
  renderPaint() { renderPaintPanel(this.panels.paint, this.app); }
  renderView() { renderViewPanel(this.panels.view, this.app); }
  renderData() { renderDataPanel(this.panels.data, this.app); }

  renderAll() {
    this.renderPlanets();
    this.renderPlanetPanel();
    this.renderPlaces();
    this.renderPaint();
    this.renderView();
    this.renderData();
  }

  scrollActivePlanetIntoView() {
    const el = this.panels.planets?.querySelector('.planet-item.active');
    if (el) el.scrollIntoView({ block: 'nearest' });
  }

  // ---------- Change notifications from the app ----------
  onPlanetChanged() {
    if (this.app.planet) this.expanded.add(this.app.planet.region);
    this.renderAll();
    this.updateTitle();
    renderInspector(this.app);
    this.updateToolbar();
    this.updateMeasure();
    this.scrollActivePlanetIntoView();
  }

  onPlanetDataRestored() {
    this.renderAll();
    this.updateTitle();
    renderInspector(this.app);
    this.updateToolbar();
  }

  onWorldChanged() {
    updatePlanetStats(this.app);
  }

  onEdited() {
    this.updateToolbar();
    this.markPlanetEdited();
  }

  onSelectionChanged() {
    renderInspector(this.app);
    $$('.place-item', this.panels.places).forEach((el) => el.classList.toggle('active', el.dataset.id === this.app.selectedId));
  }

  onPlayerViewChanged() {
    if (this.app.playerView && (this.activeTab === 'paint' || this.activeTab === 'data')) this.showTab('planets');
    this.renderAll();
    renderInspector(this.app);
    this.updateToolbar();
  }

  focusInspectorName() {
    const input = $('#inspector input[name="name"]');
    if (input) {
      input.focus();
      input.select();
    }
  }

  // Cheap updates that do not rebuild whole panels (so inputs keep focus).
  refreshPlanetListItem() {
    const p = this.app.planet;
    const item = this.panels.planets.querySelector(`.planet-item[data-id="${CSS.escape(p.id)}"] .name`);
    if (item) item.textContent = p.name;
  }

  markPlanetEdited() {
    const p = this.app.planet;
    const item = this.panels.planets.querySelector(`.planet-item[data-id="${CSS.escape(p.id)}"] .chips`);
    if (item && p.canon && !item.querySelector('.edited')) item.append(h('span', { class: 'chip edited' }, 'edited'));
  }

  updateTitle() {
    const p = this.app.planet;
    if (!p) return;
    const type = getType(p.typeId);
    fill($('#planetTitle'),
      h('div', { class: 't' }, p.name),
      h('div', { class: 's' }, [p.region, p.sector, type.name].filter(Boolean).join(' / ')),
    );
    document.title = `${p.name} | Planet Lookup`;
  }

  updateToolbar() {
    const app = this.app;
    $$('#toolbar [data-tool]').forEach((b) => b.classList.toggle('active', b.dataset.tool === app.tool));
    const undo = $('#toolbar [data-action="undo"]');
    const redo = $('#toolbar [data-action="redo"]');
    if (undo) undo.disabled = !app.history.canUndo();
    if (redo) redo.disabled = !app.history.canRedo();
    $('#toolbar [data-action="playerView"]').classList.toggle('active', app.playerView);
    $('#toolbar [data-action="starMap"]').classList.toggle('active', !!app.starmap?.isOpen);
  }

  updateHud(sx, sy) {
    const app = this.app;
    const hud = $('#hud');
    if (sx === null || !app.world) {
      hud.replaceChildren();
      return;
    }
    const c = app.cellAtScreen(sx, sy);
    if (c < 0) {
      hud.replaceChildren();
      return;
    }
    const info = app.cellInfo(c);
    const lat = `${Math.abs(info.lat).toFixed(1)}°${info.lat >= 0 ? 'N' : 'S'}`;
    const lon = `${Math.abs(info.lon).toFixed(1)}°${info.lon >= 0 ? 'E' : 'W'}`;
    const rows = [
      h('div', {}, h('span', { class: 'k' }, `${lat} ${lon}`)),
      h('div', {}, h('span', { class: 'v' }, info.biome.name), info.region ? h('span', { class: 'k' }, ` / ${info.region.name}`) : null),
    ];
    if (info.elevation !== null) {
      rows.push(h('div', {}, h('span', { class: 'k' }, info.elevation >= 0 ? 'Elev ' : 'Depth '), `${Math.abs(info.elevation).toLocaleString()} m`, h('span', { class: 'k' }, '  Temp '), `${info.temperature}°C`));
    }
    fill(hud, ...rows);
  }

  updateMeasure() {
    const box = $('#measureBox');
    const app = this.app;
    const pts = app.measure.points.slice();
    if (app.tool !== 'measure' || pts.length === 0) {
      box.hidden = true;
      return;
    }
    if (app.measure.cursor) pts.push(app.measure.cursor);
    let rad = 0;
    for (let i = 1; i < pts.length; i++) rad += angleBetween(pts[i - 1], pts[i]);
    const km = rad * (app.planet.diameter / 2);
    box.hidden = false;
    fill(box,
      h('div', { class: 'total' }, formatDistance(km)),
      km > 0 ? h('div', { class: 'muted' }, TRAVEL.map((t) => `${t.name} ${formatDuration(km / t.kmh)}`).join('  /  ')) : h('div', { class: 'muted' }, 'Click a second point'),
    );
  }

  updateSaveStatus() {
    const el = $('#saveStatus');
    if (el) el.textContent = `Saved in this browser at ${this.app.store.lastSaved.toLocaleTimeString()}`;
  }

  toast(message, kind = 'info') {
    const el = $('#toast');
    el.textContent = message;
    el.className = `show ${kind === 'error' ? 'error' : ''}`;
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => { el.className = ''; }, kind === 'error' ? 5000 : 2200);
  }

  confirm(title, message, okText = 'OK', danger = false) {
    return confirmDialog(title, message, okText, danger);
  }
}

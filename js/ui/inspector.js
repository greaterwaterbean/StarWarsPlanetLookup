// The floating panel on the right: edit a place, or show info about a cell.

import { h, field, fill, $ } from './dom.js';
import { spriteDataURL } from '../render/sprites.js';
import { LOCATION_TYPES, getLocationType } from '../data/locationTypes.js';
import { rgbToHex } from '../data/biomes.js';
import { latLonToVec } from '../core/sphere.js';
import { findCell } from '../core/mesh.js';

function coordText(lat, lon) {
  return `${Math.abs(lat).toFixed(2)}°${lat >= 0 ? 'N' : 'S'}  ${Math.abs(lon).toFixed(2)}°${lon >= 0 ? 'E' : 'W'}`;
}

function closeButton(app) {
  return h('button', {
    class: 'icon-btn', icon: 'close', title: 'Close (Esc)',
    onclick: () => {
      app.selectedId = null;
      app.selectedCell = -1;
      app.ui.onSelectionChanged();
      app.requestRender();
    },
  });
}

function terrainUnder(app, loc) {
  const v = latLonToVec(loc.lat, loc.lon);
  const c = findCell(app.world.mesh, v[0], v[1], v[2], app.lastCell);
  return app.cellInfo(c);
}

export function renderInspector(app) {
  const el = $('#inspector');
  const loc = app.getLocation(app.selectedId);
  if (loc && !(app.playerView && loc.secret)) {
    el.hidden = false;
    fill(el, ...(app.playerView ? locationCard(app, loc) : locationEditor(app, loc)));
    return;
  }
  if (app.selectedCell >= 0 && app.world) {
    el.hidden = false;
    fill(el, ...cellCard(app, app.selectedCell));
    return;
  }
  el.hidden = true;
  el.replaceChildren();
}

function locationCard(app, loc) {
  const type = getLocationType(loc.type);
  const terrain = terrainUnder(app, loc);
  return [
    h('div', { class: 'head' }, h('img', { src: spriteDataURL(loc.type, 3), alt: '' }), h('div', { class: 'title' }, loc.name), closeButton(app)),
    h('div', { class: 'muted' }, type.name),
    h('div', { class: 'coords' }, coordText(loc.lat, loc.lon)),
    h('div', { class: 'small muted' }, `Terrain: ${terrain.biome.name}`),
    loc.notes ? h('p', { class: 'notes' }, loc.notes) : null,
    h('button', { class: 'btn small', icon: 'fly', onclick: () => app.flyTo(loc.lat, loc.lon, Math.max(app.camera.zoom, 3)) }, 'Fly here'),
  ];
}

function locationEditor(app, loc) {
  const rerenderHead = () => renderInspector(app);
  const terrain = terrainUnder(app, loc);

  const name = h('input', {
    type: 'text', name: 'name', value: loc.name, 'aria-label': 'Place name',
    oninput: (e) => {
      app.beginEdit();
      loc.name = e.target.value;
      app.requestRender(false);
    },
    onchange: () => {
      app.commitEdit();
      app.ui.renderPlaces();
    },
    onkeydown: (e) => { if (e.key === 'Enter') e.target.blur(); },
  });

  const type = h('select', {
    'aria-label': 'Place type',
    onchange: (e) => {
      app.edit(() => { loc.type = e.target.value; });
      app.lastLocationType = e.target.value;
      app.store.setSetting('lastLocationType', e.target.value);
      app.requestRender(false);
      app.ui.renderPlaces();
      rerenderHead();
    },
  }, LOCATION_TYPES.map((t) => h('option', { value: t.id, selected: t.id === loc.type }, t.name)));

  const textArea = (key, placeholder) => h('textarea', {
    placeholder,
    oninput: (e) => { app.beginEdit(); loc[key] = e.target.value; },
    onchange: () => app.commitEdit(),
  }, loc[key] || '');

  const secret = h('label', { class: 'toggle' },
    h('input', {
      type: 'checkbox', checked: loc.secret,
      onchange: (e) => {
        app.edit(() => { loc.secret = e.target.checked; });
        app.requestRender(false);
        app.ui.renderPlaces();
      },
    }),
    'Secret (hidden in player view)',
  );

  return [
    h('div', { class: 'head' }, h('img', { src: spriteDataURL(loc.type, 3), alt: '' }), h('div', { class: 'title' }, 'Place'), closeButton(app)),
    field('Name', name),
    field('Type', type),
    field('Description (players see this)', textArea('notes', 'What is here?')),
    field('GM notes', textArea('gmNotes', 'Only you see these')),
    secret,
    h('div', { class: 'coords' }, coordText(loc.lat, loc.lon)),
    h('div', { class: 'small muted' }, `Terrain: ${terrain.biome.name}${terrain.elevation !== null ? `, ${terrain.elevation.toLocaleString()} m` : ''}`),
    h('p', { class: 'small muted' }, 'Drag the icon on the globe to move it.'),
    h('div', { class: 'row' },
      h('button', { class: 'btn small', icon: 'fly', onclick: () => app.flyTo(loc.lat, loc.lon, Math.max(app.camera.zoom, 3)) }, 'Fly here'),
      h('button', { class: 'btn small danger', icon: 'trash', onclick: () => app.deleteLocation(loc.id) }, 'Delete'),
    ),
  ];
}

function cellCard(app, c) {
  const info = app.cellInfo(c);
  const rows = [
    ['Terrain', info.biome.name],
    ['Position', coordText(info.lat, info.lon)],
  ];
  if (info.elevation !== null) {
    rows.push([info.elevation >= 0 ? 'Elevation' : 'Depth', `${Math.abs(info.elevation).toLocaleString()} m`]);
    rows.push(['Temperature', `about ${info.temperature}°C`]);
    rows.push(['Moisture', `${info.moisture}%`]);
  }
  if (info.region) rows.push(['Region', info.region.name]);
  if (info.edited) rows.push(['Painted', 'yes']);
  rows.push(['Cell', `#${c}`]);

  const xyz = app.world.mesh.xyz;
  return [
    h('div', { class: 'head' },
      h('span', { class: 'swatch', style: { width: '22px', height: '22px', background: rgbToHex(...info.color) } }),
      h('div', { class: 'title' }, info.biome.name),
      closeButton(app),
    ),
    h('dl', {}, rows.map(([k, v]) => [h('dt', {}, k), h('dd', {}, v)])),
    h('div', { class: 'spacer' }),
    h('div', { class: 'row gm-only', style: { flexWrap: 'wrap' } },
      h('button', {
        class: 'btn small', icon: 'addPin',
        onclick: () => app.addLocationAt([xyz[c * 3], xyz[c * 3 + 1], xyz[c * 3 + 2]]),
      }, 'Add place here'),
      h('button', {
        class: 'btn small', icon: 'brush',
        onclick: () => {
          app.paint.mode = 'biome';
          app.paint.biome = info.biome.id;
          app.setTool('paint');
          app.ui.renderPaint();
        },
      }, 'Paint with this'),
    ),
  ];
}

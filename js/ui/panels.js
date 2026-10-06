// Sidebar panels. Each render function rebuilds its panel from the app state.

import { h, field, fill, download, slug } from './dom.js';
import { openNewPlanetDialog } from './dialogs.js';
import { requestThumbnail } from '../render/thumbnails.js';
import { spriteDataURL } from '../render/sprites.js';
import { allTypes, getType, getCustomTypes, setCustomTypes, validateType, isBuiltInType } from '../core/types.js';
import { RESOLUTIONS } from '../core/generator.js';
import { randomSeed } from '../core/rng.js';
import { GEN_PARAMS, DEFAULT_GEN, CUSTOM_TYPE_TEMPLATE } from '../data/planetTypes.js';
import { REGIONS } from '../data/canonPlanets.js';
import { STAR_MAPS } from '../data/starMaps.js';
import { BIOMES, rgbToHex } from '../data/biomes.js';
import { LOCATION_TYPES, getLocationType } from '../data/locationTypes.js';

const BLANK = 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==';

// ======================= Planets =======================

export function renderPlanetsPanel(el, app) {
  const list = h('div', { class: 'planet-list' });
  const search = h('input', {
    type: 'search',
    placeholder: 'Search planets, regions, types',
    value: app.ui.planetQuery,
    'aria-label': 'Search planets',
    oninput: (e) => { app.ui.planetQuery = e.target.value; renderList(); },
  });
  fill(el,
    h('div', { class: 'stack' },
      h('div', { class: 'row' },
        h('button', { class: 'btn primary grow gm-only', icon: 'plus', onclick: () => openNewPlanetDialog(app) }, 'New planet'),
        STAR_MAPS.length ? h('button', { class: 'btn grow', icon: 'map', onclick: () => { app.starmap.toggle(); app.ui.closeMobileMenu(); } }, 'Star map (S)') : null,
      ),
      search,
    ),
    h('div', { class: 'spacer' }),
    list,
  );

  function mapButton(label, onclick) {
    return h('button', {
      class: 'btn small map-link', icon: 'map', title: `Open ${label} on the star map`,
      onclick: (e) => {
        e.preventDefault();
        e.stopPropagation();
        onclick();
        app.ui.closeMobileMenu();
      },
    }, 'Map');
  }

  function renderList() {
    const q = app.ui.planetQuery.trim().toLowerCase();
    const planets = app.store.listPlanets().filter((p) => {
      if (!q) return true;
      return [p.name, p.region, p.sector, getType(p.typeId).name].some((s) => String(s || '').toLowerCase().includes(q));
    });
    const groups = new Map();
    for (const p of planets) {
      if (!groups.has(p.region)) groups.set(p.region, []);
      groups.get(p.region).push(p);
    }
    const order = [...REGIONS, ...[...groups.keys()].filter((r) => !REGIONS.includes(r)).sort()];
    list.replaceChildren();
    for (const region of order) {
      const items = groups.get(region);
      if (!items) continue;
      const map = STAR_MAPS.find((m) => m.name === region);
      // Sectors inside the region; planets without one go last.
      const bySector = new Map();
      for (const p of items) {
        const key = p.sector || '';
        if (!bySector.has(key)) bySector.set(key, []);
        bySector.get(key).push(p);
      }
      const sectors = [...bySector.keys()].sort((a, b) => (a === '') - (b === '') || a.localeCompare(b));
      const open = !!q || app.ui.expanded.has(region);
      const details = h('details', { class: 'planet-group', open },
        h('summary', { class: 'planet-group-title' },
          h('span', {}, region),
          h('span', { class: 'count' }, String(items.length)),
          map ? mapButton(region, () => app.starmap.open(map.id)) : null,
        ),
        sectors.map((sector) => {
          const ps = bySector.get(sector).sort((a, b) => a.name.localeCompare(b.name));
          const area = sector && map ? (map.areas || []).find((a) => a.name === sector) : null;
          return [
            sector || sectors.length > 1 ? h('div', { class: 'sector-title' },
              h('span', {}, sector || 'Elsewhere'),
              area ? mapButton(sector, () => app.starmap.open(map.id, { area: area.id })) : null,
            ) : null,
            ps.map((pl) => planetItem(pl)),
          ];
        }),
      );
      details.addEventListener('toggle', () => {
        if (q) return;
        if (details.open) app.ui.expanded.add(region);
        else app.ui.expanded.delete(region);
      });
      list.append(details);
    }
    if (!planets.length) list.append(h('p', { class: 'muted' }, 'No planets match.'));
  }

  function planetItem(p) {
    const img = h('img', { class: 'thumb', src: BLANK, alt: '' });
    requestThumbnail(p, 48, (url) => { img.src = url; });
    const chips = h('span', { class: 'chips' });
    if (!p.canon) chips.append(h('span', { class: 'chip custom' }, 'custom'));
    else if (app.store.isModified(p.id)) chips.append(h('span', { class: 'chip edited' }, 'edited'));
    return h('button', {
      class: `planet-item${app.planet && p.id === app.planet.id ? ' active' : ''}`,
      dataset: { id: p.id },
      onclick: () => {
        app.selectPlanet(p.id);
        app.ui.closeMobileMenu();
      },
    },
      img,
      h('div', { class: 'grow' },
        h('div', { class: 'name' }, p.name),
        h('div', { class: 'meta' }, `${getType(p.typeId).name} `, chips),
      ),
    );
  }

  renderList();
}

// ======================= Planet =======================

function fmt(v, step) {
  return step >= 1 ? String(Math.round(v)) : (+v).toFixed(2);
}

function typeCurrent(app, type) {
  const img = h('img', { src: BLANK, alt: '' });
  requestThumbnail({ typeId: type.id, seed: `type-${type.id}`, params: {} }, 72, (url) => { img.src = url; });
  return h('div', { class: 'type-current' },
    img,
    h('div', {},
      h('div', { class: 'name' }, type.name),
      h('div', { class: 'small' }, type.description),
      type.examples ? h('div', { class: 'small muted' }, `Like: ${type.examples}`) : null,
    ),
  );
}

export function typeGrid(selectedId, onPick) {
  return h('div', { class: 'type-grid' }, allTypes().map((t) => {
    const img = h('img', { src: BLANK, alt: '' });
    requestThumbnail({ typeId: t.id, seed: `type-${t.id}`, params: {} }, 64, (url) => { img.src = url; });
    return h('button', {
      type: 'button',
      class: `type-card${t.id === selectedId ? ' active' : ''}`,
      title: `${t.description}${t.examples ? `\nLike: ${t.examples}` : ''}`,
      onclick: () => onPick(t.id),
    }, img, t.name);
  }));
}

export function renderPlanetPanel(el, app) {
  const p = app.planet;
  if (!p) return;
  const type = getType(p.typeId);
  const gen = app.world.gen;
  const style = gen.style;

  // Players see a read-only summary.
  const summary = h('div', { class: 'player-only' },
    h('h2', {}, p.name),
    h('p', { class: 'muted' }, [p.region, p.sector, type.name, `${p.diameter.toLocaleString()} km`].filter(Boolean).join(' / ')),
    p.description ? h('p', {}, p.description) : null,
  );

  // A direct link to this planet, and its spot on the star map.
  const links = h('div', { class: 'row', style: { flexWrap: 'wrap', marginBottom: '10px' } },
    h('button', {
      class: 'btn small', icon: 'link', title: 'Copy a link that opens this planet directly',
      onclick: async () => {
        const url = app.planetLink();
        try {
          await navigator.clipboard.writeText(url);
          app.toast('Link copied');
        } catch {
          window.prompt('Copy this link:', url);
        }
      },
    }, 'Copy link'),
    p.map && STAR_MAPS.some((m) => m.id === p.map.id) ? h('button', {
      class: 'btn small', icon: 'map',
      onclick: () => app.starmap.open(p.map.id, { planetId: p.id }),
    }, 'Show on star map') : null,
  );
  const origin = p.origin ? h('p', { class: 'small muted' }, `Source: ${p.origin}`) : null;

  const textInput = (key, props = {}) => h('input', {
    type: 'text',
    value: p[key],
    ...props,
    oninput: (e) => {
      app.beginEdit();
      p[key] = e.target.value;
      if (key === 'name') {
        app.ui.updateTitle();
        app.ui.refreshPlanetListItem();
      }
    },
    onchange: () => app.commitEdit(),
  });
  const textArea = (key, placeholder) => h('textarea', {
    placeholder,
    oninput: (e) => { app.beginEdit(); p[key] = e.target.value; },
    onchange: () => app.commitEdit(),
  }, p[key] || '');

  const regionOptions = REGIONS.includes(p.region) ? REGIONS : [...REGIONS, p.region];
  const regionSelect = h('select', {
    onchange: (e) => {
      app.edit(() => { p.region = e.target.value; });
      app.ui.updateTitle();
      app.ui.renderPlanets();
    },
  }, regionOptions.map((r) => h('option', { value: r, selected: r === p.region }, r)));

  const diameter = h('input', {
    type: 'number', min: 100, step: 10, value: p.diameter,
    onchange: (e) => {
      const v = Math.max(100, Math.round(+e.target.value || 10000));
      app.edit(() => { p.diameter = v; });
      app.ui.updateMeasure();
    },
  });

  // Type picker.
  const gallery = h('div', { hidden: true }, typeGrid(p.typeId, (id) => app.setType(id)));
  const typeSection = h('div', {},
    typeCurrent(app, type),
    h('div', { class: 'spacer' }),
    h('button', {
      class: 'btn block',
      onclick: (e) => {
        gallery.hidden = !gallery.hidden;
        e.currentTarget.textContent = gallery.hidden ? 'Change planet type' : 'Hide planet types';
      },
    }, 'Change planet type'),
    h('div', { class: 'spacer' }),
    gallery,
  );

  // Seed.
  const seedInput = h('input', {
    type: 'text', value: String(p.seed), 'aria-label': 'Seed',
    onchange: (e) => {
      const raw = e.target.value.trim();
      app.setSeed(/^\d+$/.test(raw) ? Number(raw) : raw || randomSeed());
    },
  });
  const seedRow = h('div', { class: 'row' },
    h('div', { class: 'grow' }, seedInput),
    h('button', {
      class: 'icon-btn', icon: 'dice', title: 'Random seed',
      onclick: () => {
        const s = randomSeed();
        seedInput.value = String(s);
        app.setSeed(s);
      },
    }),
  );

  const resolution = h('select', {
    onchange: (e) => app.setCells(+e.target.value),
  }, RESOLUTIONS.map((r) => h('option', { value: r.cells, selected: r.cells === p.cells }, r.label)));

  // Sliders.
  const sliders = GEN_PARAMS.filter((d) => !d.styles || d.styles.includes(style)).map((def) => {
    const typeVal = type.gen?.[def.key] ?? DEFAULT_GEN[def.key];
    const cur = p.params[def.key] ?? typeVal;
    const val = h('span', { class: 'val' }, fmt(cur, def.step));
    const top = h('div', { class: `top${def.key in p.params ? ' changed' : ''}` },
      h('span', { class: 'name', title: `${def.hint}. Double-click to reset.` }, def.label),
      val,
    );
    const input = h('input', {
      type: 'range', min: def.min, max: def.max, step: def.step, value: cur, 'aria-label': def.label,
      oninput: (e) => {
        app.beginEdit();
        p.params[def.key] = +e.target.value;
        val.textContent = fmt(+e.target.value, def.step);
        top.classList.add('changed');
        app.scheduleRefresh();
      },
      onchange: () => app.commitEdit(),
    });
    top.addEventListener('dblclick', () => {
      app.edit(() => { delete p.params[def.key]; });
      input.value = typeVal;
      val.textContent = fmt(typeVal, def.step);
      top.classList.remove('changed');
      app.refresh();
    });
    return h('div', { class: 'slider-row', title: def.hint }, top, input);
  });

  // Colors.
  const atmosphereOn = gen.atmosphere !== null && gen.atmosphere !== undefined;
  const atmColor = h('input', {
    type: 'color', value: gen.atmosphere || '#8fc6ff', disabled: !atmosphereOn,
    oninput: (e) => { app.beginEdit(); p.params.atmosphere = e.target.value; app.scheduleRefresh(); },
    onchange: () => app.commitEdit(),
  });
  const atmToggle = h('input', {
    type: 'checkbox', checked: atmosphereOn,
    onchange: (e) => {
      app.edit(() => { p.params.atmosphere = e.target.checked ? atmColor.value : null; });
      atmColor.disabled = !e.target.checked;
      app.refresh();
    },
  });
  const cloudColor = h('input', {
    type: 'color', value: gen.cloudColor || '#ffffff',
    oninput: (e) => { app.beginEdit(); p.params.cloudColor = e.target.value; app.scheduleRefresh(); },
    onchange: () => app.commitEdit(),
  });

  const stats = h('div', { id: 'planetStats' });

  const gm = h('div', { class: 'gm-only' },
    h('h2', {}, 'Planet'),
    field('Name', textInput('name', { 'aria-label': 'Planet name' })),
    h('div', { class: 'row' },
      h('div', { class: 'grow' }, field('Region', regionSelect)),
      h('div', { style: { width: '120px' } }, field('Diameter (km)', diameter)),
    ),
    field('Sector', h('input', {
      type: 'text', value: p.sector || '', placeholder: 'e.g. Bootana Hutta', 'aria-label': 'Sector',
      oninput: (e) => { app.beginEdit(); p.sector = e.target.value; },
      onchange: () => { app.commitEdit(); app.ui.updateTitle(); app.ui.renderPlanets(); },
    })),
    field('Description (players see this)', textArea('description', 'What travelers know about this world')),
    field('GM notes (hidden in player view)', textArea('gmNotes', 'Secrets, plot hooks, faction notes')),

    h('h2', {}, 'Planet type'),
    typeSection,

    h('h2', {}, 'Generation'),
    field('Seed', seedRow, 'Same type + same seed = same planet. Roll the dice for a new one.'),
    field('Detail', resolution, 'More cells = finer painting, slower drawing.'),
    sliders,
    h('div', { class: 'row', style: { gap: '14px', margin: '6px 0 10px' } },
      h('label', { class: 'toggle' }, atmToggle, 'Atmosphere', atmColor),
      h('label', { class: 'toggle' }, 'Clouds', cloudColor),
    ),
    h('button', { class: 'btn small', icon: 'reset', onclick: () => app.resetParams() }, 'Reset settings to type defaults'),
  );

  const actions = h('div', { class: 'gm-only' },
    h('h2', {}, 'Manage'),
    h('div', { class: 'row', style: { flexWrap: 'wrap' } },
      h('button', { class: 'btn small', icon: 'copy', onclick: () => app.duplicatePlanet() }, 'Duplicate'),
      p.canon && app.store.isModified(p.id) ? h('button', { class: 'btn small', icon: 'reset', onclick: () => app.resetPlanet() }, 'Reset to original') : null,
      h('button', { class: 'btn small danger', icon: 'trash', onclick: () => app.deletePlanet() }, 'Delete'),
    ),
  );

  fill(el, summary, links, origin, gm, h('h2', {}, 'Surface'), stats, actions);
  updatePlanetStats(app);
}

export function updatePlanetStats(app) {
  const el = document.getElementById('planetStats');
  if (!el || !app.world) return;
  const { stats, base } = app.world;
  fill(el,
    base.bands ? h('p', { class: 'small muted' }, 'Gas giant: no solid surface.') : h('p', { class: 'small' }, `${Math.round(stats.water * 100)}% water or liquid`),
    h('ul', { class: 'stats-list' }, stats.biomes.slice(0, 7).map((b) => h('li', {},
      h('span', { class: 'swatch', style: { background: rgbToHex(...app.world.biomeRGB[BIOMES.indexOf(b.biome)]) } }),
      b.biome.name,
      h('span', { class: 'pct' }, `${(b.share * 100).toFixed(b.share < 0.1 ? 1 : 0)}%`),
    ))),
  );
}

// ======================= Places =======================

export function renderPlacesPanel(el, app) {
  const p = app.planet;
  if (!p) return;
  const list = h('div', {});
  const search = h('input', {
    type: 'search', placeholder: 'Search places', value: app.ui.placeQuery, 'aria-label': 'Search places',
    oninput: (e) => { app.ui.placeQuery = e.target.value; renderList(); },
  });
  const typeFilter = h('select', {
    'aria-label': 'Filter by type',
    onchange: (e) => { app.ui.placeType = e.target.value; renderList(); },
  }, h('option', { value: '' }, 'All types'), LOCATION_TYPES.map((t) => h('option', { value: t.id, selected: t.id === app.ui.placeType }, t.name)));

  fill(el,
    h('h2', {}, `Places on ${p.name}`),
    h('button', { class: 'btn primary block gm-only', icon: 'addPin', onclick: () => app.setTool('add') }, 'Add a place (L)'),
    h('div', { class: 'spacer' }),
    h('div', { class: 'row' }, h('div', { class: 'grow' }, search), h('div', { style: { width: '130px' } }, typeFilter)),
    h('div', { class: 'spacer' }),
    list,
  );

  function renderList() {
    const q = app.ui.placeQuery.trim().toLowerCase();
    const items = app.visibleLocations()
      .filter((l) => !app.ui.placeType || l.type === app.ui.placeType)
      .filter((l) => !q || l.name.toLowerCase().includes(q) || (l.notes || '').toLowerCase().includes(q))
      .sort((a, b) => getLocationType(b.type).size - getLocationType(a.type).size || a.name.localeCompare(b.name));
    fill(list, ...items.map((l) => h('button', {
      class: `place-item${l.id === app.selectedId ? ' active' : ''}`,
      dataset: { id: l.id },
      onclick: () => {
        app.selectLocation(l.id, { fly: true });
        app.ui.closeMobileMenu();
      },
    },
      h('img', { src: spriteDataURL(l.type, 2), alt: '' }),
      h('div', { class: 'grow' }, h('div', {}, l.name || 'Unnamed'), h('div', { class: 'meta' }, getLocationType(l.type).name)),
      l.secret ? h('span', { class: 'secret' }, 'secret') : null,
    )));
    if (!items.length) {
      list.append(h('p', { class: 'muted' }, app.visibleLocations().length ? 'No places match.' : 'No places yet. Press L (or Add a place) and click on the planet.'));
    }
  }
  renderList();
}

// ======================= Paint =======================

const BIOME_GROUPS = [
  ['Water and liquids', ['deep_ocean', 'ocean', 'shallows', 'lagoon', 'sea_ice', 'murky_water', 'dark_sea', 'lava', 'magma']],
  ['Green', ['beach', 'grassland', 'plains', 'savanna', 'scrub', 'forest', 'dense_forest', 'conifer', 'giant_forest', 'jungle', 'swamp', 'swamp_forest', 'bog', 'marsh', 'highlands']],
  ['Dry', ['dunes', 'desert', 'red_sand', 'badlands', 'mesa', 'salt_flats', 'red_soil', 'wasteland']],
  ['Cold', ['tundra', 'snow', 'glacier', 'ice_field', 'ice_rock', 'crystal', 'crystal_dark']],
  ['Rock and volcanic', ['rock', 'snow_peaks', 'regolith', 'dust', 'crater', 'ash', 'basalt', 'obsidian', 'dark_rock', 'blood_rock']],
  ['Exotic and city', ['fungal', 'fungal_alt', 'fungal_grass', 'city', 'city_dense', 'city_spires', 'city_industrial', 'city_polar']],
  ['Gas giant', ['gas_1', 'gas_2', 'gas_3', 'gas_4', 'gas_5', 'gas_storm']],
];

const PAINT_MODES = [
  { id: 'biome', label: 'Biome', hint: 'Paint a terrain type' },
  { id: 'raise', label: 'Raise', hint: 'Raise land, or make islands' },
  { id: 'lower', label: 'Lower', hint: 'Lower land, or carve seas and lakes' },
  { id: 'smooth', label: 'Smooth', hint: 'Even out bumps' },
  { id: 'region', label: 'Region', hint: 'Paint territories and borders' },
  { id: 'erase', label: 'Erase', hint: 'Back to the generated terrain' },
];

export function renderPaintPanel(el, app) {
  const p = app.planet;
  if (!p) return;
  const paint = app.paint;
  const save = () => app.store.setSetting('paint', { mode: paint.mode, biome: paint.biome, size: paint.size, strength: paint.strength });

  const modes = h('div', { class: 'mode-grid' }, PAINT_MODES.map((m) => h('button', {
    class: `btn${paint.mode === m.id ? ' active' : ''}`,
    title: m.hint,
    onclick: () => {
      paint.mode = m.id;
      save();
      if (app.tool !== 'paint') app.setTool('paint');
      renderPaintPanel(el, app);
    },
  }, m.label)));

  const sizeVal = h('span', { class: 'val' }, `${paint.size.toFixed(1)}°`);
  const size = h('input', {
    type: 'range', min: 0.3, max: 15, step: 0.1, value: paint.size, 'aria-label': 'Brush size',
    oninput: (e) => { paint.size = +e.target.value; sizeVal.textContent = `${paint.size.toFixed(1)}°`; app.requestRender(false); },
    onchange: save,
  });
  const strVal = h('span', { class: 'val' }, paint.strength.toFixed(2));
  const strength = h('input', {
    type: 'range', min: 0.05, max: 1, step: 0.05, value: paint.strength, 'aria-label': 'Brush strength',
    oninput: (e) => { paint.strength = +e.target.value; strVal.textContent = paint.strength.toFixed(2); },
    onchange: save,
  });

  const brush = h('div', {},
    h('div', { class: 'slider-row' }, h('div', { class: 'top' }, h('span', {}, 'Brush size'), sizeVal), size),
    ['raise', 'lower', 'smooth'].includes(paint.mode) ? h('div', { class: 'slider-row' }, h('div', { class: 'top' }, h('span', {}, 'Strength'), strVal), strength) : null,
  );

  let detail;
  if (paint.mode === 'biome') {
    const current = BIOMES.find((b) => b.id === paint.biome) || BIOMES[0];
    detail = h('div', {},
      h('p', { class: 'small' }, 'Painting: ', h('b', {}, current.name)),
      BIOME_GROUPS.map(([title, ids]) => h('div', {},
        h('div', { class: 'biome-group-title' }, title),
        h('div', { class: 'biome-grid' }, ids.map((id) => {
          const idx = BIOMES.findIndex((b) => b.id === id);
          if (idx < 0) return null;
          return h('button', {
            class: `biome-swatch${id === paint.biome ? ' active' : ''}`,
            title: BIOMES[idx].name,
            'aria-label': BIOMES[idx].name,
            style: { background: rgbToHex(...app.world.biomeRGB[idx]) },
            onclick: () => {
              paint.biome = id;
              save();
              if (app.tool !== 'paint') app.setTool('paint');
              renderPaintPanel(el, app);
            },
          });
        })),
      )),
    );
  } else if (paint.mode === 'region') {
    detail = regionEditor(el, app);
  } else {
    detail = h('p', { class: 'small muted' }, PAINT_MODES.find((m) => m.id === paint.mode).hint + '.');
  }

  fill(el,
    h('h2', {}, 'Paint the surface'),
    h('p', { class: 'small muted' }, 'Pick a planet type in the Planet tab first, then paint the details here. Drag on the globe to paint; right-drag to rotate.'),
    modes,
    brush,
    detail,
    paint.mode !== 'region' ? regionsSummary(el, app) : null,
    h('h2', {}, 'Clean up'),
    h('button', { class: 'btn small danger', icon: 'trash', onclick: () => app.clearPainting() }, 'Clear painted terrain'),
  );
}

function regionsSummary(el, app) {
  return h('div', {},
    h('h2', {}, 'Regions'),
    h('p', { class: 'small muted' }, `${app.planet.regions.length} region${app.planet.regions.length === 1 ? '' : 's'}. Use Region mode to paint territories like Hutt Space or an Imperial sector.`),
  );
}

function regionEditor(el, app) {
  const p = app.planet;
  const paint = app.paint;
  const counts = app.world.regionCenters;
  const rows = p.regions.map((r, i) => {
    const active = paint.regionId === r.id;
    return h('div', { class: `region-item${active ? ' active' : ''}` },
      h('input', {
        type: 'radio', name: 'regionPick', checked: active, title: 'Paint this region',
        onchange: () => { paint.regionId = r.id; renderPaintPanel(el, app); },
      }),
      h('input', {
        type: 'color', value: r.color, title: 'Region color',
        oninput: (e) => { app.beginEdit(); r.color = e.target.value; app.requestRender(); },
        onchange: () => app.commitEdit(),
      }),
      h('input', {
        type: 'text', value: r.name, 'aria-label': 'Region name',
        onfocus: () => { paint.regionId = r.id; },
        oninput: (e) => { app.beginEdit(); r.name = e.target.value; app.requestRender(false); },
        onchange: () => app.commitEdit(),
      }),
      h('span', { class: 'count', title: 'Cells' }, String(counts[i]?.count ?? 0)),
      h('button', { class: 'icon-btn', icon: 'trash', title: 'Delete region', onclick: () => app.deleteRegion(r.id) }),
    );
  });
  return h('div', {},
    h('p', { class: 'small' }, 'Pick a region, then paint it on the globe.'),
    rows,
    h('div', { class: 'region-item' },
      h('input', {
        type: 'radio', name: 'regionPick', checked: paint.regionId === null, title: 'Erase regions',
        onchange: () => { paint.regionId = null; renderPaintPanel(el, app); },
      }),
      h('span', { class: 'small' }, 'Eraser (remove region)'),
    ),
    h('button', { class: 'btn small', icon: 'plus', onclick: () => app.addRegion() }, 'New region'),
  );
}

// ======================= View =======================

const LAYER_LIST = [
  ['shading', 'Sun shading', ''],
  ['relief', 'Terrain relief', ''],
  ['dither', 'Retro dithering', ''],
  ['clouds', 'Clouds', 'C'],
  ['atmosphere', 'Atmosphere glow', ''],
  ['coast', 'Coastlines', ''],
  ['grid', 'Cell grid', 'G'],
  ['regions', 'Regions', ''],
  ['graticule', 'Lat/lon lines', ''],
  ['markers', 'Place icons', ''],
  ['labels', 'Labels', ''],
  ['stars', 'Starfield', ''],
  ['spin', 'Slow spin', ''],
];

export function renderViewPanel(el, app) {
  const pxVal = h('span', { class: 'val' }, app.pixelSize === 1 ? '1 (smooth)' : String(app.pixelSize));
  const px = h('input', {
    type: 'range', min: 1, max: 8, step: 1, value: app.pixelSize, 'aria-label': 'Pixel size',
    oninput: (e) => {
      app.setPixelSize(+e.target.value);
      pxVal.textContent = app.pixelSize === 1 ? '1 (smooth)' : String(app.pixelSize);
    },
  });
  fill(el,
    h('h2', {}, 'Pixel size'),
    h('div', { class: 'slider-row' }, h('div', { class: 'top' }, h('span', {}, 'Screen pixels per map pixel'), pxVal), px),
    h('p', { class: 'small muted' }, 'Bigger = chunkier and faster. 1 = smooth. Press X to cycle.'),
    h('h2', {}, 'Layers'),
    LAYER_LIST.map(([key, label, shortcut]) => h('label', { class: 'toggle' },
      h('input', { type: 'checkbox', checked: !!app.layers[key], onchange: (e) => app.setLayer(key, e.target.checked) }),
      label,
      shortcut ? h('span', { class: 'key' }, shortcut) : null,
    )),
  );
}

// ======================= Data =======================

export function renderDataPanel(el, app) {
  const fileInput = h('input', {
    type: 'file', accept: '.json,application/json', hidden: true,
    onchange: async (e) => {
      const file = e.target.files[0];
      e.target.value = '';
      if (!file) return;
      try {
        const data = JSON.parse(await file.text());
        const res = app.store.importData(data, { overwrite: true });
        setCustomTypes(app.store.customTypes);
        app.store.saveNow();
        app.ui.renderPlanets();
        app.selectPlanet(app.planet.id, { keepCamera: true });
        app.toast(`Imported: ${res.added} new, ${res.replaced} replaced`);
      } catch (err) {
        app.toast(`Import failed: ${err.message}`, 'error');
      }
    },
  });

  const typesText = h('textarea', { class: 'code', spellcheck: 'false', 'aria-label': 'Custom planet types JSON' }, JSON.stringify(getCustomTypes(), null, 2));
  const typeErrors = h('ul', { class: 'error-list' });

  const saveTypes = () => {
    let list;
    try {
      list = JSON.parse(typesText.value || '[]');
    } catch (err) {
      fill(typeErrors, h('li', {}, `Not valid JSON: ${err.message}`));
      return;
    }
    if (!Array.isArray(list)) list = [list];
    const errors = [];
    const taken = allTypes().filter((t) => isBuiltInType(t.id)).map((t) => t.id);
    list.forEach((t) => {
      errors.push(...validateType(t, taken));
      if (t && t.id) taken.push(t.id);
    });
    if (errors.length) {
      fill(typeErrors, ...errors.map((e) => h('li', {}, e)));
      return;
    }
    typeErrors.replaceChildren();
    setCustomTypes(list);
    app.store.setCustomTypes(list);
    app.refresh();
    app.ui.renderPlanetPanel();
    app.toast(`Saved ${list.length} custom type${list.length === 1 ? '' : 's'}`);
  };

  const status = app.store.lastSaved
    ? `Saved in this browser at ${app.store.lastSaved.toLocaleTimeString()}`
    : app.storageAvailable ? 'Changes save automatically in this browser.' : 'Browser storage is blocked: export to keep your work.';

  fill(el,
    h('h2', {}, 'Save and backup'),
    h('p', { class: 'small', id: 'saveStatus' }, status),
    h('p', { class: 'small muted' }, 'Browser storage can be wiped by clearing site data. Export a file now and then.'),
    h('div', { class: 'stack' },
      h('button', {
        class: 'btn block', icon: 'disk',
        onclick: () => download(`${slug(app.planet.name)}.planet.json`, JSON.stringify(app.store.exportData([app.planet]), null, 2)),
      }, 'Export this planet'),
      h('button', {
        class: 'btn block', icon: 'disk',
        onclick: () => {
          const all = app.store.listPlanets().filter((p) => !p.canon || app.store.isModified(p.id));
          download(`planet-lookup-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(app.store.exportData(all), null, 2));
          app.toast(`Exported ${all.length} edited or custom planet${all.length === 1 ? '' : 's'}`);
        },
      }, 'Export all my planets'),
      h('button', { class: 'btn block', icon: 'plus', onclick: () => fileInput.click() }, 'Import from file'),
      h('button', { class: 'btn block', icon: 'image', onclick: () => app.exportImage() }, 'Save current view as PNG'),
      fileInput,
    ),

    foundrySection(app),

    h('h2', {}, 'Custom planet types'),
    h('p', { class: 'small muted' }, 'Add your own entries to the planet type database as JSON. Each needs an id, a name and biome rules (see README). Built-in types stay as they are.'),
    typesText,
    typeErrors,
    h('div', { class: 'row', style: { marginTop: '6px' } },
      h('button', {
        class: 'btn small',
        onclick: () => {
          let list = [];
          try { list = JSON.parse(typesText.value || '[]'); } catch { list = []; }
          if (!Array.isArray(list)) list = [list];
          const t = JSON.parse(JSON.stringify(CUSTOM_TYPE_TEMPLATE));
          t.id = `my_type_${list.length + 1}`;
          list.push(t);
          typesText.value = JSON.stringify(list, null, 2);
        },
      }, 'Insert template'),
      h('button', { class: 'btn small primary', onclick: saveTypes }, 'Save types'),
    ),

    h('h2', {}, 'Danger zone'),
    h('div', { class: 'stack' },
      app.store.data.deletedCanon.length ? h('button', {
        class: 'btn block',
        onclick: () => { app.store.restoreCanon(); app.ui.renderPlanets(); app.ui.renderData(); app.toast('Canon planets restored'); },
      }, `Restore ${app.store.data.deletedCanon.length} deleted canon planet(s)`) : null,
      h('button', {
        class: 'btn block danger', icon: 'trash',
        onclick: async () => {
          const ok = await app.ui.confirm('Erase everything?', 'All saved planets, places, painting and custom types in this browser will be deleted. Export first if unsure.', 'Erase all', true);
          if (!ok) return;
          app.store.eraseAll();
          setCustomTypes([]);
          app.planet = null;
          app.selectPlanet('tatooine');
          app.toast('All saved data erased');
        },
      }, 'Erase all saved data'),
    ),
  );
}

// Foundry VTT export options. Remembered between visits.
function foundrySection(app) {
  const saved = { width: 4096, pixel: 4, includeSecret: false, includeGmNotes: false, bakeLabels: false, folder: 'planet-lookup', embedGlobe: false, ...(app.store.settings.foundry || {}) };
  const online = /^https?:$/.test(location.protocol) && !/^(localhost|127\.|0\.0\.0\.0)/.test(location.hostname);
  const opts = { ...saved, globeUrl: online ? app.planetLink() : '' };
  const remember = () => {
    const { globeUrl, ...keep } = opts;
    app.store.setSetting('foundry', keep);
  };
  const select = (key, choices) => h('select', {
    onchange: (e) => { opts[key] = +e.target.value; remember(); },
  }, choices.map(([v, label]) => h('option', { value: v, selected: v === opts[key] }, label)));
  const check = (key, label) => h('label', { class: 'toggle' },
    h('input', { type: 'checkbox', checked: opts[key], onchange: (e) => { opts[key] = e.target.checked; remember(); } }),
    label,
  );
  const run = async (btn, fn) => {
    btn.disabled = true;
    const old = btn.textContent;
    btn.textContent = 'Working...';
    await new Promise((r) => setTimeout(r, 30));
    try {
      await fn();
      app.toast('Download started');
    } catch (err) {
      app.toast(`Export failed: ${err.message}`, 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = old;
    }
  };
  const pkgBtn = h('button', { class: 'btn primary block', icon: 'disk', onclick: () => run(pkgBtn, () => app.exportFoundry(opts)) }, 'Download Foundry package (.zip)');
  const pngBtn = h('button', { class: 'btn block', icon: 'image', onclick: () => run(pngBtn, () => app.exportFlatMap(opts)) }, 'Download flat map image only');
  return h('div', {},
    h('h2', {}, 'Foundry VTT (v12 to v14)'),
    h('p', { class: 'small muted' }, 'A zip with a flat map image, a Foundry scene with map notes for your places, a journal and the planet data. The README inside explains the import.'),
    h('div', { class: 'row' },
      h('div', { class: 'grow' }, field('Map width', select('width', [[2048, '2048 x 1024'], [4096, '4096 x 2048'], [8192, '8192 x 4096']]))),
      h('div', { class: 'grow' }, field('Pixel size', select('pixel', [[8, 'Chunky (8)'], [4, 'Pixel (4)'], [2, 'Fine (2)'], [1, 'Smooth (1)']]))),
    ),
    check('includeSecret', 'Include secret places (players will see them)'),
    check('includeGmNotes', 'Include GM notes in the journal'),
    check('bakeLabels', 'Draw place labels onto the image'),
    field('Foundry folder for the image', h('input', { type: 'text', value: opts.folder, oninput: (e) => { opts.folder = e.target.value; remember(); } })),
    field('Link to the interactive globe (optional)', h('input', { type: 'text', value: opts.globeUrl, placeholder: 'https://you.github.io/StarWarsPlanetLookup/#planet=...', oninput: (e) => { opts.globeUrl = e.target.value.trim(); } }),
      'Added to the journal. Fills in by itself when the app is hosted online, for example on GitHub Pages.'),
    check('embedGlobe', 'Also embed the globe in the journal'),
    h('div', { class: 'stack' }, pkgBtn, pngBtn),
  );
}

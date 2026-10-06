// Modal dialogs: new planet and confirmations.

import { h, field, fill, $ } from './dom.js';
import { typeGrid } from './panels.js';
import { REGIONS } from '../data/canonPlanets.js';
import { randomSeed } from '../core/rng.js';
import { getType } from '../core/types.js';

export function openNewPlanetDialog(app) {
  const dlg = $('#newPlanetDialog');
  let typeId = 'temperate';
  const name = h('input', { type: 'text', value: '', placeholder: 'e.g. Ord Sigatt', required: true, 'aria-label': 'Planet name' });
  const region = h('select', {}, REGIONS.map((r) => h('option', { value: r, selected: r === 'Homebrew' }, r)));
  const seed = h('input', { type: 'text', value: String(randomSeed()), 'aria-label': 'Seed' });
  const typeInfo = h('p', { class: 'small muted' });
  const gridHolder = h('div', {});

  const pick = (id) => {
    typeId = id;
    const t = getType(id);
    typeInfo.textContent = `${t.name}: ${t.description}`;
    fill(gridHolder, typeGrid(typeId, pick));
  };
  pick(typeId);

  const create = (e) => {
    e.preventDefault();
    const raw = seed.value.trim();
    app.createPlanet({
      name: name.value.trim() || 'New Planet',
      region: region.value,
      typeId,
      seed: /^\d+$/.test(raw) ? Number(raw) : raw || randomSeed(),
    });
    dlg.close();
  };

  fill(dlg, h('form', { onsubmit: create },
    h('h2', {}, 'New planet'),
    h('div', { class: 'row' },
      h('div', { class: 'grow' }, field('Name', name)),
      h('div', { style: { width: '180px' } }, field('Region', region)),
    ),
    h('div', { class: 'field-label' }, 'Planet type'),
    gridHolder,
    typeInfo,
    field('Seed', h('div', { class: 'row' },
      h('div', { class: 'grow' }, seed),
      h('button', { type: 'button', class: 'icon-btn', icon: 'dice', title: 'Random seed', onclick: () => { seed.value = String(randomSeed()); } }),
    ), 'You can tweak everything later in the Planet tab.'),
    h('div', { class: 'dialog-actions' },
      h('button', { type: 'button', class: 'btn', onclick: () => dlg.close() }, 'Cancel'),
      h('button', { type: 'submit', class: 'btn primary' }, 'Create planet'),
    ),
  ));
  dlg.showModal();
  name.focus();
}

export function confirmDialog(title, message, okText = 'OK', danger = false) {
  const dlg = $('#confirmDialog');
  return new Promise((resolve) => {
    const done = (value) => {
      dlg.close();
      resolve(value);
    };
    fill(dlg,
      h('h2', {}, title),
      h('p', {}, message),
      h('div', { class: 'dialog-actions' },
        h('button', { class: 'btn', onclick: () => done(false) }, 'Cancel'),
        h('button', { class: `btn ${danger ? 'danger' : 'primary'}`, onclick: () => done(true) }, okText),
      ),
    );
    dlg.addEventListener('cancel', () => resolve(false), { once: true });
    dlg.showModal();
  });
}

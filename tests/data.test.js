import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PLANET_TYPES, CUSTOM_TYPE_TEMPLATE } from '../js/data/planetTypes.js';
import { CANON_PLANETS, REGIONS } from '../js/data/canonPlanets.js';
import { BIOMES } from '../js/data/biomes.js';
import { LOCATION_TYPES, LOCATION_TYPE_MAP } from '../js/data/locationTypes.js';
import { validateType } from '../js/core/types.js';

test('biome ids are unique and colors are hex', () => {
  const ids = new Set();
  for (const b of BIOMES) {
    assert.ok(!ids.has(b.id), `duplicate biome ${b.id}`);
    ids.add(b.id);
    assert.match(b.color, /^#[0-9a-f]{6}$/i);
  }
  assert.ok(BIOMES.length < 256, 'biomes are stored in a Uint8Array');
});

test('every built-in planet type passes validation and ends with a catch-all rule', () => {
  const taken = [];
  for (const t of PLANET_TYPES) {
    assert.deepEqual(validateType(t, taken), [], t.id);
    taken.push(t.id);
    const last = t.rules[t.rules.length - 1];
    const keys = Object.keys(last).filter((k) => k !== 'biome');
    assert.deepEqual(keys, [], `${t.id}: last rule should match everything`);
  }
  assert.deepEqual(validateType(CUSTOM_TYPE_TEMPLATE, taken), []);
});

test('validation reports problems in custom types', () => {
  const bad = { id: 'Bad Id', name: '', rules: [{ biome: 'nope', h: [0] }] };
  const errors = validateType(bad);
  assert.ok(errors.length >= 3);
});

test('canon planets reference real types, regions and location types', () => {
  const ids = new Set();
  const typeIds = new Set(PLANET_TYPES.map((t) => t.id));
  for (const p of CANON_PLANETS) {
    assert.ok(!ids.has(p.id), `duplicate planet ${p.id}`);
    ids.add(p.id);
    assert.ok(typeIds.has(p.typeId), `${p.id} uses unknown type ${p.typeId}`);
    assert.ok(REGIONS.includes(p.region), `${p.id} has unknown region ${p.region}`);
    assert.ok(p.diameter > 0);
    for (const l of p.locations) {
      assert.ok(LOCATION_TYPE_MAP.has(l.type), `${p.id}/${l.name} has unknown type ${l.type}`);
      assert.ok(l.lat >= -90 && l.lat <= 90 && l.lon >= -180 && l.lon <= 180, `${p.id}/${l.name} has bad coordinates`);
    }
  }
});

test('location sprites are 9x9 and use only known characters', () => {
  for (const t of LOCATION_TYPES) {
    assert.equal(t.sprite.length, 9, t.id);
    for (const row of t.sprite) assert.match(row, /^[.#+]{9}$/, `${t.id}: "${row}"`);
  }
});

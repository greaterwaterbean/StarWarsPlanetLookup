import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildWorld, refreshWorld, deriveWorld } from '../js/core/generator.js';
import { PLANET_TYPES } from '../js/data/planetTypes.js';
import { BIOMES } from '../js/data/biomes.js';

const planet = (over = {}) => ({ id: 't', typeId: 'temperate', seed: 'test', cells: 5000, params: {}, edits: { h: {}, b: {}, r: {} }, regions: [], ...over });

test('same seed and type always build the same planet', () => {
  const a = buildWorld(planet(), { cache: false });
  const b = buildWorld(planet(), { cache: false });
  assert.deepEqual(Array.from(a.biome), Array.from(b.biome));
  assert.deepEqual(Array.from(a.h), Array.from(b.h));
});

test('different seeds build different planets', () => {
  const a = buildWorld(planet({ seed: 'one' }), { cache: false });
  const b = buildWorld(planet({ seed: 'two' }), { cache: false });
  let diff = 0;
  for (let i = 0; i < a.N; i++) if (a.biome[i] !== b.biome[i]) diff++;
  assert.ok(diff > a.N * 0.2, `only ${diff} cells differ`);
});

test('sea level setting controls how much of the planet is underwater', () => {
  for (const seaLevel of [0, 0.3, 0.7]) {
    const w = buildWorld(planet({ params: { seaLevel } }), { cache: false });
    let below = 0;
    for (let i = 0; i < w.N; i++) if (w.h[i] < 0) below++;
    assert.ok(Math.abs(below / w.N - seaLevel) < 0.01, `seaLevel ${seaLevel} gave ${(below / w.N).toFixed(3)}`);
  }
});

test('every planet type generates valid biomes', () => {
  for (const type of PLANET_TYPES) {
    const w = buildWorld(planet({ typeId: type.id, seed: type.id }), { cache: false });
    for (let i = 0; i < w.N; i++) assert.ok(w.biome[i] < BIOMES.length);
    assert.ok(w.stats.biomes.length >= 2, `${type.id} produced only one biome`);
    for (let i = 0; i < w.N * 3; i++) assert.ok(Number.isFinite(w.grad[i]), `${type.id} has a bad gradient`);
  }
});

test('painted edits override the generated terrain', () => {
  const p = planet();
  const w = buildWorld(p, { cache: false });
  p.edits.b[10] = 'lava';
  p.edits.h[20] = 0.9;
  p.regions = [{ id: 'r1', name: 'Hutt Space', color: '#ff0000' }];
  p.edits.r[30] = 'r1';
  deriveWorld(w);
  assert.equal(BIOMES[w.biome[10]].id, 'lava');
  assert.ok(Math.abs(w.h[20] - 0.9) < 1e-6);
  assert.equal(w.region[30], 0);
  assert.equal(w.regionCenters[0].count, 1);
});

test('changing settings and refreshing updates the world in place', () => {
  const p = planet();
  const w = buildWorld(p);
  const before = Array.from(w.biome);
  p.params.temperature = 1;
  refreshWorld(w);
  let diff = 0;
  for (let i = 0; i < w.N; i++) if (w.biome[i] !== before[i]) diff++;
  assert.ok(diff > 0);
});

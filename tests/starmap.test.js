import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STAR_MAPS, BOOTANA_SLOTS, grid } from '../js/data/starMaps.js';
import { CANON_PLANETS } from '../js/data/canonPlanets.js';
import { HUTT_SPACE_PLANETS } from '../js/data/huttSpace.js';

const huttMap = STAR_MAPS.find((m) => m.id === 'hutt-space');

test('grid squares convert to map positions', () => {
  assert.deepEqual(grid('S-11', 0, 0), [300, 600]);
  assert.deepEqual(grid('T-12', 1, 1), [1200, 1500]);
  assert.equal(grid('nonsense'), null);
});

test('every Hutt Space planet is placed on the star map', () => {
  for (const p of HUTT_SPACE_PLANETS) {
    assert.ok(p.map && p.map.id === 'hutt-space', `${p.id} has no map`);
    assert.ok(Number.isFinite(p.map.x) && Number.isFinite(p.map.y), `${p.id} has no position`);
    assert.equal(p.region, 'Hutt Space', p.id);
  }
});

test('planet ids are unique across all built-in planets', () => {
  const seen = new Set();
  for (const p of CANON_PLANETS) {
    assert.ok(!seen.has(p.id), `duplicate id ${p.id}`);
    seen.add(p.id);
  }
});

test('no two Hutt Space worlds sit on top of each other', () => {
  const pts = HUTT_SPACE_PLANETS.map((p) => [p.id, p.map.x, p.map.y]);
  for (let i = 0; i < pts.length; i++) {
    for (let j = i + 1; j < pts.length; j++) {
      const d = Math.hypot(pts[i][1] - pts[j][1], pts[i][2] - pts[j][2]);
      assert.ok(d > 8, `${pts[i][0]} and ${pts[j][0]} overlap`);
    }
  }
});

test('every lane stop and area member names something on the map', () => {
  const ids = new Set([
    ...HUTT_SPACE_PLANETS.map((p) => p.id),
    ...huttMap.systems.map((s) => s.id),
    ...huttMap.features.map((f) => f.id),
  ]);
  for (const lane of huttMap.lanes) {
    for (const stop of lane.path) {
      if (typeof stop === 'string') assert.ok(ids.has(stop), `lane "${lane.name || '(unnamed)'}" names unknown stop "${stop}"`);
      else assert.ok(Array.isArray(stop) && stop.length === 2 && stop.every(Number.isFinite), `lane "${lane.name}" has a bad point`);
    }
  }
  for (const area of huttMap.areas) {
    for (const m of area.members || []) assert.ok(ids.has(m), `area ${area.id} names unknown member ${m}`);
  }
});

test('the numbered Bootana Hutta dots all name real worlds in Bootana Hutta', () => {
  const byId = new Map(HUTT_SPACE_PLANETS.map((p) => [p.id, p]));
  for (const [n, id] of Object.entries(BOOTANA_SLOTS)) {
    assert.ok(byId.has(id), `dot ${n} names unknown world ${id}`);
    assert.equal(byId.get(id).sector, 'Bootana Hutta', `dot ${n} (${id}) is not in Bootana Hutta`);
  }
});

test('every area is used by at least one planet', () => {
  for (const area of huttMap.areas) {
    const used = HUTT_SPACE_PLANETS.some((p) => p.sector === area.name || p.map.area === area.id) || (area.members || []).length > 0;
    assert.ok(used, `area ${area.id} is empty`);
  }
});

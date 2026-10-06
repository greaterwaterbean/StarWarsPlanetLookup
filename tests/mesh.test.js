import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildMesh, findCell, cellsWithin } from '../js/core/mesh.js';
import { mulberry32 } from '../js/core/rng.js';

test('mesh is a full triangulation of the sphere (Euler: E = 3V - 6)', () => {
  for (const n of [500, 4000, 20000]) {
    const mesh = buildMesh(n, 7);
    assert.equal(mesh.edgeCount, 3 * n - 6, `edge count for n=${n}`);
  }
});

test('neighbor lists are symmetric and every cell has at least 3 neighbors', () => {
  const mesh = buildMesh(3000, 3);
  for (let c = 0; c < mesh.count; c++) {
    const deg = mesh.offsets[c + 1] - mesh.offsets[c];
    assert.ok(deg >= 3, `cell ${c} has only ${deg} neighbors`);
    for (let k = mesh.offsets[c]; k < mesh.offsets[c + 1]; k++) {
      const nb = mesh.adj[k];
      const back = Array.from(mesh.adj.subarray(mesh.offsets[nb], mesh.offsets[nb + 1]));
      assert.ok(back.includes(c), `edge ${c}-${nb} is one-way`);
    }
  }
});

test('greedy walk finds the true nearest cell', () => {
  const mesh = buildMesh(5000, 11);
  const random = mulberry32(99);
  let start = 0;
  for (let t = 0; t < 2000; t++) {
    const z = random() * 2 - 1;
    const a = random() * Math.PI * 2;
    const r = Math.sqrt(1 - z * z);
    const x = Math.cos(a) * r, y = Math.sin(a) * r;
    let best = -1, bestD = -Infinity;
    for (let c = 0; c < mesh.count; c++) {
      const d = mesh.xyz[c * 3] * x + mesh.xyz[c * 3 + 1] * y + mesh.xyz[c * 3 + 2] * z;
      if (d > bestD) { bestD = d; best = c; }
    }
    const found = findCell(mesh, x, y, z, start);
    const foundD = mesh.xyz[found * 3] * x + mesh.xyz[found * 3 + 1] * y + mesh.xyz[found * 3 + 2] * z;
    assert.ok(Math.abs(foundD - bestD) < 1e-6, `walk ended at ${found}, nearest is ${best}`);
    start = found;
  }
});

test('cellsWithin returns cells inside the radius only', () => {
  const mesh = buildMesh(4000, 5);
  const center = [0, 0, 1];
  const radius = 0.2;
  const cells = cellsWithin(mesh, center, radius);
  assert.ok(cells.length > 10);
  for (const c of cells) assert.ok(mesh.xyz[c * 3 + 2] >= Math.cos(radius) - 1e-6);
});

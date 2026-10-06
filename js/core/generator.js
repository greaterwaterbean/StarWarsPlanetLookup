// Planet generation.
//
// The pipeline runs in two stages so editing feels fast:
//   1. base:   expensive noise sampling (elevation, temperature/moisture noise).
//              Only depends on the seed and the shape settings, so it is cached.
//   2. derive: cheap per-cell math: sea level, temperature, moisture, biome rules,
//              your painted edits, colors and shading. Re-run on every brush stroke.

import { createNoise3D, fbm, ridged } from './noise.js';
import { mulberry32, toSeed } from './rng.js';
import { getMesh } from './mesh.js';
import { clamp } from './sphere.js';
import { getType } from './types.js';
import { BIOMES, BIOME_INDEX, hexToRgb } from '../data/biomes.js';
import { DEFAULT_GEN } from '../data/planetTypes.js';

export const RESOLUTIONS = [
  { cells: 5000, label: 'Low (5k cells)' },
  { cells: 10000, label: 'Medium (10k cells)' },
  { cells: 20000, label: 'High (20k cells)' },
  { cells: 40000, label: 'Very high (40k cells)' },
  { cells: 80000, label: 'Ultra (80k cells)' },
];
export const DEFAULT_CELLS = 20000;
export const CLOUD_RES = 128;

const BASE_KEYS = ['style', 'scale', 'roughness', 'warp', 'mountains', 'craters', 'bands', 'storms'];
const baseCache = new Map();
const cloudCache = new Map();

// Planet settings win over type settings, which win over the defaults.
export function resolveGen(type, planet) {
  const gen = { ...DEFAULT_GEN, ...(type.gen || {}) };
  const params = planet.params || {};
  for (const key of Object.keys(params)) {
    const v = params[key];
    if (key === 'atmosphere' || key === 'cloudColor' || key === 'style') gen[key] = v;
    else if (Number.isFinite(v)) gen[key] = v;
  }
  return gen;
}

export function buildWorld(planet, options = {}) {
  const mesh = getMesh(planet.cells || DEFAULT_CELLS);
  const N = mesh.count;
  const world = {
    planet,
    mesh,
    N,
    h: new Float32Array(N),
    t: new Float32Array(N),
    m: new Float32Array(N),
    biome: new Uint8Array(N),
    isWater: new Uint8Array(N),
    glow: new Uint8Array(N),
    region: new Int16Array(N),
    rgb: new Uint8Array(N * 3),
    grad: new Float32Array(N * 3),
    dist: new Int32Array(N),
    queue: new Int32Array(N),
    useCache: options.cache !== false,
  };
  refreshWorld(world);
  return world;
}

// Re-read the planet's type and settings and update everything that changed.
export function refreshWorld(world) {
  const planet = world.planet;
  world.type = getType(planet.typeId);
  world.gen = resolveGen(world.type, planet);
  world.seed = toSeed(planet.seed);
  world.base = getBase(world.mesh, world.seed, world.gen, world.useCache);
  world.clouds = getClouds(world.seed, world.gen.clouds, world.useCache);
  deriveWorld(world);
  return world;
}

function getBase(mesh, seed, gen, useCache = true) {
  if (!useCache) return computeBase(mesh, seed, gen);
  const key = [mesh.count, seed, ...BASE_KEYS.map((k) => gen[k])].join('|');
  if (baseCache.has(key)) {
    const hit = baseCache.get(key);
    baseCache.delete(key);
    baseCache.set(key, hit);
    return hit;
  }
  const base = computeBase(mesh, seed, gen);
  baseCache.set(key, base);
  if (baseCache.size > 8) baseCache.delete(baseCache.keys().next().value);
  return base;
}

function smoothstep(a, b, x) {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
}

export function computeBase(mesh, seed, gen) {
  const N = mesh.count;
  const xyz = mesh.xyz;
  const random = mulberry32(seed);
  const nWarp = createNoise3D(random);
  const nBase = createNoise3D(random);
  const nRidge = createNoise3D(random);
  const nTemp = createNoise3D(random);
  const nMoist = createNoise3D(random);
  const nDetail = createNoise3D(random);

  const elev = new Float32Array(N);
  const tNoise = new Float32Array(N);
  const mNoise = new Float32Array(N);
  const detail = new Float32Array(N);
  const rand = new Float32Array(N);
  const bands = gen.style === 'bands';

  // Craters (terrain) or storms (gas giants) are random circles on the sphere.
  const spots = [];
  const spotCount = bands ? Math.round(gen.storms * 6) : Math.round(gen.craters * 45);
  for (let i = 0; i < spotCount; i++) {
    const z = bands ? (random() * 2 - 1) * 0.75 : random() * 2 - 1;
    const a = random() * Math.PI * 2;
    const r = Math.sqrt(1 - z * z);
    const size = bands ? 0.06 + random() * 0.12 : 0.03 + Math.pow(random(), 2) * 0.22;
    spots.push({ x: Math.cos(a) * r, y: Math.sin(a) * r, z, size, depth: 0.1 + random() * 0.2 });
  }

  const s = gen.scale;
  const gain = 0.35 + gen.roughness * 0.3;
  const ws = gen.warp * 0.35;

  for (let c = 0; c < N; c++) {
    const x = xyz[c * 3], y = xyz[c * 3 + 1], z = xyz[c * 3 + 2];
    rand[c] = random();
    tNoise[c] = fbm(nTemp, x * 2, y * 2, z * 2, 3);
    mNoise[c] = fbm(nMoist, x * 1.7 + 3.1, y * 1.7, z * 1.7, 4);

    if (bands) {
      // Gas giant: stripes by latitude, bent by noise so they swirl.
      const w = fbm(nWarp, x * 2, y * 2, z * 2, 4, 0.55);
      const k = gen.bands * 0.5;
      const v = 0.65 * Math.sin((z * k + w * gen.warp * 0.9) * Math.PI) + 0.35 * Math.sin((z * k * 2.3 + w * gen.warp * 1.4 + 0.7) * Math.PI);
      elev[c] = clamp(v + 0.15 * fbm(nBase, x * 6, y * 6, z * 6, 3), -1, 1);
      let storm = 0;
      for (const sp of spots) {
        const dz = z - sp.z;
        const dlon = Math.atan2(x * sp.y - y * sp.x, x * sp.x + y * sp.y);
        const d = Math.hypot(dlon * Math.sqrt(1 - sp.z * sp.z) * 0.5, dz) / sp.size;
        if (d < 1) storm = Math.max(storm, 1 - d * d);
      }
      detail[c] = storm;
      continue;
    }

    // Domain warping: nudge the sample point with more noise before sampling.
    const qx = x + ws * fbm(nWarp, x * 1.4 + 5.2, y * 1.4 + 1.3, z * 1.4 + 7.1, 3);
    const qy = y + ws * fbm(nWarp, x * 1.4 + 9.7, y * 1.4 + 2.8, z * 1.4 + 3.4, 3);
    const qz = z + ws * fbm(nWarp, x * 1.4 + 1.9, y * 1.4 + 8.3, z * 1.4 + 6.6, 3);

    let e = fbm(nBase, qx * s, qy * s, qz * s, 6, gain);
    if (gen.mountains > 0) {
      const r = ridged(nRidge, qx * s * 1.8, qy * s * 1.8, qz * s * 1.8, 5, 0.5);
      e += gen.mountains * 0.6 * r * r * smoothstep(-0.1, 0.35, e);
    }
    for (const sp of spots) {
      const d = Math.acos(clamp(x * sp.x + y * sp.y + z * sp.z, -1, 1)) / sp.size;
      if (d < 1.5) {
        const bowl = d < 1 ? -sp.depth * (1 - d * d) : 0;
        const rim = sp.depth * 0.4 * Math.exp(-((d - 1) * (d - 1)) / 0.04);
        e += bowl + rim;
      }
    }
    elev[c] = e;
    detail[c] = clamp(0.5 + 0.9 * fbm(nDetail, x * 4.5, y * 4.5, z * 4.5, 3), 0, 1);
  }

  const sorted = Float32Array.from(elev).sort();
  return { elev, tNoise, mNoise, detail, rand, sorted, min: sorted[0], max: sorted[N - 1], bands };
}

function getClouds(seed, coverage, useCache = true) {
  if (!(coverage > 0.005)) return null;
  if (!useCache) return computeClouds(seed, coverage);
  const key = `${seed}|${coverage.toFixed(3)}`;
  if (!cloudCache.has(key)) {
    cloudCache.set(key, computeClouds(seed, coverage));
    if (cloudCache.size > 8) cloudCache.delete(cloudCache.keys().next().value);
  }
  return cloudCache.get(key);
}

// Clouds live on a small cube map (6 square faces wrapped around the sphere),
// so the renderer can look them up without any trigonometry.
export function computeClouds(seed, coverage) {
  const S = CLOUD_RES;
  const random = mulberry32((seed ^ 0x9e3779b9) >>> 0);
  const noise = createNoise3D(random);
  const warp = createNoise3D(random);
  const raw = new Float32Array(6 * S * S);
  for (let f = 0; f < 6; f++) {
    for (let j = 0; j < S; j++) {
      for (let i = 0; i < S; i++) {
        const u = ((i + 0.5) / S) * 2 - 1;
        const v = ((j + 0.5) / S) * 2 - 1;
        let x, y, z;
        if (f === 0) { x = 1; y = u; z = v; }
        else if (f === 1) { x = -1; y = u; z = v; }
        else if (f === 2) { x = u; y = 1; z = v; }
        else if (f === 3) { x = u; y = -1; z = v; }
        else if (f === 4) { x = u; y = v; z = 1; }
        else { x = u; y = v; z = -1; }
        const len = Math.hypot(x, y, z);
        x /= len; y /= len; z /= len;
        const w = fbm(warp, x * 1.5, y * 1.5, z * 1.5, 3) * 0.6;
        // Stretching z makes clouds streak east-west, like weather bands.
        raw[(f * S + j) * S + i] = fbm(noise, x * 3.4 + w, y * 3.4 - w, z * 7.5, 5, 0.6);
      }
    }
  }
  const sorted = Float32Array.from(raw).sort();
  const thr = sorted[Math.min(sorted.length - 1, Math.floor((1 - coverage) * sorted.length))];
  const data = new Uint8Array(raw.length);
  // Soft edges: cloud density ramps up gradually instead of switching on at the threshold.
  for (let k = 0; k < raw.length; k++) {
    const a = clamp((raw[k] - thr) / 0.25, 0, 1);
    data[k] = Math.round(a * a * 255);
  }
  return { size: S, data };
}

export function cloudAt(clouds, x, y, z) {
  const S = clouds.size;
  const ax = Math.abs(x), ay = Math.abs(y), az = Math.abs(z);
  let f, u, v;
  if (ax >= ay && ax >= az) { f = x > 0 ? 0 : 1; u = y / ax; v = z / ax; }
  else if (ay >= az) { f = y > 0 ? 2 : 3; u = x / ay; v = z / ay; }
  else { f = z > 0 ? 4 : 5; u = x / az; v = y / az; }
  let i = ((u + 1) * 0.5 * S) | 0;
  let j = ((v + 1) * 0.5 * S) | 0;
  if (i >= S) i = S - 1;
  if (j >= S) j = S - 1;
  return clouds.data[(f * S + j) * S + i];
}

// Rules are compiled once per type into flat number ranges for speed.
const compiledRules = new WeakMap();
function compileRules(type) {
  if (compiledRules.has(type)) return compiledRules.get(type);
  const range = (r) => (Array.isArray(r) ? [r[0], r[1]] : [-Infinity, Infinity]);
  const out = (type.rules || []).map((r) => {
    const [h0, h1] = range(r.h), [t0, t1] = range(r.t), [m0, m1] = range(r.m), [n0, n1] = range(r.n), [l0, l1] = range(r.lat);
    return { w: r.water === true ? 1 : r.water === false ? 0 : -1, h0, h1, t0, t1, m0, m1, n0, n1, l0, l1, b: BIOME_INDEX.get(r.biome) ?? BIOME_INDEX.get('rock') };
  });
  compiledRules.set(type, out);
  return out;
}

export function deriveWorld(world) {
  const { mesh, base, gen, planet, type, N } = world;
  const xyz = mesh.xyz;
  const edits = planet.edits || {};
  const { h, t, m, biome, isWater, glow, region, rgb, grad, dist, queue } = world;
  const bands = base.bands;

  // 1. Elevation relative to sea level: the sea level setting picks a percentile,
  //    so 0.55 really means "55% of cells are underwater".
  if (bands) {
    h.set(base.elev);
  } else {
    const sl = gen.seaLevel;
    const thr = sl <= 0 ? base.min - 1e-6 : sl >= 1 ? base.max + 1e-6 : base.sorted[Math.floor(sl * (N - 1))];
    const landSpan = base.max - thr || 1;
    const seaSpan = thr - base.min || 1;
    for (let c = 0; c < N; c++) {
      const e = base.elev[c];
      h[c] = e >= thr ? Math.pow((e - thr) / landSpan, 1.25) : (e - thr) / seaSpan;
    }
  }
  if (edits.h) for (const k in edits.h) { const c = +k; if (c < N) h[c] = edits.h[k]; }

  // 2. Temperature: warm equator, cold poles, colder on high ground.
  for (let c = 0; c < N; c++) {
    const absLat = Math.asin(Math.min(1, Math.abs(xyz[c * 3 + 2])));
    const cl = 1 - absLat / (Math.PI / 2);
    const lapse = h[c] > 0 ? 0.38 * Math.pow(h[c], 1.5) : 0;
    const polar = gen.iceCaps * 0.3 * (1 - cl) * (1 - cl) * (1 - cl);
    t[c] = clamp(0.1 + 0.8 * cl + gen.temperature * 0.45 - polar - lapse + 0.06 * base.tNoise[c], 0, 1);
  }

  // 3. Moisture: noise plus a bonus near water. A breadth-first search counts
  //    how many cells each cell is from the nearest water cell.
  let head = 0, tail = 0;
  dist.fill(-1);
  if (!bands) {
    for (let c = 0; c < N; c++) if (h[c] < 0) { dist[c] = 0; queue[tail++] = c; }
  }
  const hasWater = tail > 0;
  while (head < tail) {
    const c = queue[head++];
    for (let k = mesh.offsets[c]; k < mesh.offsets[c + 1]; k++) {
      const nb = mesh.adj[k];
      if (dist[nb] < 0) { dist[nb] = dist[c] + 1; queue[tail++] = nb; }
    }
  }
  const coastScale = mesh.spacing / 0.2;
  for (let c = 0; c < N; c++) {
    if (!bands && h[c] < 0) { m[c] = 1; continue; }
    const coast = hasWater ? Math.exp(-dist[c] * coastScale) : 0;
    m[c] = clamp(0.47 + 0.45 * base.mNoise[c] + 0.4 * gen.moisture + 0.22 * coast, 0, 1);
  }

  // 4. Biomes: first matching rule wins.
  const rules = compileRules(type);
  const fallback = rules.length ? rules[rules.length - 1].b : 0;
  for (let c = 0; c < N; c++) {
    const hc = h[c], tc = t[c], mc = m[c], nc = base.detail[c];
    const wet = !bands && hc < 0 ? 1 : 0;
    const lat = Math.asin(Math.min(1, Math.abs(xyz[c * 3 + 2]))) * 57.29578;
    let b = fallback;
    for (let r = 0; r < rules.length; r++) {
      const R = rules[r];
      if (R.w !== -1 && R.w !== wet) continue;
      if (hc < R.h0 || hc > R.h1 || tc < R.t0 || tc > R.t1 || mc < R.m0 || mc > R.m1 || nc < R.n0 || nc > R.n1 || lat < R.l0 || lat > R.l1) continue;
      b = R.b;
      break;
    }
    biome[c] = b;
  }
  if (edits.b) for (const k in edits.b) { const c = +k; const b = BIOME_INDEX.get(edits.b[k]); if (c < N && b !== undefined) biome[c] = b; }

  // 5. Regions (territories you paint).
  region.fill(-1);
  const regionIndex = new Map((planet.regions || []).map((r, i) => [r.id, i]));
  if (edits.r) for (const k in edits.r) { const c = +k; const i = regionIndex.get(edits.r[k]); if (c < N && i !== undefined) region[c] = i; }

  // 6. Colors: biome color, a little darker in deep water, plus per-cell jitter.
  const palette = { ...(type.palette || {}), ...(planet.palette || {}) };
  world.biomeRGB = BIOMES.map((b) => hexToRgb(palette[b.id] || b.color));
  for (let c = 0; c < N; c++) {
    const b = biome[c];
    const info = BIOMES[b];
    isWater[c] = info.water ? 1 : 0;
    glow[c] = info.glow ? 1 : 0;
    const col = world.biomeRGB[b];
    let f;
    if (bands) f = 1 + 0.05 * h[c];
    else if (info.water) f = 1 + 0.28 * Math.min(h[c], 0);
    else f = 0.92 + 0.14 * clamp(h[c], 0, 1);
    f += (base.rand[c] - 0.5) * 2 * (info.vary ?? 0.035);
    rgb[c * 3] = clamp(col[0] * f, 0, 255);
    rgb[c * 3 + 1] = clamp(col[1] * f, 0, 255);
    rgb[c * 3 + 2] = clamp(col[2] * f, 0, 255);
  }

  // 7. Relief: the slope of each land cell, used to tilt its shading normal.
  grad.fill(0);
  if (!bands) {
    for (let c = 0; c < N; c++) {
      if (isWater[c]) continue;
      const hc = Math.max(h[c], 0);
      const cx = xyz[c * 3], cy = xyz[c * 3 + 1], cz = xyz[c * 3 + 2];
      let gx = 0, gy = 0, gz = 0;
      const start = mesh.offsets[c], end = mesh.offsets[c + 1];
      for (let k = start; k < end; k++) {
        const nb = mesh.adj[k];
        const dh = (isWater[nb] ? 0 : Math.max(h[nb], 0)) - hc;
        const dx = xyz[nb * 3] - cx, dy = xyz[nb * 3 + 1] - cy, dz = xyz[nb * 3 + 2] - cz;
        const inv = dh / (dx * dx + dy * dy + dz * dz);
        gx += dx * inv; gy += dy * inv; gz += dz * inv;
      }
      const deg = end - start;
      let s = 0.1 / deg;
      const mag = Math.hypot(gx, gy, gz) * s;
      if (mag > 0.9) s *= 0.9 / mag;
      grad[c * 3] = gx * s;
      grad[c * 3 + 1] = gy * s;
      grad[c * 3 + 2] = gz * s;
    }
  }

  // 8. Region label positions and simple stats for the sidebar.
  const centers = (planet.regions || []).map(() => ({ x: 0, y: 0, z: 0, count: 0 }));
  const counts = new Uint32Array(BIOMES.length);
  let water = 0;
  for (let c = 0; c < N; c++) {
    counts[biome[c]]++;
    if (isWater[c]) water++;
    const r = region[c];
    if (r >= 0) {
      const ce = centers[r];
      ce.x += xyz[c * 3]; ce.y += xyz[c * 3 + 1]; ce.z += xyz[c * 3 + 2]; ce.count++;
    }
  }
  world.regionCenters = centers.map((ce) => {
    const len = Math.hypot(ce.x, ce.y, ce.z) || 1;
    return { vec: [ce.x / len, ce.y / len, ce.z / len], count: ce.count };
  });
  const top = [];
  counts.forEach((n, i) => { if (n) top.push({ biome: BIOMES[i], share: n / N }); });
  top.sort((a, b) => b.share - a.share);
  world.stats = { water: water / N, biomes: top };
  return world;
}

// Breadth-first search from `start` to the nearest cell that passes `test`.
export function nearestCell(world, start, test, maxSteps = 200000) {
  if (test(start)) return start;
  const { mesh } = world;
  const seen = new Set([start]);
  const queue = [start];
  for (let q = 0; q < queue.length && q < maxSteps; q++) {
    const c = queue[q];
    for (let k = mesh.offsets[c]; k < mesh.offsets[c + 1]; k++) {
      const nb = mesh.adj[k];
      if (seen.has(nb)) continue;
      if (test(nb)) return nb;
      seen.add(nb);
      queue.push(nb);
    }
  }
  return -1;
}

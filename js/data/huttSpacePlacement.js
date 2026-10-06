// Helpers that say where a Hutt Space world goes on the star map.
// Each returns a placement; resolvePlacements() turns them into x, y once every
// planet is known (so a moon can sit next to a planet defined later).

import { bhPoint, grid, getStarMap } from './starMaps.js';

const MAP_ID = 'hutt-space';

export const onSlot = (n) => fixed(bhPoint(n));
export const onBootana = (key) => fixed(bhPoint(key));
export const onGrid = (square, fx, fy) => fixed(grid(square, fx, fy));
export const near = (planetId, dx, dy) => ({ id: MAP_ID, near: planetId, dx, dy });
export const nearFeature = (featureId, dx, dy) => {
  const f = getStarMap(MAP_ID).features.find((x) => x.id === featureId);
  return fixed([f.x + dx, f.y + dy]);
};
export const inSquare = (square) => ({ id: MAP_ID, square });
export const unplaced = () => ({ id: MAP_ID, unplaced: true });

function fixed([x, y]) {
  return { id: MAP_ID, x, y };
}

// Worlds whose position nobody knows wait in a corner of the map (square R-14).
const PEN = { square: 'R-14', cols: 5 };

export function resolvePlacements(planets) {
  const byId = new Map(planets.map((p) => [p.id, p]));
  const placed = () => planets.filter((p) => p.map && Number.isFinite(p.map.x)).map((p) => [p.map.x, p.map.y]);

  // Moons and neighbors: repeat until nothing changes, so chains resolve.
  for (let round = 0; round < 5; round++) {
    for (const p of planets) {
      const m = p.map;
      if (!m || !m.near) continue;
      const parent = byId.get(m.near)?.map;
      if (parent && Number.isFinite(parent.x)) p.map = { id: MAP_ID, x: Math.round(parent.x + m.dx), y: Math.round(parent.y + m.dy) };
    }
  }
  // A moon whose planet is missing goes to the pen below.
  for (const p of planets) if (p.map && p.map.near) p.map = { id: MAP_ID, unplaced: true };

  // Spread worlds that only have a grid square: pick the free-est spot in the square.
  for (const p of planets) {
    if (!p.map || !p.map.square) continue;
    const taken = placed();
    let best = null, bestD = -1;
    for (let gy = 0; gy < 6; gy++) {
      for (let gx = 0; gx < 6; gx++) {
        const pt = grid(p.map.square, 0.12 + gx * 0.15, 0.12 + gy * 0.15);
        if (!pt) continue;
        const d = taken.reduce((min, q) => Math.min(min, Math.hypot(q[0] - pt[0], q[1] - pt[1])), Infinity);
        if (d > bestD) { bestD = d; best = pt; }
      }
    }
    p.map = best ? { id: MAP_ID, x: best[0], y: best[1] } : { id: MAP_ID, unplaced: true };
  }

  // Everyone else goes in the "Location unknown" pen.
  let n = 0;
  for (const p of planets) {
    if (!p.map || !p.map.unplaced) continue;
    const col = n % PEN.cols, row = Math.floor(n / PEN.cols);
    const [x, y] = grid(PEN.square, 0.12 + col * 0.19, 0.15 + row * 0.17);
    p.map = { id: MAP_ID, x, y, area: 'unplaced' };
    n++;
  }
  return planets;
}

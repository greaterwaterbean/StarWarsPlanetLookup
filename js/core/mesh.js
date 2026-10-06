// The cell mesh: thousands of points scattered over the sphere, where each
// point owns the area closer to it than to any other point (a Voronoi cell).
// This is the same idea Azgaar's Fantasy Map Generator uses on a flat map.
//
// To find which cells touch each other we need a Delaunay triangulation of the
// points. On a sphere, the trick is:
//   1. rotate the sphere so one point sits exactly on the north pole,
//   2. flatten every other point onto a plane with a stereographic projection
//      (it keeps circles as circles, so the Delaunay rule survives),
//   3. triangulate that flat picture with Delaunator,
//   4. connect the pole point to the outer ring (the convex hull) of the flat picture.

import Delaunator from '../vendor/delaunator.js';
import { mulberry32 } from './rng.js';
import { fibonacciSphere } from './sphere.js';

const meshCache = new Map();

// Meshes are shared between planets of the same resolution, so switching planets is fast.
export function getMesh(cellCount) {
  if (!meshCache.has(cellCount)) meshCache.set(cellCount, buildMesh(cellCount, 1337 + cellCount));
  return meshCache.get(cellCount);
}

export function buildMesh(n, seed = 1) {
  const random = mulberry32(seed);
  const pts = fibonacciSphere(n, random, 0.75);

  // Pick the point closest to the north pole and rotate it onto the pole exactly.
  let pole = 0;
  for (let i = 1; i < n; i++) if (pts[i * 3 + 2] > pts[pole * 3 + 2]) pole = i;
  const rot = rotationToNorth(pts[pole * 3], pts[pole * 3 + 1], pts[pole * 3 + 2]);

  // Stereographic projection of every point except the pole.
  const coords = new Float64Array((n - 1) * 2);
  const origIndex = new Uint32Array(n - 1);
  let k = 0;
  for (let i = 0; i < n; i++) {
    if (i === pole) continue;
    const x = pts[i * 3], y = pts[i * 3 + 1], z = pts[i * 3 + 2];
    const rx = rot[0] * x + rot[1] * y + rot[2] * z;
    const ry = rot[3] * x + rot[4] * y + rot[5] * z;
    const rz = rot[6] * x + rot[7] * y + rot[8] * z;
    const d = 1 - rz;
    coords[k * 2] = rx / d;
    coords[k * 2 + 1] = ry / d;
    origIndex[k] = i;
    k++;
  }

  const del = new Delaunator(coords);

  // Collect unique edges. Each interior edge appears twice (once per triangle),
  // so we only keep it from the half-edge with the larger index.
  const edgesA = [];
  const edgesB = [];
  const tri = del.triangles;
  const half = del.halfedges;
  for (let e = 0; e < tri.length; e++) {
    const opposite = half[e];
    if (opposite !== -1 && opposite > e) continue;
    const next = e % 3 === 2 ? e - 2 : e + 1;
    edgesA.push(origIndex[tri[e]]);
    edgesB.push(origIndex[tri[next]]);
  }
  for (let h = 0; h < del.hull.length; h++) {
    edgesA.push(pole);
    edgesB.push(origIndex[del.hull[h]]);
  }

  // Compressed adjacency lists: neighbors of cell c live in adj[offsets[c] .. offsets[c + 1]).
  const degree = new Uint32Array(n);
  for (let e = 0; e < edgesA.length; e++) {
    degree[edgesA[e]]++;
    degree[edgesB[e]]++;
  }
  const offsets = new Uint32Array(n + 1);
  for (let i = 0; i < n; i++) offsets[i + 1] = offsets[i] + degree[i];
  const adj = new Uint32Array(offsets[n]);
  const fill = offsets.slice(0, n);
  for (let e = 0; e < edgesA.length; e++) {
    const a = edgesA[e], b = edgesB[e];
    adj[fill[a]++] = b;
    adj[fill[b]++] = a;
  }

  return {
    count: n,
    xyz: Float32Array.from(pts),
    offsets,
    adj,
    edgeCount: edgesA.length,
    // Average angular distance between neighboring cell centers, in radians.
    spacing: Math.sqrt((4 * Math.PI) / n) * 1.07,
  };
}

// Rotation matrix (row-major 3x3) that maps unit vector (x, y, z) onto (0, 0, 1).
function rotationToNorth(x, y, z) {
  // Axis = v x north, angle = acos(v . north). Rodrigues' rotation formula.
  let ax = y, ay = -x;
  const s = Math.hypot(ax, ay);
  const c = z;
  if (s < 1e-12) return c > 0 ? [1, 0, 0, 0, 1, 0, 0, 0, 1] : [1, 0, 0, 0, -1, 0, 0, 0, -1];
  ax /= s;
  ay /= s;
  const t = 1 - c;
  return [
    t * ax * ax + c, t * ax * ay, ay * s,
    t * ax * ay, t * ay * ay + c, -ax * s,
    -ay * s, ax * s, c,
  ];
}

// Find the cell whose center is closest to the unit vector (x, y, z).
// Instead of checking every cell, we "walk": from the starting cell, step to
// whichever neighbor is closer to the target until no neighbor is closer.
// On a Delaunay mesh this always ends at the true nearest cell, and when the
// start is already nearby (like the previous pixel) it only takes a step or two.
export function findCell(mesh, x, y, z, start = 0) {
  const xyz = mesh.xyz;
  const offsets = mesh.offsets;
  const adj = mesh.adj;
  let c = start;
  let best = xyz[c * 3] * x + xyz[c * 3 + 1] * y + xyz[c * 3 + 2] * z;
  for (;;) {
    let next = -1;
    for (let k = offsets[c], end = offsets[c + 1]; k < end; k++) {
      const nb = adj[k];
      const d = xyz[nb * 3] * x + xyz[nb * 3 + 1] * y + xyz[nb * 3 + 2] * z;
      if (d > best) {
        best = d;
        next = nb;
      }
    }
    if (next < 0) return c;
    c = next;
  }
}

// All cells whose centers lie within `radius` radians of the unit vector `center`.
// Flood fill outward from the nearest cell, which only touches nearby cells.
export function cellsWithin(mesh, center, radius, start = 0) {
  const first = findCell(mesh, center[0], center[1], center[2], start);
  const cosR = Math.cos(radius);
  const xyz = mesh.xyz;
  const result = [first];
  const seen = new Set(result);
  for (let q = 0; q < result.length; q++) {
    const c = result[q];
    for (let k = mesh.offsets[c]; k < mesh.offsets[c + 1]; k++) {
      const nb = mesh.adj[k];
      if (seen.has(nb)) continue;
      seen.add(nb);
      const d = xyz[nb * 3] * center[0] + xyz[nb * 3 + 1] * center[1] + xyz[nb * 3 + 2] * center[2];
      if (d >= cosR) result.push(nb);
    }
  }
  return result;
}

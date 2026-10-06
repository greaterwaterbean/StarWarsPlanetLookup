// Small vector helpers for working on a unit sphere.
// World axes: +z is the north pole, longitude 0 points along +x.

export const DEG = Math.PI / 180;

export function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

export function latLonToVec(lat, lon) {
  const la = lat * DEG;
  const lo = lon * DEG;
  const c = Math.cos(la);
  return [c * Math.cos(lo), c * Math.sin(lo), Math.sin(la)];
}

export function vecToLatLon(x, y, z) {
  const len = Math.hypot(x, y, z) || 1;
  return { lat: Math.asin(clamp(z / len, -1, 1)) / DEG, lon: Math.atan2(y, x) / DEG };
}

export function normalize(v) {
  const len = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / len, v[1] / len, v[2] / len];
}

export function dot(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

export function cross(a, b) {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

// Angle in radians between two unit vectors (the great-circle distance on a unit sphere).
export function angleBetween(a, b) {
  return Math.acos(clamp(dot(a, b), -1, 1));
}

// Points along the shortest path (great circle) between two unit vectors.
export function greatCircle(a, b, steps) {
  const omega = angleBetween(a, b);
  const out = [];
  if (omega < 1e-9) return [a.slice(), b.slice()];
  const so = Math.sin(omega);
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const k1 = Math.sin((1 - t) * omega) / so;
    const k2 = Math.sin(t * omega) / so;
    out.push([a[0] * k1 + b[0] * k2, a[1] * k1 + b[1] * k2, a[2] * k1 + b[2] * k2]);
  }
  return out;
}

// A circle of angular radius `radius` drawn on the sphere around `center`.
export function sphereCircle(center, radius, steps = 64) {
  const c = normalize(center);
  const helper = Math.abs(c[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0];
  const u = normalize(cross(c, helper));
  const v = cross(c, u);
  const cr = Math.cos(radius);
  const sr = Math.sin(radius);
  const out = [];
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    const ca = Math.cos(a) * sr;
    const sa = Math.sin(a) * sr;
    out.push([c[0] * cr + u[0] * ca + v[0] * sa, c[1] * cr + u[1] * ca + v[1] * sa, c[2] * cr + u[2] * ca + v[2] * sa]);
  }
  return out;
}

// Wrap a longitude difference into [-180, 180].
export function wrapLon(lon) {
  return ((((lon + 180) % 360) + 360) % 360) - 180;
}

// Evenly spread points on a sphere using the golden angle (a "Fibonacci sphere").
// A little random jitter keeps the cells from looking like a perfect grid.
export function fibonacciSphere(n, random, jitter = 0.5) {
  const out = new Float64Array(n * 3);
  const golden = Math.PI * (3 - Math.sqrt(5));
  const spacing = Math.sqrt((4 * Math.PI) / n);
  for (let i = 0; i < n; i++) {
    const z0 = 1 - (2 * i + 1) / n;
    const r = Math.sqrt(1 - z0 * z0);
    const phi = i * golden;
    let x = Math.cos(phi) * r + (random() - 0.5) * spacing * jitter;
    let y = Math.sin(phi) * r + (random() - 0.5) * spacing * jitter;
    let z = z0 + (random() - 0.5) * spacing * jitter;
    const len = Math.hypot(x, y, z);
    out[i * 3] = x / len;
    out[i * 3 + 1] = y / len;
    out[i * 3 + 2] = z / len;
  }
  return out;
}

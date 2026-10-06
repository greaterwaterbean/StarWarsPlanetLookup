// Orthographic globe camera: which lat/lon is in the middle of the screen,
// and how big the globe is drawn.
//
// The view matrix turns a world vector (x, y, z on the unit sphere) into view
// space: X to the right, Y up, Z toward you. A point is visible when Z > 0.

import { DEG, clamp, wrapLon } from '../core/sphere.js';

export const MIN_ZOOM = 0.45;
export const MAX_ZOOM = 40;

export function createCamera() {
  return { lon: 20, lat: 15, zoom: 1 };
}

// Row-major 3x3 matrix (world -> view) for a camera centered on (lat, lon).
export function viewMatrix(lon, lat) {
  const L = lon * DEG;
  const a = lat * DEG;
  const sL = Math.sin(L), cL = Math.cos(L), sa = Math.sin(a), ca = Math.cos(a);
  return new Float64Array([
    -sL, cL, 0,
    -sa * cL, -sa * sL, ca,
    ca * cL, ca * sL, sa,
  ]);
}

// Everything the renderers need for one frame, in CSS pixels.
export function makeView(camera, width, height) {
  const R = Math.min(width, height) * 0.4 * camera.zoom;
  return { cx: width / 2, cy: height / 2, R, m: viewMatrix(camera.lon, camera.lat), width, height };
}

export function project(view, v) {
  const m = view.m;
  const X = m[0] * v[0] + m[1] * v[1] + m[2] * v[2];
  const Y = m[3] * v[0] + m[4] * v[1] + m[5] * v[2];
  const Z = m[6] * v[0] + m[7] * v[1] + m[8] * v[2];
  return { x: view.cx + X * view.R, y: view.cy - Y * view.R, z: Z };
}

// Screen point -> world unit vector, or null if the point is off the globe.
export function unproject(view, sx, sy) {
  const X = (sx - view.cx) / view.R;
  const Y = (view.cy - sy) / view.R;
  const r2 = X * X + Y * Y;
  if (r2 > 1) return null;
  const Z = Math.sqrt(1 - r2);
  const m = view.m;
  return [m[0] * X + m[3] * Y + m[6] * Z, m[1] * X + m[4] * Y + m[7] * Z, m[2] * X + m[5] * Y + m[8] * Z];
}

export function clampCamera(camera) {
  camera.lat = clamp(camera.lat, -89.9, 89.9);
  camera.lon = wrapLon(camera.lon);
  camera.zoom = clamp(camera.zoom, MIN_ZOOM, MAX_ZOOM);
  return camera;
}

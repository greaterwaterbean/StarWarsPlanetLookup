// The pixel globe renderer.
//
// For every pixel of a small off-screen image we:
//   1. work out where on the sphere that pixel looks (inverse projection),
//   2. find which cell owns that spot (the neighbor walk from mesh.js, starting
//      at the previous pixel's cell, so it usually takes zero or one step),
//   3. color it with the cell's color, shading, clouds and borders.
// The image is then stretched onto the screen without smoothing, which gives
// the chunky pixel-art look. Pixel size 1 is "smooth" mode.

import { findCell } from '../core/mesh.js';
import { cloudAt } from '../core/generator.js';
import { hexToRgb } from '../data/biomes.js';

// 4x4 ordered-dither thresholds (a Bayer matrix), scaled to 0..1.
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
const SHADE_LEVELS = 6;
const AMBIENT = 0.3;

const LIGHT = normalize3(-0.45, 0.5, 0.74);
const HALF = normalize3(LIGHT[0], LIGHT[1], LIGHT[2] + 1);

function normalize3(x, y, z) {
  const l = Math.hypot(x, y, z);
  return [x / l, y / l, z / l];
}

export function createTarget(width, height) {
  return { width, height, image: new ImageData(Math.max(1, width), Math.max(1, height)), index: new Int32Array(Math.max(1, width * height)) };
}

/**
 * @param target  { width, height, image: ImageData, index: Int32Array }
 * @param world   output of buildWorld()
 * @param view    { cx, cy, R, m } in target pixels (see camera.js)
 * @param opts    layer switches and highlights
 */
export function renderGlobe(target, world, view, opts) {
  const { width: W, height: H, index } = target;
  const data = target.image.data;
  const { cx, cy, R, m } = view;
  const { mesh, rgb, grad, isWater, glow, region } = world;

  data.fill(0);
  index.fill(-1);
  if (!(R > 0.5)) return;

  const atmHex = opts.atmosphere ? world.gen.atmosphere : null;
  const atm = atmHex ? hexToRgb(atmHex) : null;
  const outer = atm ? 1 + Math.max(0.05, 3 / R) : 1;
  const outer2 = outer * outer;

  // Light direction moved into world space once, so per-pixel shading is one dot product.
  const lwx = m[0] * LIGHT[0] + m[3] * LIGHT[1] + m[6] * LIGHT[2];
  const lwy = m[1] * LIGHT[0] + m[4] * LIGHT[1] + m[7] * LIGHT[2];
  const lwz = m[2] * LIGHT[0] + m[5] * LIGHT[1] + m[8] * LIGHT[2];

  const shading = opts.shading !== false;
  const relief = opts.relief !== false ? (opts.reliefStrength ?? 2.2) : 0;
  const dither = !!opts.dither;
  const clouds = opts.clouds && world.clouds ? world.clouds : null;
  const cloudRGB = hexToRgb(world.gen.cloudColor || '#ffffff');
  const regionRGB = opts.regionColors || [];
  const showRegions = !!opts.regions && regionRGB.length > 0;

  let cell = opts.startCell > 0 && opts.startCell < mesh.count ? opts.startCell : 0;
  let rowCell = cell;

  const yMin = Math.max(0, Math.floor(cy - outer * R));
  const yMax = Math.min(H - 1, Math.ceil(cy + outer * R));

  for (let j = yMin; j <= yMax; j++) {
    const Y = (cy - (j + 0.5)) / R;
    const span = outer2 - Y * Y;
    if (span <= 0) continue;
    const half = Math.sqrt(span) * R;
    const xMin = Math.max(0, Math.floor(cx - half));
    const xMax = Math.min(W - 1, Math.ceil(cx + half));
    cell = rowCell;
    let firstInRow = true;
    const brow = (j & 3) * 4;

    for (let i = xMin; i <= xMax; i++) {
      const X = (i + 0.5 - cx) / R;
      const r2 = X * X + Y * Y;
      const k = j * W + i;
      const o = k * 4;

      if (r2 > 1) {
        if (!atm || r2 > outer2) continue;
        // Atmosphere glow just outside the rim.
        let a = 1 - (Math.sqrt(r2) - 1) / (outer - 1);
        a = a * a * 0.8;
        if (dither) a = Math.floor(a * 4 + BAYER[brow + (i & 3)]) / 4;
        data[o] = atm[0];
        data[o + 1] = atm[1];
        data[o + 2] = atm[2];
        data[o + 3] = a * 255;
        continue;
      }

      const Z = Math.sqrt(1 - r2);
      const wx = m[0] * X + m[3] * Y + m[6] * Z;
      const wy = m[1] * X + m[4] * Y + m[7] * Z;
      const wz = m[2] * X + m[5] * Y + m[8] * Z;
      cell = findCell(mesh, wx, wy, wz, cell);
      if (firstInRow) { rowCell = cell; firstInRow = false; }
      index[k] = cell;

      const c3 = cell * 3;
      let r = rgb[c3], g = rgb[c3 + 1], b = rgb[c3 + 2];

      if (showRegions) {
        const ri = region[cell];
        if (ri >= 0 && regionRGB[ri]) {
          const rc = regionRGB[ri];
          r = r * 0.62 + rc[0] * 0.38;
          g = g * 0.62 + rc[1] * 0.38;
          b = b * 0.62 + rc[2] * 0.38;
        }
      }

      let shade = 1;
      if (shading && !glow[cell]) {
        let nx = wx, ny = wy, nz = wz;
        if (relief) {
          nx -= grad[c3] * relief;
          ny -= grad[c3 + 1] * relief;
          nz -= grad[c3 + 2] * relief;
        }
        let d = (nx * lwx + ny * lwy + nz * lwz) / Math.sqrt(nx * nx + ny * ny + nz * nz);
        if (d < 0) d = 0;
        shade = AMBIENT + (1 - AMBIENT) * d;
        if (dither) shade = Math.floor(shade * SHADE_LEVELS + BAYER[brow + (i & 3)]) / SHADE_LEVELS;
      }
      r *= shade;
      g *= shade;
      b *= shade;

      // A small sun glint on water.
      if (shading && isWater[cell] && !glow[cell]) {
        const s = X * HALF[0] + Y * HALF[1] + Z * HALF[2];
        if (s > 0.985) {
          let spec = Math.pow(s, 160) * 90;
          if (dither) spec = Math.floor(spec / 40 + BAYER[brow + (i & 3)]) * 40;
          r += spec; g += spec; b += spec;
        }
      }

      if (clouds) {
        const cv = cloudAt(clouds, wx, wy, wz);
        if (cv > 0) {
          let a = (cv / 255) * 0.7;
          if (dither) a = Math.floor(a * 4 + BAYER[brow + (i & 3)]) / 4;
          let cs = 1;
          if (shading) {
            const d = X * LIGHT[0] + Y * LIGHT[1] + Z * LIGHT[2];
            cs = AMBIENT + (1 - AMBIENT) * (d > 0 ? d : 0);
          }
          r = r * (1 - a) + cloudRGB[0] * cs * a;
          g = g * (1 - a) + cloudRGB[1] * cs * a;
          b = b * (1 - a) + cloudRGB[2] * cs * a;
        }
      }

      data[o] = r;
      data[o + 1] = g;
      data[o + 2] = b;
      data[o + 3] = 255;
    }
  }

  // Second pass: lines where neighboring pixels belong to different cells.
  const grid = !!opts.grid;
  const coast = opts.coast !== false;
  const sel = opts.selectedCell ?? -1;
  const hl = opts.highlightCells || null;
  if (!grid && !coast && !showRegions && sel < 0 && !hl) return;

  for (let j = yMin; j <= yMax; j++) {
    for (let i = 0; i < W; i++) {
      const k = j * W + i;
      const c = index[k];
      if (c < 0) continue;
      const o = k * 4;

      if (c === sel || (hl && hl.has(c))) {
        data[o] = Math.min(255, data[o] * 1.25 + 40);
        data[o + 1] = Math.min(255, data[o + 1] * 1.25 + 40);
        data[o + 2] = Math.min(255, data[o + 2] * 1.25 + 40);
      }

      let kind = 0; // 1 grid, 2 coast, 3 region
      let regionOf = -1;
      for (let n = 0; n < 2; n++) {
        let other;
        if (n === 0) other = i + 1 < W ? index[k + 1] : -1;
        else other = j + 1 < H ? index[k + W] : -1;
        if (other < 0 || other === c) continue;
        if (showRegions && region[other] !== region[c]) {
          kind = 3;
          regionOf = region[c] >= 0 ? region[c] : region[other];
        } else if (coast && isWater[other] !== isWater[c]) {
          if (kind < 2) kind = 2;
        } else if (grid && kind < 1) {
          kind = 1;
        }
        if ((c === sel || other === sel) && kind < 1) kind = 1;
      }

      if (kind === 1) {
        data[o] *= 0.8; data[o + 1] *= 0.8; data[o + 2] *= 0.8;
      } else if (kind === 2) {
        data[o] *= 0.6; data[o + 1] *= 0.6; data[o + 2] *= 0.6;
      } else if (kind === 3) {
        const rc = regionRGB[regionOf] || [255, 255, 255];
        data[o] = rc[0]; data[o + 1] = rc[1]; data[o + 2] = rc[2];
      }
    }
  }
}

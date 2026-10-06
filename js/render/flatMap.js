// Flat (equirectangular) planet map: longitude runs left to right, latitude
// top to bottom, so the image is twice as wide as it is tall. This is the
// format virtual tabletops like Foundry VTT can use as a scene background.
//
// Like the globe, it is drawn at low resolution and scaled up without
// smoothing, so it keeps the pixel-art look.

import { findCell } from '../core/mesh.js';
import { cloudAt } from '../core/generator.js';
import { DEG } from '../core/sphere.js';
import { hexToRgb } from '../data/biomes.js';
import { getSprite } from './sprites.js';
import { getLocationType } from '../data/locationTypes.js';
import { LABEL_FONT } from './overlay.js';

// Where a lat/lon lands on a flat map of the given size, in pixels.
export function flatPosition(lat, lon, width, height) {
  return { x: ((lon + 180) / 360) * width, y: ((90 - lat) / 180) * height };
}

/**
 * Renders the world to a canvas of width x width/2 pixels.
 * options: pixel (block size), relief, coast, grid, regions, clouds, regionColors,
 *          labels (array of locations to bake in, or null)
 */
export function renderFlatMap(world, options = {}) {
  const width = Math.max(256, Math.round(options.width || 4096));
  const height = Math.round(width / 2);
  const pixel = Math.max(1, Math.round(options.pixel || 4));
  const bw = Math.ceil(width / pixel);
  const bh = Math.ceil(height / pixel);
  const image = new ImageData(bw, bh);
  const data = image.data;
  const index = new Int32Array(bw * bh);
  const { mesh, rgb, grad, isWater, region } = world;
  const relief = options.relief !== false ? 2.2 : 0;
  const clouds = options.clouds && world.clouds ? world.clouds : null;
  const cloudRGB = hexToRgb(world.gen.cloudColor || '#ffffff');
  const regionRGB = options.regionColors || [];
  const showRegions = !!options.regions && regionRGB.length > 0;

  let cell = 0;
  for (let j = 0; j < bh; j++) {
    const lat = 90 - ((j + 0.5) / bh) * 180;
    const la = lat * DEG;
    const sinLa = Math.sin(la), cosLa = Math.cos(la);
    for (let i = 0; i < bw; i++) {
      const lo = (-180 + ((i + 0.5) / bw) * 360) * DEG;
      const sinLo = Math.sin(lo), cosLo = Math.cos(lo);
      const x = cosLa * cosLo, y = cosLa * sinLo, z = sinLa;
      cell = findCell(mesh, x, y, z, cell);
      const k = j * bw + i;
      index[k] = cell;
      const c3 = cell * 3;
      let r = rgb[c3], g = rgb[c3 + 1], b = rgb[c3 + 2];
      if (showRegions && region[cell] >= 0 && regionRGB[region[cell]]) {
        const rc = regionRGB[region[cell]];
        r = r * 0.62 + rc[0] * 0.38;
        g = g * 0.62 + rc[1] * 0.38;
        b = b * 0.62 + rc[2] * 0.38;
      }
      if (relief && !isWater[cell]) {
        // Hillshade: light from the north-west, compared with flat ground.
        const ex = -sinLo, ey = cosLo;
        const nx = -sinLa * cosLo, ny = -sinLa * sinLo, nz = cosLa;
        const lx = x * 0.7 + nx * 0.5 - ex * 0.5, ly = y * 0.7 + ny * 0.5 - ey * 0.5, lz = z * 0.7 + nz * 0.5;
        const gx = x - grad[c3] * relief, gy = y - grad[c3 + 1] * relief, gz = z - grad[c3 + 2] * relief;
        const flat = x * lx + y * ly + z * lz;
        const tilted = (gx * lx + gy * ly + gz * lz) / Math.sqrt(gx * gx + gy * gy + gz * gz);
        const shade = Math.max(0.55, Math.min(1.3, 1 + (tilted - flat) * 1.6));
        r *= shade; g *= shade; b *= shade;
      }
      if (clouds) {
        const cv = cloudAt(clouds, x, y, z);
        if (cv > 0) {
          const a = (cv / 255) * 0.7;
          r = r * (1 - a) + cloudRGB[0] * a;
          g = g * (1 - a) + cloudRGB[1] * a;
          b = b * (1 - a) + cloudRGB[2] * a;
        }
      }
      const o = k * 4;
      data[o] = r;
      data[o + 1] = g;
      data[o + 2] = b;
      data[o + 3] = 255;
    }
  }

  // Borders between cells, coasts and regions (wrapping around east-west).
  const grid = !!options.grid;
  const coast = options.coast !== false;
  if (grid || coast || showRegions) {
    for (let j = 0; j < bh; j++) {
      for (let i = 0; i < bw; i++) {
        const k = j * bw + i;
        const c = index[k];
        const right = index[j * bw + ((i + 1) % bw)];
        const down = j + 1 < bh ? index[k + bw] : c;
        let kind = 0, regionOf = -1;
        for (const other of [right, down]) {
          if (other === c) continue;
          if (showRegions && region[other] !== region[c]) {
            kind = 3;
            regionOf = region[c] >= 0 ? region[c] : region[other];
          } else if (coast && isWater[other] !== isWater[c]) {
            if (kind < 2) kind = 2;
          } else if (grid && kind < 1) kind = 1;
        }
        const o = k * 4;
        if (kind === 1) { data[o] *= 0.8; data[o + 1] *= 0.8; data[o + 2] *= 0.8; }
        else if (kind === 2) { data[o] *= 0.6; data[o + 1] *= 0.6; data[o + 2] *= 0.6; }
        else if (kind === 3) {
          const rc = regionRGB[regionOf] || [255, 255, 255];
          data[o] = rc[0]; data[o + 1] = rc[1]; data[o + 2] = rc[2];
        }
      }
    }
  }

  const small = document.createElement('canvas');
  small.width = bw;
  small.height = bh;
  small.getContext('2d').putImageData(image, 0, 0);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(small, 0, 0, bw * pixel, bh * pixel);

  if (options.labels && options.labels.length) bakeLabels(ctx, options.labels, width, height);
  return canvas;
}

// Draw place icons and names straight onto the image.
function bakeLabels(ctx, locations, width, height) {
  const scale = Math.max(2, Math.round(width / 1400));
  const size = Math.round(scale * 8);
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  for (const loc of locations) {
    const { x, y } = flatPosition(loc.lat, loc.lon, width, height);
    const sprite = getSprite(loc.type, scale);
    ctx.drawImage(sprite, Math.round(x - sprite.width / 2), Math.round(y - sprite.height / 2));
    const type = getLocationType(loc.type);
    ctx.font = `${type.size >= 2 ? size + 4 : size}px ${LABEL_FONT}`;
    ctx.lineWidth = Math.max(3, scale * 1.5);
    ctx.strokeStyle = 'rgba(5, 8, 16, 0.92)';
    ctx.strokeText(loc.name, x + sprite.width / 2 + 4, y);
    ctx.fillStyle = '#eef6ff';
    ctx.fillText(loc.name, x + sprite.width / 2 + 4, y);
  }
}


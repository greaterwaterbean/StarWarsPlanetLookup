// Turns the text sprites in locationTypes.js into small canvases, with an
// automatic dark outline. Cached, because they are drawn every frame.

import { getLocationType } from '../data/locationTypes.js';

const OUTLINE = '#0a0e18';
const cache = new Map();

export function getSprite(typeId, scale = 2, colorOverride = null) {
  const key = `${typeId}|${scale}|${colorOverride || ''}`;
  if (cache.has(key)) return cache.get(key);
  const type = getLocationType(typeId);
  const rows = type.sprite;
  const h = rows.length;
  const w = rows[0].length;
  const canvas = document.createElement('canvas');
  canvas.width = (w + 2) * scale;
  canvas.height = (h + 2) * scale;
  const ctx = canvas.getContext('2d');
  const filled = (x, y) => y >= 0 && y < h && x >= 0 && x < w && rows[y][x] !== '.';

  ctx.fillStyle = OUTLINE;
  for (let y = -1; y <= h; y++) {
    for (let x = -1; x <= w; x++) {
      if (filled(x, y)) continue;
      let near = false;
      for (let dy = -1; dy <= 1 && !near; dy++) for (let dx = -1; dx <= 1; dx++) if (filled(x + dx, y + dy)) { near = true; break; }
      if (near) ctx.fillRect((x + 1) * scale, (y + 1) * scale, scale, scale);
    }
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const ch = rows[y][x];
      if (ch === '.') continue;
      ctx.fillStyle = ch === '+' ? '#ffffff' : colorOverride || type.color;
      ctx.fillRect((x + 1) * scale, (y + 1) * scale, scale, scale);
    }
  }
  cache.set(key, canvas);
  return canvas;
}

const urlCache = new Map();
export function spriteDataURL(typeId, scale = 2) {
  const key = `${typeId}|${scale}`;
  if (!urlCache.has(key)) urlCache.set(key, getSprite(typeId, scale).toDataURL());
  return urlCache.get(key);
}

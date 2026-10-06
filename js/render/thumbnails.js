// Small globe previews for the planet list and the type gallery.
// They are generated at low resolution, one per idle moment, and cached.

import { buildWorld } from '../core/generator.js';
import { viewMatrix } from './camera.js';
import { createTarget, renderGlobe } from './globeRenderer.js';

const THUMB_CELLS = 3000;
const cache = new Map();
const queue = [];
let scheduled = false;

export function thumbnailKey(planet, size) {
  return [planet.typeId, planet.seed, JSON.stringify(planet.params || {}), JSON.stringify(planet.palette || {}), size].join('|');
}

// Calls `done(dataURL)` now if cached, otherwise when it has been rendered.
export function requestThumbnail(planet, size, done) {
  const key = thumbnailKey(planet, size);
  if (cache.has(key)) {
    done(cache.get(key));
    return;
  }
  queue.push({ key, planet: { typeId: planet.typeId, seed: planet.seed, params: planet.params || {}, palette: planet.palette, cells: THUMB_CELLS }, size, done });
  schedule();
}

export function clearThumbnailQueue() {
  queue.length = 0;
}

function schedule() {
  if (scheduled) return;
  scheduled = true;
  const run = () => {
    scheduled = false;
    const job = queue.shift();
    if (!job) return;
    if (!cache.has(job.key)) cache.set(job.key, renderThumbnail(job.planet, job.size));
    job.done(cache.get(job.key));
    if (queue.length) schedule();
  };
  if ('requestIdleCallback' in window) requestIdleCallback(run, { timeout: 300 });
  else setTimeout(run, 16);
}

export function renderThumbnail(planet, size) {
  // Clouds are skipped: they hide the surface and are the slowest part to generate.
  const world = buildWorld({ ...planet, params: { ...planet.params, clouds: 0 }, edits: {}, regions: [] }, { cache: false });
  const target = createTarget(size, size);
  renderGlobe(target, world, { cx: size / 2, cy: size / 2, R: size * 0.42, m: viewMatrix(25, 18) }, {
    shading: true, relief: true, clouds: false, atmosphere: true, coast: true, dither: false,
  });
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  canvas.getContext('2d').putImageData(target.image, 0, 0);
  return canvas.toDataURL();
}

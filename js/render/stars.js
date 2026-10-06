// A pixel starfield behind the globe. Drawn once per resize.

import { mulberry32 } from '../core/rng.js';

export function drawStars(canvas, width, height, pixel = 2) {
  const w = Math.max(1, Math.ceil(width / pixel));
  const h = Math.max(1, Math.ceil(height / pixel));
  canvas.width = w;
  canvas.height = h;
  canvas.style.width = `${w * pixel}px`;
  canvas.style.height = `${h * pixel}px`;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#04060d';
  ctx.fillRect(0, 0, w, h);

  // Faint nebula blobs.
  const random = mulberry32(4242);
  for (let i = 0; i < 4; i++) {
    const x = random() * w, y = random() * h, r = (0.2 + random() * 0.35) * Math.max(w, h);
    const hue = [210, 260, 190, 320][i];
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `hsla(${hue}, 60%, 40%, 0.10)`);
    g.addColorStop(1, 'hsla(0, 0%, 0%, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }

  const count = Math.round((w * h) / 90);
  for (let i = 0; i < count; i++) {
    const x = Math.floor(random() * w);
    const y = Math.floor(random() * h);
    const b = random();
    const v = Math.floor(120 + b * 135);
    const tint = random();
    ctx.fillStyle = tint < 0.15 ? `rgb(${v},${v * 0.85},${v * 0.7})` : tint < 0.3 ? `rgb(${v * 0.8},${v * 0.9},${v})` : `rgb(${v},${v},${v})`;
    ctx.fillRect(x, y, 1, 1);
    if (b > 0.985) {
      ctx.globalAlpha = 0.5;
      ctx.fillRect(x - 1, y, 1, 1);
      ctx.fillRect(x + 1, y, 1, 1);
      ctx.fillRect(x, y - 1, 1, 1);
      ctx.fillRect(x, y + 1, 1, 1);
      ctx.globalAlpha = 1;
    }
  }
}

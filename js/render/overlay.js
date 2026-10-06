// The crisp layer on top of the pixel globe: lat/lon grid, location icons and
// labels, region names, the paint brush circle and the measuring line.

import { project } from './camera.js';
import { getSprite } from './sprites.js';
import { getLocationType } from '../data/locationTypes.js';
import { latLonToVec, sphereCircle, greatCircle, angleBetween } from '../core/sphere.js';

export const LABEL_FONT = '"VT323", "Courier New", monospace';

// Draw a polyline of world vectors, skipping the parts behind the globe.
function strokeSphereLine(ctx, view, points) {
  let drawing = false;
  ctx.beginPath();
  for (const v of points) {
    const p = project(view, v);
    if (p.z > 0) {
      if (drawing) ctx.lineTo(p.x, p.y);
      else ctx.moveTo(p.x, p.y);
      drawing = true;
    } else {
      drawing = false;
    }
  }
  ctx.stroke();
}

function drawGraticule(ctx, view) {
  ctx.lineWidth = 1;
  for (let lon = -180; lon < 180; lon += 30) {
    const pts = [];
    for (let lat = -90; lat <= 90; lat += 3) pts.push(latLonToVec(lat, lon));
    ctx.strokeStyle = lon === 0 ? 'rgba(255, 220, 140, 0.35)' : 'rgba(140, 210, 255, 0.18)';
    strokeSphereLine(ctx, view, pts);
  }
  for (let lat = -60; lat <= 60; lat += 30) {
    const pts = [];
    for (let lon = -180; lon <= 180; lon += 3) pts.push(latLonToVec(lat, lon));
    ctx.strokeStyle = lat === 0 ? 'rgba(255, 220, 140, 0.35)' : 'rgba(140, 210, 255, 0.18)';
    strokeSphereLine(ctx, view, pts);
  }
}

function textWithOutline(ctx, text, x, y, fill, outline = 'rgba(5, 8, 16, 0.92)') {
  ctx.lineWidth = 4;
  ctx.strokeStyle = outline;
  ctx.strokeText(text, x, y);
  ctx.fillStyle = fill;
  ctx.fillText(text, x, y);
}

function overlaps(rect, placed) {
  for (const r of placed) {
    if (rect.x < r.x + r.w && rect.x + rect.w > r.x && rect.y < r.y + r.h && rect.y + rect.h > r.y) return true;
  }
  return false;
}

export function formatDistance(km) {
  if (km >= 100) return `${Math.round(km).toLocaleString()} km`;
  if (km >= 1) return `${km.toFixed(1)} km`;
  return `${Math.round(km * 1000)} m`;
}

/**
 * Draws the overlay and returns the screen positions of visible markers
 * so clicks can be matched to locations.
 */
export function drawOverlay(ctx, s) {
  const { view } = s;
  ctx.clearRect(0, 0, view.width, view.height);
  const hits = [];

  if (s.layers.graticule) drawGraticule(ctx, view);

  // Region names.
  if (s.layers.regions && s.world && s.planet.regions?.length && s.layers.labels) {
    ctx.font = `20px ${LABEL_FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    s.planet.regions.forEach((r, i) => {
      const c = s.world.regionCenters[i];
      if (!c || !c.count) return;
      const p = project(view, c.vec);
      if (p.z < 0.25) return;
      ctx.globalAlpha = Math.min(1, (p.z - 0.25) * 4);
      textWithOutline(ctx, r.name.toUpperCase(), p.x, p.y, r.color);
      ctx.globalAlpha = 1;
    });
  }

  // Measuring line.
  if (s.measure && s.measure.points.length) {
    const pts = s.measure.points.slice();
    if (s.measure.cursor) pts.push(s.measure.cursor);
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.strokeStyle = '#ffb347';
    let total = 0;
    for (let i = 1; i < pts.length; i++) {
      const steps = Math.max(8, Math.ceil(angleBetween(pts[i - 1], pts[i]) * 60));
      strokeSphereLine(ctx, view, greatCircle(pts[i - 1], pts[i], steps));
    }
    ctx.setLineDash([]);
    ctx.font = `18px ${LABEL_FONT}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    pts.forEach((v, i) => {
      if (i > 0) total += angleBetween(pts[i - 1], v) * (s.measure.diameter / 2);
      const p = project(view, v);
      if (p.z <= 0) return;
      ctx.fillStyle = '#ffb347';
      ctx.fillRect(p.x - 3, p.y - 3, 6, 6);
      if (i > 0) textWithOutline(ctx, formatDistance(total), p.x + 8, p.y - 10, '#ffd59a');
    });
  }

  // Location markers and labels.
  if (s.layers.markers && s.locations.length) {
    const zoomedIn = view.R > 650;
    const scale = zoomedIn ? 3 : 2;
    const placed = [];
    const visible = [];
    for (const loc of s.locations) {
      const p = project(view, latLonToVec(loc.lat, loc.lon));
      if (p.z < 0.04) continue;
      const type = getLocationType(loc.type);
      const priority = (loc.id === s.selectedId ? 100 : 0) + (loc.id === s.hoverId ? 50 : 0) + type.size * 10;
      visible.push({ loc, p, type, priority });
    }
    // Draw low priority first so important icons end up on top.
    visible.sort((a, b) => a.priority - b.priority);
    for (const v of visible) {
      const sprite = getSprite(v.loc.type, scale);
      ctx.globalAlpha = Math.min(1, (v.p.z - 0.04) * 8) * (v.loc.secret ? 0.75 : 1);
      ctx.drawImage(sprite, Math.round(v.p.x - sprite.width / 2), Math.round(v.p.y - sprite.height / 2));
      ctx.globalAlpha = 1;
      hits.push({ id: v.loc.id, x: v.p.x, y: v.p.y, r: sprite.width / 2 + 2 });
      if (v.loc.id === s.selectedId) {
        const r = sprite.width / 2 + 4;
        ctx.strokeStyle = '#7df9ff';
        ctx.lineWidth = 2;
        const x0 = Math.round(v.p.x - r), y0 = Math.round(v.p.y - r), d = Math.round(r * 2), q = 5;
        ctx.beginPath();
        ctx.moveTo(x0, y0 + q); ctx.lineTo(x0, y0); ctx.lineTo(x0 + q, y0);
        ctx.moveTo(x0 + d - q, y0); ctx.lineTo(x0 + d, y0); ctx.lineTo(x0 + d, y0 + q);
        ctx.moveTo(x0 + d, y0 + d - q); ctx.lineTo(x0 + d, y0 + d); ctx.lineTo(x0 + d - q, y0 + d);
        ctx.moveTo(x0 + q, y0 + d); ctx.lineTo(x0, y0 + d); ctx.lineTo(x0, y0 + d - q);
        ctx.stroke();
      }
    }

    if (s.layers.labels) {
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      // Label the most important places first; skip labels that would overlap.
      for (const v of visible.slice().sort((a, b) => b.priority - a.priority)) {
        const important = v.priority >= 50;
        if (!important && v.type.size < 2 && !zoomedIn && view.R < 420) continue;
        const size = v.type.size >= 3 ? 22 : v.type.size === 2 ? 19 : 17;
        ctx.font = `${size}px ${LABEL_FONT}`;
        const text = v.loc.name || 'Unnamed';
        const w = ctx.measureText(text).width;
        const x = v.p.x + scale * 6 + 2;
        const rect = { x: x - 2, y: v.p.y - size / 2, w: w + 4, h: size };
        if (!important && overlaps(rect, placed)) continue;
        placed.push(rect);
        ctx.globalAlpha = Math.min(1, (v.p.z - 0.04) * 8);
        const fill = v.loc.id === s.selectedId ? '#7df9ff' : v.loc.secret ? '#ffb3c1' : '#eef6ff';
        textWithOutline(ctx, text, x, v.p.y, fill);
        ctx.globalAlpha = 1;
      }
    }
  }

  // Paint brush outline.
  if (s.brush) {
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 3]);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
    strokeSphereLine(ctx, view, sphereCircle(s.brush.vec, s.brush.radius, 72));
    ctx.setLineDash([]);
  }

  return hits;
}

// The star map: a pannable 2D chart of a region. Click a world to open it.
// In GM view, "Edit layout" lets you drag systems around, and clicking an
// uncharted system offers to create a planet there.

import { h, fill, $ } from './dom.js';
import { getStarMap, STAR_MAPS, GRID_INFO } from '../data/starMaps.js';
import { getType } from '../core/types.js';
import { requestThumbnail } from '../render/thumbnails.js';
import { mulberry32 } from '../core/rng.js';
import { openNewPlanetDialog } from './dialogs.js';

const FONT = '"VT323", "Courier New", monospace';
const TITLE_FONT = '"Silkscreen", "Courier New", monospace';

// Convex hull (monotone chain) of [x, y] points.
function hull(points) {
  const p = points.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (p.length < 3) return p;
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower = [];
  for (const pt of p) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], pt) <= 0) lower.pop();
    lower.push(pt);
  }
  const upper = [];
  for (let i = p.length - 1; i >= 0; i--) {
    const pt = p[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], pt) <= 0) upper.pop();
    upper.push(pt);
  }
  upper.pop();
  lower.pop();
  return lower.concat(upper);
}

export class StarMap {
  constructor(app) {
    this.app = app;
    this.el = $('#starmap');
    this.canvas = $('#starmapCanvas');
    this.ctx = this.canvas.getContext('2d');
    this.tip = $('#starmapTip');
    this.mapId = null;
    this.cam = { x: 0, y: 0, s: 1 };
    this.hover = null;
    this.pointer = null;
    this.editMode = false;
    this.thumbs = new Map();
    this.raf = 0;
    this.width = 1;
    this.height = 1;
    this.hits = [];
    this.bind();
  }

  get map() {
    return getStarMap(this.mapId);
  }

  get isOpen() {
    return !this.el.hidden;
  }

  // ---------- Opening and closing ----------

  open(mapId = STAR_MAPS[0]?.id, { area = null, planetId = null } = {}) {
    if (!getStarMap(mapId)) return;
    this.mapId = mapId;
    this.el.hidden = false;
    this.tip.hidden = true;
    this.resize();
    this.buildStars();
    this.renderPanel();
    if (planetId && this.nodes().has(planetId)) this.focusNode(planetId);
    else if (area) this.fitArea(area);
    else this.fitAll();
    history.replaceState(null, '', `#map=${encodeURIComponent(mapId)}${area ? `&area=${encodeURIComponent(area)}` : ''}`);
    this.app.ui.updateToolbar();
    this.render();
  }

  close() {
    if (!this.isOpen) return;
    this.el.hidden = true;
    this.tip.hidden = true;
    this.editMode = false;
    if (this.app.planet) history.replaceState(null, '', `#planet=${encodeURIComponent(this.app.planet.id)}`);
    this.app.ui.updateToolbar();
    this.app.requestRender();
  }

  toggle() {
    if (this.isOpen) this.close();
    else this.open(this.mapForPlanet(this.app.planet) || STAR_MAPS[0]?.id, { planetId: this.app.planet?.id });
  }

  mapForPlanet(planet) {
    return planet?.map && getStarMap(planet.map.id) ? planet.map.id : null;
  }

  // ---------- Map contents ----------

  planets() {
    return this.app.store.listPlanets().filter((p) => p.map && p.map.id === this.mapId);
  }

  // Every point on the map by id, with its current (possibly dragged) position.
  nodes() {
    const map = this.map;
    const layout = this.app.store.mapLayout(this.mapId);
    const out = new Map();
    const place = (id, x, y, kind, ref) => {
      const moved = layout[id];
      out.set(id, { id, x: moved ? moved.x : x, y: moved ? moved.y : y, kind, ref });
    };
    const replaced = new Map();
    for (const p of this.planets()) {
      place(p.id, p.map.x, p.map.y, 'planet', p);
      if (p.map.replaces) replaced.set(p.map.replaces, p.id);
    }
    for (const s of map.systems || []) {
      if (replaced.has(s.id)) continue;
      place(s.id, s.x, s.y, 'system', s);
    }
    for (const f of map.features || []) place(f.id, f.x, f.y, 'feature', f);
    // Ids of systems that became planets resolve to the planet.
    for (const [sysId, planetId] of replaced) if (out.has(planetId)) out.set(sysId, out.get(planetId));
    return out;
  }

  areaPoints(area, nodes) {
    const pts = [];
    const ids = new Set(area.members || []);
    for (const p of this.planets()) if (p.sector === area.name || p.map.area === area.id) ids.add(p.id);
    for (const id of ids) {
      const n = nodes.get(id);
      if (n) pts.push([n.x, n.y]);
    }
    return pts;
  }

  // ---------- Camera ----------

  resize() {
    const r = this.el.getBoundingClientRect();
    this.width = Math.max(1, Math.round(r.width));
    this.height = Math.max(1, Math.round(r.height));
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.dpr = dpr;
    this.canvas.width = Math.round(this.width * dpr);
    this.canvas.height = Math.round(this.height * dpr);
    this.canvas.style.width = `${this.width}px`;
    this.canvas.style.height = `${this.height}px`;
  }

  // Fit a map rectangle into the part of the screen the side panel does not cover.
  fitBounds(x0, y0, x1, y1) {
    const pad = 60;
    const panel = document.getElementById('starmapPanel');
    const wide = this.width > 820 && panel;
    const left = wide ? panel.offsetLeft + panel.offsetWidth : 0;
    // On phones the panel sits at the bottom instead.
    const bottom = !wide && panel ? panel.offsetHeight + 16 : 0;
    const availW = Math.max(160, this.width - left - pad * 2);
    const availH = Math.max(160, this.height - bottom - pad * 2);
    const s = Math.max(0.15, Math.min(1.8, availW / Math.max(1, x1 - x0), availH / Math.max(1, y1 - y0)));
    // Center of the free area, converted back to a camera center.
    const freeCx = left + pad + availW / 2;
    const freeCy = pad + availH / 2;
    this.cam = { s, x: (x0 + x1) / 2 - (freeCx - this.width / 2) / s, y: (y0 + y1) / 2 - (freeCy - this.height / 2) / s };
  }

  fitAll() {
    const nodes = [...this.nodes().values()];
    if (!nodes.length) {
      this.fitBounds(...this.map.bounds);
      return;
    }
    const xs = nodes.map((n) => n.x), ys = nodes.map((n) => n.y);
    this.fitBounds(Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys));
  }

  fitArea(areaId) {
    const area = (this.map.areas || []).find((a) => a.id === areaId);
    if (!area) return this.fitAll();
    const pts = this.areaPoints(area, this.nodes());
    if (!pts.length) return this.fitAll();
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    this.fitBounds(Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys));
  }

  focusNode(id) {
    const n = this.nodes().get(id);
    if (!n) return;
    this.cam = { x: n.x, y: n.y, s: 1.6 };
  }

  toScreen(x, y) {
    return [(x - this.cam.x) * this.cam.s + this.width / 2, (y - this.cam.y) * this.cam.s + this.height / 2];
  }

  toMap(sx, sy) {
    return [(sx - this.width / 2) / this.cam.s + this.cam.x, (sy - this.height / 2) / this.cam.s + this.cam.y];
  }

  zoomAt(sx, sy, factor) {
    const [mx, my] = this.toMap(sx, sy);
    this.cam.s = Math.max(0.15, Math.min(8, this.cam.s * factor));
    const [nx, ny] = this.toMap(sx, sy);
    this.cam.x += mx - nx;
    this.cam.y += my - ny;
    this.render();
  }

  buildStars() {
    const random = mulberry32(777);
    const [x0, y0, x1, y1] = this.map.bounds;
    const w = x1 - x0, h = y1 - y0;
    this.bgStars = Array.from({ length: Math.round((w * h) / 2500) }, () => ({
      x: x0 - w * 0.2 + random() * w * 1.4,
      y: y0 - h * 0.2 + random() * h * 1.4,
      b: random(),
    }));
  }

  thumb(planet) {
    const key = `${planet.id}|${planet.typeId}|${planet.seed}|${JSON.stringify(planet.params)}`;
    const cached = this.thumbs.get(planet.id);
    if (cached && cached.key === key) return cached.img;
    const entry = { key, img: null };
    this.thumbs.set(planet.id, entry);
    requestThumbnail(planet, 48, (url) => {
      const img = new Image();
      img.onload = () => {
        entry.img = img;
        this.render();
      };
      img.src = url;
    });
    return null;
  }

  // ---------- Drawing ----------

  render() {
    if (this.raf || !this.isOpen) return;
    this.raf = requestAnimationFrame(() => {
      this.raf = 0;
      this.draw();
    });
  }

  draw() {
    const { ctx, width: W, height: H, cam } = this;
    const map = this.map;
    const nodes = this.nodes();
    const gm = !this.app.playerView;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#061226';
    ctx.fillRect(0, 0, W, H);

    // Background stars and grid.
    for (const st of this.bgStars) {
      const [x, y] = this.toScreen(st.x, st.y);
      if (x < -2 || y < -2 || x > W + 2 || y > H + 2) continue;
      const v = 90 + Math.round(st.b * 120);
      ctx.fillStyle = `rgb(${v},${v + 10},${Math.min(255, v + 40)})`;
      const size = st.b > 0.95 ? 2 : 1;
      ctx.fillRect(Math.round(x), Math.round(y), size, size);
    }
    this.drawGalacticGrid(map);

    // Areas: a rounded outline around their member systems.
    for (const area of map.areas || []) {
      const pts = this.areaPoints(area, nodes);
      if (!pts.length) continue;
      const ring = [];
      const pad = area.padding || 30;
      for (const [x, y] of pts) for (let k = 0; k < 16; k++) ring.push([x + Math.cos((k / 16) * Math.PI * 2) * pad, y + Math.sin((k / 16) * Math.PI * 2) * pad]);
      const outline = hull(ring);
      ctx.beginPath();
      outline.forEach(([x, y], i) => {
        const [sx, sy] = this.toScreen(x, y);
        if (i) ctx.lineTo(sx, sy);
        else ctx.moveTo(sx, sy);
      });
      ctx.closePath();
      ctx.fillStyle = `${area.color}1f`;
      ctx.fill();
      ctx.setLineDash([6, 5]);
      ctx.strokeStyle = `${area.color}88`;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.setLineDash([]);
      const [lx, ly] = area.label ? this.toScreen(...area.label) : this.toScreen(pts[0][0], pts[0][1] - pad);
      ctx.save();
      ctx.translate(lx, ly);
      ctx.rotate(area.labelAngle || 0);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.font = `${Math.round(Math.max(16, Math.min(40, 30 * cam.s)))}px ${TITLE_FONT}`;
      ctx.fillStyle = `${area.color}aa`;
      ctx.fillText(area.name, 0, 0);
      if (area.subtitle && cam.s > 0.6) {
        ctx.font = `${Math.round(Math.max(14, Math.min(26, 20 * cam.s)))}px ${FONT}`;
        ctx.fillStyle = `${area.color}88`;
        ctx.fillText(area.subtitle, 2, Math.max(16, Math.min(34, 26 * cam.s)));
      }
      ctx.restore();
    }

    // Hyperspace lanes.
    const lanePts = (lane) => lane.path.map((p) => (typeof p === 'string' ? nodes.get(p) && [nodes.get(p).x, nodes.get(p).y] : p)).filter(Boolean).map((p) => this.toScreen(p[0], p[1]));
    for (const lane of map.lanes || []) {
      const pts = lanePts(lane);
      if (pts.length < 2) continue;
      const trace = () => {
        ctx.beginPath();
        ctx.moveTo(pts[0][0], pts[0][1]);
        if (lane.style === 'major') {
          for (let i = 1; i < pts.length - 1; i++) {
            const mx = (pts[i][0] + pts[i + 1][0]) / 2, my = (pts[i][1] + pts[i + 1][1]) / 2;
            ctx.quadraticCurveTo(pts[i][0], pts[i][1], mx, my);
          }
          ctx.lineTo(pts[pts.length - 1][0], pts[pts.length - 1][1]);
        } else {
          for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
        }
      };
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      if (lane.style === 'major') {
        trace();
        ctx.strokeStyle = 'rgba(190, 230, 255, 0.18)';
        ctx.lineWidth = Math.max(5, 9 * cam.s);
        ctx.stroke();
        trace();
        ctx.strokeStyle = 'rgba(225, 245, 255, 0.75)';
        ctx.lineWidth = Math.max(1.5, 2.5 * cam.s);
        ctx.stroke();
      } else {
        trace();
        if (lane.style === 'dashed') ctx.setLineDash([6, 6]);
        ctx.strokeStyle = 'rgba(190, 225, 245, 0.55)';
        ctx.lineWidth = Math.max(1, 1.6 * cam.s);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      if (lane.name && cam.s > 0.55) {
        // Name along the longest segment.
        let best = 0, bi = 0;
        for (let i = 1; i < pts.length; i++) {
          const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
          if (d > best) { best = d; bi = i; }
        }
        if (best > 90) {
          const [ax, ay] = pts[bi - 1], [bx, by] = pts[bi];
          let ang = Math.atan2(by - ay, bx - ax);
          if (ang > Math.PI / 2) ang -= Math.PI;
          if (ang < -Math.PI / 2) ang += Math.PI;
          ctx.save();
          ctx.translate((ax + bx) / 2, (ay + by) / 2);
          ctx.rotate(ang);
          ctx.font = `16px ${FONT}`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'bottom';
          ctx.fillStyle = 'rgba(200, 235, 255, 0.7)';
          ctx.fillText(lane.name, 0, -4);
          ctx.restore();
        }
      }
    }

    // Systems, features and planets.
    this.hits = [];
    const labels = [];
    const labelSize = Math.round(Math.max(14, Math.min(20, 13 + 6 * cam.s)));
    const current = this.app.planet?.id;
    const drawn = new Set();
    for (const n of nodes.values()) {
      if (drawn.has(n)) continue; // a system that became a planet is listed twice
      drawn.add(n);
      const [x, y] = this.toScreen(n.x, n.y);
      if (x < -60 || y < -60 || x > W + 60 || y > H + 60) continue;
      const hovered = this.hover === n.id;
      if (n.kind === 'system') {
        const r = Math.max(2, 2.5 * Math.min(cam.s, 2));
        ctx.fillStyle = hovered ? '#7df9ff' : 'rgba(235, 245, 255, 0.85)';
        ctx.fillRect(Math.round(x - r), Math.round(y - r), Math.round(r * 2), Math.round(r * 2));
        this.hits.push({ id: n.id, x, y, r: Math.max(8, r + 5), node: n });
        if (cam.s > 0.5) labels.push({ text: n.ref.label || '', x, y, off: r + 4, color: 'rgba(170, 195, 220, 0.8)', size: labelSize - 3, prio: 0 });
      } else if (n.kind === 'feature') {
        const r = Math.max(4, 6 * Math.min(cam.s, 2));
        if (n.ref.kind === 'nebula') {
          const rr = Math.max(30, 110 * cam.s);
          const g = ctx.createRadialGradient(x, y, 0, x, y, rr);
          g.addColorStop(0, 'rgba(170, 120, 255, 0.28)');
          g.addColorStop(1, 'rgba(170, 120, 255, 0)');
          ctx.fillStyle = g;
          ctx.beginPath(); ctx.arc(x, y, rr, 0, Math.PI * 2); ctx.fill();
        } else if (n.ref.kind === 'pulsar') {
          ctx.strokeStyle = 'rgba(125, 249, 255, 0.85)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(x - r * 2.6, y); ctx.lineTo(x + r * 2.6, y);
          ctx.moveTo(x, y - r * 2.6); ctx.lineTo(x, y + r * 2.6);
          ctx.stroke();
          ctx.fillStyle = 'rgba(125, 249, 255, 0.25)';
          ctx.beginPath(); ctx.arc(x, y, r * 1.8, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#e8ffff';
          ctx.beginPath(); ctx.arc(x, y, r * 0.8, 0, Math.PI * 2); ctx.fill();
        } else {
          ctx.fillStyle = 'rgba(255, 220, 140, 0.3)';
          ctx.beginPath(); ctx.arc(x, y, r * 1.5, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#fff2c4';
          ctx.beginPath(); ctx.arc(x, y, r * 0.75, 0, Math.PI * 2); ctx.fill();
        }
        this.hits.push({ id: n.id, x, y, r: r * 2, node: n });
        labels.push({ text: n.ref.name, x, y, off: r * 2 + 4, color: '#bff8ff', size: labelSize, prio: 2 });
      } else {
        const p = n.ref;
        const size = Math.round(Math.max(14, Math.min(44, 22 * cam.s)));
        const img = this.thumb(p);
        if (p.id === current || hovered) {
          ctx.strokeStyle = p.id === current ? '#ffd23f' : '#7df9ff';
          ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(x, y, size / 2 + 4, 0, Math.PI * 2); ctx.stroke();
        }
        if (img) ctx.drawImage(img, Math.round(x - size / 2), Math.round(y - size / 2), size, size);
        else {
          ctx.fillStyle = '#4b6a8f';
          ctx.beginPath(); ctx.arc(x, y, size / 2.4, 0, Math.PI * 2); ctx.fill();
        }
        this.hits.push({ id: n.id, x, y, r: size / 2 + 4, node: n });
        labels.push({ text: p.name, x, y, off: size / 2 + 5, color: p.id === current ? '#ffd23f' : '#eef6ff', size: labelSize, prio: p.id === current ? 4 : 3 });
      }
    }

    // Labels, most important first. Each tries the right side, then left,
    // below and above, and is skipped only if every spot overlaps another label.
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const placed = [];
    const overlaps = (r) => placed.some((o) => r.x < o.x + o.w && r.x + r.w > o.x && r.y < o.y + o.h && r.y + r.h > o.y);
    labels.sort((a, b) => b.prio - a.prio);
    for (const l of labels) {
      if (!l.text) continue;
      ctx.font = `${l.size}px ${FONT}`;
      const w = ctx.measureText(l.text).width;
      const spots = [
        [l.x + l.off, l.y],
        [l.x - l.off - w, l.y],
        [l.x - w / 2, l.y + l.off + l.size / 2],
        [l.x - w / 2, l.y - l.off - l.size / 2],
      ];
      let spot = null;
      for (const [tx, ty] of spots) {
        const rect = { x: tx - 2, y: ty - l.size / 2, w: w + 4, h: l.size };
        if (!overlaps(rect)) { spot = [tx, ty, rect]; break; }
      }
      if (!spot) {
        if (l.prio < 4) continue;
        spot = [spots[0][0], spots[0][1], { x: spots[0][0] - 2, y: spots[0][1] - l.size / 2, w: w + 4, h: l.size }];
      }
      placed.push(spot[2]);
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(4, 10, 22, 0.9)';
      ctx.strokeText(l.text, spot[0], spot[1]);
      ctx.fillStyle = l.color;
      ctx.fillText(l.text, spot[0], spot[1]);
    }

    if (this.editMode && gm) {
      ctx.font = `18px ${FONT}`;
      ctx.fillStyle = '#ffd23f';
      ctx.textAlign = 'center';
      ctx.fillText('Edit layout: drag systems to move them', W / 2, H - 18);
    }
  }

  // The galactic grid squares (like S-11) behind everything.
  drawGalacticGrid(map) {
    const { ctx, width: W, height: H } = this;
    const { size, origin, columns } = GRID_INFO;
    const labels = map.gridLabels;
    if (!labels) return;
    const cols = labels.columns.map((c) => columns.indexOf(c));
    const x0 = origin.x + Math.min(...cols) * size, x1 = origin.x + (Math.max(...cols) + 1) * size;
    const y0 = origin.y + (Math.min(...labels.rows) - 1) * size, y1 = origin.y + Math.max(...labels.rows) * size;
    ctx.strokeStyle = 'rgba(125, 249, 255, 0.09)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = x0; x <= x1; x += size) {
      const [sx, sy0] = this.toScreen(x, y0);
      const [, sy1] = this.toScreen(x, y1);
      ctx.moveTo(Math.round(sx) + 0.5, sy0);
      ctx.lineTo(Math.round(sx) + 0.5, sy1);
    }
    for (let y = y0; y <= y1; y += size) {
      const [sx0, sy] = this.toScreen(x0, y);
      const [sx1] = this.toScreen(x1, y);
      ctx.moveTo(sx0, Math.round(sy) + 0.5);
      ctx.lineTo(sx1, Math.round(sy) + 0.5);
    }
    ctx.stroke();
    ctx.font = `16px ${FONT}`;
    ctx.fillStyle = 'rgba(125, 249, 255, 0.35)';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    for (const c of labels.columns) {
      for (const r of labels.rows) {
        const [sx, sy] = this.toScreen(origin.x + columns.indexOf(c) * size, origin.y + (r - 1) * size);
        if (sx > -40 && sy > -20 && sx < W && sy < H) ctx.fillText(`${c}-${r}`, sx + 5, sy + 4);
      }
    }
  }

  // ---------- Side panel and tooltip ----------

  renderPanel() {
    const map = this.map;
    const gm = !this.app.playerView;
    const editBtn = h('button', {
      class: `btn small gm-only${this.editMode ? ' primary' : ''}`, icon: 'edit',
      onclick: () => {
        this.editMode = !this.editMode;
        this.renderPanel();
        this.render();
      },
    }, this.editMode ? 'Done editing' : 'Edit layout');
    fill($('#starmapPanel'),
      h('div', { class: 'sm-title' }, map.name),
      h('div', { class: 'small muted' }, `${this.planets().length} worlds charted`),
      h('div', { class: 'sm-buttons' },
        h('button', { class: 'btn small', onclick: () => { this.fitAll(); this.render(); } }, 'Whole map'),
        (map.areas || []).map((a) => h('button', { class: 'btn small', onclick: () => { this.fitArea(a.id); this.render(); } }, a.name)),
      ),
      gm ? h('div', { class: 'sm-buttons' },
        editBtn,
        h('button', {
          class: 'btn small gm-only', icon: 'reset',
          onclick: async () => {
            const ok = await this.app.ui.confirm('Reset the map layout?', 'Every system you dragged on this map goes back to its original position.', 'Reset', true);
            if (!ok) return;
            this.app.store.resetMapLayout(this.mapId);
            this.render();
          },
        }, 'Reset layout'),
      ) : null,
      h('p', { class: 'small muted' }, map.description),
      h('button', { class: 'btn small block', icon: 'close', onclick: () => this.close() }, 'Back to the globe (Esc)'),
    );
  }

  showTip(hit, sx, sy) {
    const n = hit.node;
    const gm = !this.app.playerView;
    let content;
    if (n.kind === 'planet') {
      const p = n.ref;
      const type = getType(p.typeId);
      const text = p.description.length > 220 ? `${p.description.slice(0, 217)}...` : p.description;
      content = [
        h('div', { class: 'tip-title' }, p.name),
        h('div', { class: 'small muted' }, [type.name, p.sector || p.region].filter(Boolean).join(' / ')),
        text ? h('p', { class: 'small' }, text) : null,
        h('div', { class: 'small tip-hint' }, 'Click to open'),
      ];
    } else if (n.kind === 'feature') {
      content = [
        h('div', { class: 'tip-title' }, n.ref.name),
        n.ref.notes ? h('p', { class: 'small' }, n.ref.notes) : null,
        gm && n.ref.gmNotes ? h('p', { class: 'small gm-note' }, `GM: ${n.ref.gmNotes}`) : null,
      ];
    } else {
      content = [
        h('div', { class: 'tip-title' }, `Uncharted system ${n.ref.label || ''}`.trim()),
        h('div', { class: 'small muted' }, gm ? 'Click to create a planet here' : 'No records yet'),
      ];
    }
    fill(this.tip, content);
    this.tip.hidden = false;
    const tw = this.tip.offsetWidth, th = this.tip.offsetHeight;
    this.tip.style.left = `${Math.min(this.width - tw - 8, sx + 16)}px`;
    this.tip.style.top = `${Math.max(8, Math.min(this.height - th - 8, sy + 12))}px`;
  }

  hitAt(sx, sy) {
    let best = null, bestD = Infinity;
    for (const hit of this.hits) {
      const d = Math.hypot(hit.x - sx, hit.y - sy);
      if (d <= hit.r && d < bestD) { best = hit; bestD = d; }
    }
    return best;
  }

  // ---------- Input ----------

  bind() {
    const c = this.canvas;
    const local = (e) => {
      const r = c.getBoundingClientRect();
      return [e.clientX - r.left, e.clientY - r.top];
    };
    c.addEventListener('contextmenu', (e) => e.preventDefault());
    c.addEventListener('pointerdown', (e) => {
      c.setPointerCapture(e.pointerId);
      const [sx, sy] = local(e);
      const hit = this.hitAt(sx, sy);
      const draggable = hit && this.editMode && !this.app.playerView;
      this.pointer = { id: e.pointerId, sx, sy, last: [sx, sy], moved: false, hit, drag: draggable ? hit.node : null };
    });
    c.addEventListener('pointermove', (e) => {
      const [sx, sy] = local(e);
      const p = this.pointer;
      if (!p) {
        const hit = this.hitAt(sx, sy);
        const id = hit ? hit.id : null;
        if (id !== this.hover) {
          this.hover = id;
          this.render();
        }
        c.style.cursor = hit ? 'pointer' : 'grab';
        if (hit) this.showTip(hit, sx, sy);
        else this.tip.hidden = true;
        return;
      }
      if (Math.hypot(sx - p.sx, sy - p.sy) > 4) p.moved = true;
      if (!p.moved) return;
      this.tip.hidden = true;
      if (p.drag) {
        const [mx, my] = this.toMap(sx, sy);
        p.drag.x = mx;
        p.drag.y = my;
        this.app.store.setMapPosition(this.mapId, p.drag.id, mx, my);
      } else {
        this.cam.x -= (sx - p.last[0]) / this.cam.s;
        this.cam.y -= (sy - p.last[1]) / this.cam.s;
        c.style.cursor = 'grabbing';
      }
      p.last = [sx, sy];
      this.render();
    });
    const end = (e) => {
      const p = this.pointer;
      this.pointer = null;
      if (!p || p.id !== e.pointerId || e.type === 'pointercancel') return;
      c.style.cursor = 'grab';
      if (p.moved || !p.hit) return;
      this.clickNode(p.hit.node);
    };
    c.addEventListener('pointerup', end);
    c.addEventListener('pointercancel', end);
    c.addEventListener('pointerleave', () => {
      this.tip.hidden = true;
      if (this.hover) {
        this.hover = null;
        this.render();
      }
    });
    c.addEventListener('wheel', (e) => {
      e.preventDefault();
      const [sx, sy] = local(e);
      let d = e.deltaY;
      if (e.deltaMode === 1) d *= 16;
      this.zoomAt(sx, sy, Math.exp(-d * (e.ctrlKey ? 0.01 : 0.0015)));
    }, { passive: false });
    c.addEventListener('dblclick', (e) => {
      const [sx, sy] = local(e);
      if (!this.hitAt(sx, sy)) this.zoomAt(sx, sy, 2);
    });
    new ResizeObserver(() => {
      if (!this.isOpen) return;
      this.resize();
      this.render();
    }).observe(this.el);
  }

  clickNode(n) {
    if (n.kind === 'planet') {
      this.close();
      this.app.selectPlanet(n.ref.id);
      this.app.ui.closeMobileMenu();
    } else if (n.kind === 'system' && !this.app.playerView) {
      const area = (this.map.areas || []).find((a) => a.id === n.ref.area);
      openNewPlanetDialog(this.app, {
        region: this.map.name,
        sector: area ? area.name : '',
        map: { id: this.mapId, x: Math.round(n.x), y: Math.round(n.y), replaces: n.ref.id },
        name: '',
      });
    }
  }
}

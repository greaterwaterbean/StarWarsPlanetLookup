// Mouse, touch, wheel and keyboard input for the globe.
//
// Every left-button press starts in a "mode" picked from the current tool.
// If the pointer moves more than a few pixels, most modes turn into a rotate
// drag instead, so you can always spin the planet without switching tools.

import { unproject } from './render/camera.js';
import { DEG } from './core/sphere.js';

const CLICK_SLOP = 4;
const PIXEL_STEPS = [1, 2, 3, 4, 6, 8];

export function bindControls(app) {
  const el = app.overlay;
  const pointers = new Map();
  let pinch = null;
  let hudPos = null;
  let hudQueued = false;

  const local = (e) => {
    const r = el.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const hitMarker = (x, y) => {
    let best = null;
    let bestD = Infinity;
    for (const m of app.markerHits) {
      const d = Math.hypot(m.x - x, m.y - y);
      if (d <= m.r && d < bestD) { best = m; bestD = d; }
    }
    return best;
  };

  const queueHud = (pos) => {
    hudPos = pos;
    if (hudQueued) return;
    hudQueued = true;
    requestAnimationFrame(() => {
      hudQueued = false;
      if (hudPos) app.ui.updateHud(hudPos.x, hudPos.y);
      else app.ui.updateHud(null);
    });
  };

  const startInertia = (p) => {
    const now = performance.now();
    const recent = p.samples.filter((s) => now - s.t < 90);
    if (!recent.length || now - p.lastMoveTime > 70) return;
    let dx = 0, dy = 0;
    for (const s of recent) { dx += s.dx; dy += s.dy; }
    const span = Math.max(16, now - recent[0].t);
    const R = app.view().R;
    const lat = app.camera.lat * DEG;
    app.velocity = {
      lon: -((dx / span) / R) / Math.max(Math.cos(lat), 0.3) / DEG,
      lat: ((dy / span) / R) / DEG,
    };
    app.requestRender();
  };

  el.addEventListener('contextmenu', (e) => e.preventDefault());

  el.addEventListener('pointerdown', (e) => {
    el.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, local(e));
    if (pointers.size === 2) {
      // Second finger: switch to pinch zoom and cancel the one-finger action.
      if (app.pointer?.mode === 'paint' || app.pointer?.mode === 'marker') app.commitEdit();
      app.pointer = null;
      const [a, b] = [...pointers.values()];
      pinch = { dist: Math.hypot(a.x - b.x, a.y - b.y), mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } };
      return;
    }
    if (pointers.size > 2) return;

    const pos = local(e);
    app.velocity = null;
    app.fly = null;
    const p = { id: e.pointerId, button: e.button, start: pos, last: pos, moved: false, mode: 'rotate', samples: [], lastMoveTime: 0 };
    if (e.button === 0) {
      if (app.tool === 'select') {
        const hit = hitMarker(pos.x, pos.y);
        if (hit) {
          p.mode = app.playerView ? 'click-marker' : 'marker';
          p.markerId = hit.id;
        } else {
          p.mode = 'rotate-click';
        }
      } else if (app.tool === 'add') {
        p.mode = 'add';
      } else if (app.tool === 'paint') {
        const v = unproject(app.view(), pos.x, pos.y);
        if (v) {
          p.mode = 'paint';
          app.beginEdit();
          app.paintStroke(null, v);
          p.lastVec = v;
        }
      } else if (app.tool === 'measure') {
        p.mode = 'measure';
      }
    }
    app.pointer = p;
  });

  el.addEventListener('pointermove', (e) => {
    const pos = local(e);
    if (pointers.has(e.pointerId)) pointers.set(e.pointerId, pos);

    if (pinch && pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      app.rotateBy(mid.x - pinch.mid.x, mid.y - pinch.mid.y);
      if (pinch.dist > 0) app.zoomAt(mid.x, mid.y, dist / pinch.dist);
      pinch = { dist, mid };
      return;
    }

    const p = app.pointer;
    if (!p) {
      // Just hovering.
      const hit = app.tool === 'select' ? hitMarker(pos.x, pos.y) : null;
      const hid = hit ? hit.id : null;
      if (hid !== app.hoverId) {
        app.hoverId = hid;
        app.requestRender(false);
      }
      el.classList.toggle('over-marker', !!hit);
      if (app.tool === 'paint') {
        app.brushVec = unproject(app.view(), pos.x, pos.y);
        app.requestRender(false);
      }
      if (app.tool === 'measure' && app.measure.points.length) {
        app.measure.cursor = unproject(app.view(), pos.x, pos.y);
        app.ui.updateMeasure();
        app.requestRender(false);
      }
      queueHud(pos);
      return;
    }
    if (p.id !== e.pointerId) return;

    const dx = pos.x - p.last.x;
    const dy = pos.y - p.last.y;
    if (Math.hypot(pos.x - p.start.x, pos.y - p.start.y) > CLICK_SLOP) p.moved = true;

    if (p.mode === 'paint') {
      const v = unproject(app.view(), pos.x, pos.y);
      if (v) {
        app.paintStroke(p.lastVec, v);
        p.lastVec = v;
      }
      app.brushVec = v;
      queueHud(pos);
    } else if (p.mode === 'marker') {
      if (p.moved) {
        const v = unproject(app.view(), pos.x, pos.y);
        const loc = app.getLocation(p.markerId);
        if (v && loc) {
          app.beginEdit();
          app.moveLocation(loc, v);
        }
      }
    } else if (p.moved) {
      if (!p.rotating) {
        // Count the movement since the press so the drag does not jump.
        p.rotating = true;
        el.classList.add('dragging');
      }
      app.rotateBy(dx, dy);
      const t = performance.now();
      p.samples.push({ dx, dy, t });
      if (p.samples.length > 12) p.samples.shift();
      p.lastMoveTime = t;
    }
    p.last = pos;
  });

  const end = (e) => {
    pointers.delete(e.pointerId);
    if (pinch) {
      if (pointers.size < 2) pinch = null;
      app.pointer = null;
      return;
    }
    const p = app.pointer;
    if (!p || p.id !== e.pointerId) return;
    app.pointer = null;
    el.classList.remove('dragging');
    const pos = local(e);
    const cancelled = e.type === 'pointercancel';

    switch (p.mode) {
      case 'rotate-click':
        if (!p.moved && !cancelled) app.selectCell(app.cellAtScreen(pos.x, pos.y));
        else startInertia(p);
        break;
      case 'rotate':
        if (!p.moved && p.button === 2 && app.tool === 'measure') {
          app.measure.points = [];
          app.measure.cursor = null;
          app.ui.updateMeasure();
          app.requestRender(false);
        } else if (p.moved) startInertia(p);
        break;
      case 'marker':
        if (p.moved) {
          app.commitEdit();
          app.ui.onSelectionChanged();
        } else app.selectLocation(p.markerId);
        break;
      case 'click-marker':
        if (!p.moved) app.selectLocation(p.markerId);
        else startInertia(p);
        break;
      case 'add':
        if (!p.moved && !cancelled) {
          const v = unproject(app.view(), pos.x, pos.y);
          if (v) app.addLocationAt(v);
        } else if (p.moved) startInertia(p);
        break;
      case 'measure':
        if (!p.moved && !cancelled) {
          const v = unproject(app.view(), pos.x, pos.y);
          if (v) {
            app.measure.points.push(v);
            app.ui.updateMeasure();
            app.requestRender(false);
          }
        } else if (p.moved) startInertia(p);
        break;
      case 'paint':
        app.commitEdit();
        app.ui.onWorldChanged();
        if (app.paint.mode === 'region') app.ui.renderPaint();
        break;
      default:
        break;
    }
    app.requestRender();
  };
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', end);

  el.addEventListener('pointerleave', () => {
    if (app.pointer) return;
    queueHud(null);
    if (app.brushVec) {
      app.brushVec = null;
      app.requestRender(false);
    }
    if (app.hoverId) {
      app.hoverId = null;
      app.requestRender(false);
    }
  });

  el.addEventListener('wheel', (e) => {
    e.preventDefault();
    const pos = local(e);
    let d = e.deltaY;
    if (e.deltaMode === 1) d *= 16;
    else if (e.deltaMode === 2) d *= 400;
    // Trackpad pinch arrives as ctrl+wheel with small deltas.
    const factor = Math.exp(-d * (e.ctrlKey ? 0.01 : 0.0015));
    app.zoomAt(pos.x, pos.y, factor);
  }, { passive: false });

  el.addEventListener('dblclick', (e) => {
    if (app.tool !== 'select' && app.tool !== 'measure') return;
    const pos = local(e);
    const v = unproject(app.view(), pos.x, pos.y);
    if (!v) return;
    const lat = Math.asin(Math.max(-1, Math.min(1, v[2]))) / DEG;
    const lon = Math.atan2(v[1], v[0]) / DEG;
    app.flyTo(lat, lon, Math.min(app.camera.zoom * 2, 40));
  });

  window.addEventListener('keydown', (e) => {
    const t = e.target;
    if (t.closest && t.closest('input, textarea, select, [contenteditable="true"]')) return;
    if (document.querySelector('dialog[open]')) return;
    const k = e.key;
    if (app.starmap.isOpen) {
      // While the star map is open only its own keys apply.
      if (k === 'Escape' || k === 's' || k === 'S') {
        e.preventDefault();
        app.starmap.close();
      }
      return;
    }
    if ((k === 's' || k === 'S') && !(e.ctrlKey || e.metaKey || e.altKey)) {
      e.preventDefault();
      app.starmap.toggle();
      return;
    }
    const mod = e.ctrlKey || e.metaKey;
    if (mod && (k === 'z' || k === 'Z')) {
      e.preventDefault();
      if (!app.playerView) e.shiftKey ? app.redo() : app.undo();
      return;
    }
    if (mod && (k === 'y' || k === 'Y')) {
      e.preventDefault();
      if (!app.playerView) app.redo();
      return;
    }
    if (mod || e.altKey) return;
    const step = Math.max(20, app.view().R * 0.15);
    let handled = true;
    switch (k) {
      case 'v': case 'V': app.setTool('select'); break;
      case 'l': case 'L': app.setTool('add'); break;
      case 'b': case 'B': app.setTool('paint'); break;
      case 'm': case 'M': app.setTool('measure'); break;
      case 'ArrowLeft': app.rotateBy(step, 0); break;
      case 'ArrowRight': app.rotateBy(-step, 0); break;
      case 'ArrowUp': app.rotateBy(0, step); break;
      case 'ArrowDown': app.rotateBy(0, -step); break;
      case '+': case '=': app.zoomBy(1.4); break;
      case '-': case '_': app.zoomBy(1 / 1.4); break;
      case 'r': case 'R': app.resetView(); break;
      case 'g': case 'G': app.setLayer('grid', !app.layers.grid); break;
      case 'c': case 'C': app.setLayer('clouds', !app.layers.clouds); break;
      case 'x': case 'X': {
        const i = PIXEL_STEPS.indexOf(app.pixelSize);
        app.setPixelSize(PIXEL_STEPS[(i + 1) % PIXEL_STEPS.length]);
        app.ui.renderView();
        app.toast(`Pixel size ${app.pixelSize}`);
        break;
      }
      case 'p': case 'P': app.setPlayerView(!app.playerView); break;
      case '?': case 'h': case 'H': document.getElementById('helpDialog').showModal(); break;
      case 'Escape':
        if (app.measure.points.length) {
          app.measure.points = [];
          app.measure.cursor = null;
          app.ui.updateMeasure();
        } else if (app.selectedId || app.selectedCell >= 0) {
          app.selectedId = null;
          app.selectedCell = -1;
          app.ui.onSelectionChanged();
        } else app.setTool('select');
        app.requestRender();
        break;
      case 'Delete': case 'Backspace':
        if (app.selectedId && !app.playerView) app.deleteLocation(app.selectedId);
        else handled = false;
        break;
      default:
        handled = false;
    }
    if (handled) e.preventDefault();
  });
}

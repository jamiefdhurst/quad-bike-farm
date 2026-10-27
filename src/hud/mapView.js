// The farm map on M, drawn on a canvas over the middle of the screen: the fixed ground (hud/farmMap.js) once to an offscreen canvas,
// then you, the girls, the vehicles and the items on top of it each frame it's open. The game carries on underneath.

import { MAP_COLOURS as C, mapTransform, placeMarkers, mapAngle } from './farmMap.js';
import { sprayRuns, SPRAY_CELL, DOUBLED } from '../world/spraying.js';

export class MapView {
  /** `features` from farmMapFeatures, `params` DEFAULT_MAP_PARAMS (tuned live). */
  constructor(root, features, params) {
    this.features = features;
    this.params = params;
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'farm-map';
    this.canvas.style.display = 'none';
    root.prepend(this.canvas); // under the prompt, the toasts and her captions, so you can still read what she says
    this.ctx = this.canvas.getContext('2d');
    this.ground = null; // the fixed layer, redrawn when the size changes
    this.groundKey = '';
    this.isOpen = false;
  }

  toggle(force) {
    this.isOpen = force ?? !this.isOpen;
    this.canvas.style.display = this.isOpen ? 'block' : 'none';
  }

  /** Redraw with `markers`: { kind: 'you'|'girl'|'vehicle'|'trailer'|'item', x, z, yaw?, colour, label, short?, help? (a girl stuck and calling) }. */
  draw(markers) {
    if (!this.isOpen) return;
    const p = this.params;
    const dpr = window.devicePixelRatio || 1;
    const side = Math.round(Math.min(window.innerWidth, window.innerHeight) * p.size);
    const px = Math.round(side * dpr);
    if (this.canvas.width !== px) {
      this.canvas.width = this.canvas.height = px;
      this.canvas.style.width = this.canvas.style.height = `${side}px`;
    }
    this.canvas.style.opacity = p.opacity;
    const t = mapTransform(this.features.bounds, side, side);
    const key = `${px}:${dpr}`;
    if (this.groundKey !== key) {
      this.ground = this.drawGround(t, px, dpr);
      this.groundKey = key;
    }
    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(this.ground, 0, 0);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.drawSprayed(ctx, t);
    this.drawLegend(ctx, t, markers);
    const order = { trailer: 0, item: 1, vehicle: 2, girl: 3, you: 4 };
    const placed = placeMarkers([...markers].sort((a, b) => order[a.kind] - order[b.kind]), t, 8);
    for (const m of placed) this.drawMarker(ctx, m, p.markerScale);
  }

  /** The lines you have sprayed (world/spraying.js): a strip a pass, darker where two passes overlap, and the field's outline while the job is on. */
  drawSprayed(ctx, t) {
    const sp = this.spray;
    if (!sp) return;
    if (this.sprayWanted?.()) {
      const [u0, v0] = t.toMap(sp.rect.minX, sp.rect.minZ);
      const [u1, v1] = t.toMap(sp.rect.maxX, sp.rect.maxZ);
      ctx.save();
      ctx.setLineDash([5, 4]);
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = C.ink;
      ctx.strokeRect(u0, v0, u1 - u0, v1 - v0);
      ctx.restore();
    }
    for (const run of sprayRuns(sp)) {
      const [u0, v0] = t.toMap(run.x0, run.z);
      const [u1, v1] = t.toMap(run.x1, run.z + SPRAY_CELL);
      ctx.fillStyle = run.state === DOUBLED ? 'rgba(30, 90, 50, 0.7)' : 'rgba(60, 140, 80, 0.5)';
      ctx.fillRect(u0, v0, u1 - u0 + 0.5, v1 - v0 + 0.5);
    }
  }

  drawGround(t, px, dpr) {
    const f = this.features;
    const c = document.createElement('canvas');
    c.width = c.height = px;
    const ctx = c.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const s = t.scale;
    const P = (x, z) => t.toMap(x, z);
    const rect = (r, fill) => {
      const [u0, v0] = P(r.minX, r.minZ);
      const [u1, v1] = P(r.maxX, r.maxZ);
      ctx.fillStyle = fill;
      ctx.fillRect(u0, v0, u1 - u0, v1 - v0);
    };
    const poly = (pts, fill, stroke) => {
      ctx.beginPath();
      pts.forEach(([x, z], i) => (i ? ctx.lineTo(...P(x, z)) : ctx.moveTo(...P(x, z))));
      ctx.closePath();
      if (fill) (ctx.fillStyle = fill), ctx.fill();
      if (stroke) (ctx.strokeStyle = stroke), ctx.stroke();
    };
    const line = (pts, width, colour) => {
      ctx.beginPath();
      pts.forEach(([x, z], i) => (i ? ctx.lineTo(...P(x, z)) : ctx.moveTo(...P(x, z))));
      ctx.lineWidth = width;
      ctx.strokeStyle = colour;
      ctx.stroke();
    };
    const disc = (x, z, r, fill) => {
      ctx.beginPath();
      ctx.arc(...P(x, z), r * s, 0, Math.PI * 2);
      ctx.fillStyle = fill;
      ctx.fill();
    };
    const W = t.width;

    // Paper, the neighbours' land, then each field.
    ctx.fillStyle = C.paper;
    ctx.fillRect(0, 0, W, W);
    rect(f.bounds, C.outside);
    for (const a of f.areas) rect(a.rect, a.fill);
    for (const wd of [f.wood, f.woodland]) {
      if (!wd) continue;
      if (wd === f.wood) rect(wd, C.wood);
      ctx.fillStyle = 'rgba(40, 70, 35, 0.35)';
      for (let x = wd.minX + 3; x < wd.maxX; x += 6) {
        for (let z = wd.minZ + 3 + ((x / 6) % 2) * 3; z < wd.maxZ; z += 6) {
          ctx.beginPath();
          ctx.arc(...P(x, z), Math.max(1.5, 1.8 * s), 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    // The yard's hardstanding, the paddock, the drag strip's gravel.
    if (f.yard) disc(f.yard.x, f.yard.z, f.yard.r, C.gravel);
    if (f.dragStrip) poly(f.dragStrip, C.gravel);
    if (f.neighbourYard) {
      // The neighbour's walled yard: gravel inside a wall.
      const y = f.neighbourYard;
      rect(y, C.gravel);
      const [u0, v0] = P(y.minX, y.minZ);
      const [u1, v1] = P(y.maxX, y.maxZ);
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = C.fence;
      ctx.strokeRect(u0, v0, u1 - u0, v1 - v0);
    }

    // The stream, wider over the ford.
    if (f.stream.length) {
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      for (let i = 1; i < f.stream.length; i++) {
        const a = f.stream[i - 1];
        const b = f.stream[i];
        line([[a.x, a.z], [b.x, b.z]], Math.max(2, (a.half + b.half) * s), C.water);
      }
    }

    // The gravel pit: the walls, the floor, the haul road winding down, the heaps and the line up the steep wall.
    if (f.quarryPit) {
      const qp = f.quarryPit;
      const loop = (pts, colour) => {
        ctx.beginPath();
        pts.forEach(([x, z], i) => (i ? ctx.lineTo(...P(x, z)) : ctx.moveTo(...P(x, z))));
        ctx.closePath();
        ctx.fillStyle = colour;
        ctx.fill();
      };
      loop(qp.rim, C.pit);
      loop(qp.floor, C.pitFloor);
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      line(qp.road, Math.max(2, qp.roadHalf * 2 * s), C.pitFloor);
      for (const h of qp.heaps) disc(h.x, h.z, h.r, C.gravel);
      ctx.setLineDash([3, 3]);
      line(qp.climb.map(([x, z]) => [x, z]), Math.max(1.5, 2 * s), C.ink);
      ctx.setLineDash([]);
    }

    // The ponds: the wet meadow's, the wood's and the pit's.
    for (const pd of [f.pond, f.woodsPond, f.quarryPit?.pond]) {
      if (!pd) continue;
      ctx.beginPath();
      ctx.ellipse(...P(pd.x, pd.z), pd.rx * s, pd.rz * s, 0, 0, Math.PI * 2);
      ctx.fillStyle = C.water;
      ctx.fill();
    }

    // The track: a brown loop, its bogs darker.
    const tp = f.track.points;
    ctx.lineJoin = 'round';
    line([...tp, tp[0]], Math.max(3, f.track.half * 2 * s), C.track);
    for (const b of f.bogs) disc(b.x, b.z, b.r, C.bog);
    // The Hollow Run through the wood, narrower: its lead-in from the gate, then the loop.
    if (f.woodsTrack) {
      const wt = f.woodsTrack;
      line(wt.leadIn, Math.max(2, wt.half * 2 * s), C.track);
      line([...wt.points, wt.points[0]], Math.max(2, wt.half * 2 * s), C.track);
      for (const b of f.woodsBogs) disc(b.x, b.z, b.r, C.bog);
    }
    // The Fern Trail: a thin dashed path, paler than the tracks, since it's a footpath-wide thing for two wheels.
    if (f.woodsTrail) {
      ctx.setLineDash([4, 3]);
      line([...f.woodsTrail.points, f.woodsTrail.points[0]], Math.max(1.5, f.woodsTrail.half * s), C.trail);
      ctx.setLineDash([]);
    }

    // The road and the hardstanding, edged.
    if (f.road) {
      const r = f.road;
      ctx.lineCap = 'butt';
      line([[r.x1, r.z], [r.x2, r.z]], r.half * 2 * s + 2, C.roadEdge);
      if (r.pad) disc(r.pad.x, r.pad.z, r.pad.r + 1 / s, C.roadEdge);
      line([[r.x1, r.z], [r.x2, r.z]], r.half * 2 * s, C.road);
      if (r.pad) disc(r.pad.x, r.pad.z, r.pad.r, C.road);
    }

    // Hedges, and the gates across their gaps (a shut one solid, the tied-open one dashed).
    ctx.lineCap = 'round';
    for (const h of f.hedges) line([[h.x1, h.z1], [h.x2, h.z2]], Math.max(2.5, h.width * s), C.hedge);
    ctx.lineCap = 'butt';
    for (const g of f.gates) {
      ctx.setLineDash(g.shut ? [] : [3, 3]);
      line([[g.from.x, g.from.z], [g.to.x, g.to.z]], 2, C.gate);
    }
    ctx.setLineDash([]);

    // The paddock rail, the ramp, the heap, the buildings.
    if (f.paddock) {
      const [u0, v0] = P(f.paddock.minX, f.paddock.minZ);
      const [u1, v1] = P(f.paddock.maxX, f.paddock.maxZ);
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = C.fence;
      ctx.strokeRect(u0, v0, u1 - u0, v1 - v0);
    }
    if (f.ramp) poly(f.ramp, C.fence);
    if (f.muckHeap) {
      ctx.beginPath();
      ctx.ellipse(...P(f.muckHeap.x, f.muckHeap.z), f.muckHeap.rx * s, f.muckHeap.rz * s, 0, 0, Math.PI * 2);
      ctx.fillStyle = C.muck;
      ctx.fill();
    }
    for (const b of [...f.buildings, ...f.small]) rect(b.rect, b.fill);

    // The names.
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const l of f.labels) {
      const [u, v] = P(l.x, l.z);
      ctx.font = l.kind === 'field' ? 'italic 600 13px Georgia, serif' : '11px system-ui, sans-serif';
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(240, 236, 222, 0.75)';
      ctx.strokeText(l.text, u, v);
      ctx.fillStyle = C.label;
      ctx.fillText(l.text, u, v);
    }

    // A north arrow and a 50 m scale bar in the bottom corner of the key's corner of the map, and a frame.
    const [nu, nv] = P(f.key.maxX - 6, f.key.maxZ - 34);
    ctx.fillStyle = C.ink;
    ctx.beginPath();
    ctx.moveTo(nu, nv - 12);
    ctx.lineTo(nu + 6, nv + 6);
    ctx.lineTo(nu, nv + 2);
    ctx.lineTo(nu - 6, nv + 6);
    ctx.closePath();
    ctx.fill();
    ctx.font = '600 11px system-ui, sans-serif';
    ctx.fillText('N', nu, nv - 20);
    const [su, sv] = P(f.key.maxX - 56, f.key.maxZ - 4);
    ctx.fillRect(su, sv, 50 * s, 3);
    ctx.fillRect(su, sv - 3, 1.5, 9);
    ctx.fillRect(su + 50 * s - 1.5, sv - 3, 1.5, 9);
    ctx.font = '10px system-ui, sans-serif';
    ctx.fillText('50 m', su + 25 * s, sv - 8);
    ctx.lineWidth = 2;
    ctx.strokeStyle = C.ink;
    ctx.strokeRect(1, 1, W - 2, W - 2);
    return c;
  }

  /** The key, in the neighbours' land south of the farm and east of the hill: a line for each person, vehicle and item on the map. */
  drawLegend(ctx, t, markers) {
    const k = this.features.key;
    const [u0, v0] = t.toMap(k.minX, k.minZ);
    const [u1, v1] = t.toMap(k.maxX, k.maxZ);
    const row = 15;
    const seen = new Set();
    const rows = markers.filter((m) => m.label && !seen.has(m.label) && seen.add(m.label));
    // The bottom right is the north arrow's and the scale bar's.
    const perCol = Math.max(1, Math.floor((v1 - v0 - 34) / row));
    const cols = Math.ceil(rows.length / perCol);
    const colWidth = (u1 - u0 - 30) / Math.max(1, cols);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.font = '11px system-ui, sans-serif';
    rows.forEach((m, i) => {
      const x = u0 + Math.floor(i / perCol) * colWidth;
      const y = v0 + 6 + (i % perCol) * row;
      this.drawMarker(ctx, { ...m, u: x + 6, v: y, yaw: Math.PI, off: false }, 0.85, true);
      ctx.fillStyle = C.ink;
      ctx.fillText(m.label, x + 16, y);
    });
  }

  drawMarker(ctx, m, scale, inKey = false) {
    ctx.save();
    ctx.translate(m.u, m.v);
    const k = scale;
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = C.ink;
    if (m.kind === 'you') {
      ctx.rotate(mapAngle(m.yaw ?? 0));
      ctx.beginPath();
      ctx.moveTo(0, -9 * k);
      ctx.lineTo(6 * k, 6 * k);
      ctx.lineTo(0, 3 * k);
      ctx.lineTo(-6 * k, 6 * k);
      ctx.closePath();
      ctx.fillStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.fill();
      ctx.stroke();
    } else if (m.kind === 'girl') {
      if (m.help) {
        // Stuck and calling for you: a red ring round her.
        ctx.beginPath();
        ctx.arc(0, 0, 11 * k, 0, Math.PI * 2);
        ctx.strokeStyle = '#e03a2e';
        ctx.lineWidth = 3;
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.arc(0, 0, 6 * k, 0, Math.PI * 2);
      ctx.fillStyle = m.colour;
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.font = `600 ${Math.round(8 * k)}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(m.short ?? '', 0, 0.5);
    } else if (m.kind === 'vehicle' || m.kind === 'trailer') {
      // A box along its heading, a notch at the front. The big ones are bigger.
      ctx.rotate(mapAngle(m.yaw ?? 0));
      const big = m.big ? 1.4 : 1;
      const w = (m.kind === 'trailer' ? 5 : 6) * k * big;
      const h = (m.kind === 'trailer' ? 7 : 9) * k * big;
      ctx.fillStyle = m.colour;
      ctx.beginPath();
      ctx.rect(-w / 2, -h / 2, w, h);
      ctx.fill();
      ctx.stroke();
      if (m.kind === 'vehicle') {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
        ctx.fillRect(-w / 2 + 1, -h / 2 + 1, w - 2, Math.max(1.5, h * 0.18));
      }
    } else {
      // An item: a small diamond.
      const d = 4 * k;
      ctx.beginPath();
      ctx.moveTo(0, -d);
      ctx.lineTo(d, 0);
      ctx.lineTo(0, d);
      ctx.lineTo(-d, 0);
      ctx.closePath();
      ctx.fillStyle = m.colour;
      ctx.fill();
      ctx.stroke();
    }
    if (m.off && !inKey) {
      ctx.restore();
      ctx.save();
      ctx.translate(m.u, m.v);
      ctx.strokeStyle = C.ink;
      ctx.setLineDash([2, 2]);
      ctx.beginPath();
      ctx.arc(0, 0, 9 * k, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }
}

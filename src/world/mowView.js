import * as THREE from 'three';

// What the mown lawns look like (world/mowing.js): over each lawn a thin skin that follows the ground, with a texture whose pixels are the cells
// of the grid. A cell cut going one way is paler, going back the other way darker, the way a roller lays a lawn's stripes, and each stripe fades
// as the grass grows back over the days. Plain lit material, so the daylight dims it with everything else.

const LIFT = 0.04; // metres the skin sits above the ground
const PX = 4; // texture pixels to a cell
const REDRAW_EVERY = 0.25; // seconds between redraws of a lawn that has changed
const PALE = [140, 184, 84]; // cut going one way: the blades lie away from you and catch the light
const DARK = [64, 108, 46]; // and the other: they lie towards you
const SEGMENT = 1; // metres between the skin's vertices

export class MowView {
  constructor({ scene, grid, heightAt, params }) {
    this.scene = scene;
    this.grid = grid;
    this.heightAt = heightAt;
    this.p = params;
    this.since = REDRAW_EVERY;
    this.lastDay = null;
    this.lawns = grid.lawns.map((l) => this.build(l));
  }

  build(lawn) {
    const { rect, cols, rows } = lawn;
    const w = rect.maxX - rect.minX;
    const d = rect.maxZ - rect.minZ;
    const nx = Math.max(1, Math.round(w / SEGMENT));
    const nz = Math.max(1, Math.round(d / SEGMENT));
    const geo = new THREE.PlaneGeometry(w, d, nx, nz).rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = rect.minX + w / 2 + pos.getX(i);
      const z = rect.minZ + d / 2 + pos.getZ(i);
      pos.setXYZ(i, x, this.heightAt(x, z) + LIFT, z);
    }
    geo.computeVertexNormals();
    const canvas = document.createElement('canvas');
    canvas.width = cols * PX;
    canvas.height = rows * PX;
    const ctx = canvas.getContext('2d');
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.generateMipmaps = false;
    const mat = new THREE.MeshStandardMaterial({ map: tex, transparent: true, depthWrite: false, roughness: 1, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.name = `mowedLawn_${lawn.id}`;
    mesh.receiveShadow = true;
    mesh.renderOrder = 1;
    mesh.visible = false;
    this.scene.add(mesh);
    return { lawn, mesh, ctx, tex, canvas };
  }

  /** Redraws what has changed, a few times a second (and at once when the day turns, so the stripes fade). */
  update(dt, day) {
    this.since += dt;
    if (!this.grid.dirty && day === this.lastDay) return;
    if (this.since < REDRAW_EVERY) return;
    this.since = 0;
    this.lastDay = day;
    this.grid.dirty = false;
    for (const v of this.lawns) this.draw(v, day);
  }

  draw(v, day) {
    const { lawn, ctx, canvas } = v;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    let any = false;
    for (let r = 0; r < lawn.rows; r++) {
      for (let c = 0; c < lawn.cols; c++) {
        const i = r * lawn.cols + c;
        const a = this.grid.stripe(lawn, i, day);
        if (a <= 0) continue;
        const col = lawn.dir[i] === 2 ? DARK : PALE;
        ctx.fillStyle = `rgba(${col[0]},${col[1]},${col[2]},${(0.7 * a).toFixed(3)})`;
        ctx.fillRect(c * PX, r * PX, PX, PX);
        any = true;
      }
    }
    v.mesh.visible = any;
    v.tex.needsUpdate = true;
  }

  /** Forces a redraw (a load, the panel). */
  refresh(day) {
    this.grid.dirty = true;
    this.since = REDRAW_EVERY;
    this.update(0, day);
  }
}

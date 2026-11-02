import * as THREE from 'three';
import { restGlass } from './cabMist.js';

// Draws the mist (mist.js) on the inside of a cab's glass. The screen is one plane 3 mm inside the glass, on the model's `rainGlass` group
// (so the rain's drops stay outside it), textured from the mist grid: a fine grey-white fog with a little grain, clearer where it has been
// wiped. The side windows and the back are the cab's other glass, given their own copy of the material so one cab's fog doesn't fog the
// next one's, which turns whiter and less see-through with the fog. Lit like the world (it is breath on glass, not a light), so it dims
// with the day.

const FOG = [226, 232, 235]; // the fog's colour
const MOST = 0.8; // the most opaque the screen's fog gets (0..1)
const INSIDE = -0.006; // metres: 3 mm inside the glass, which the rain group sits 3 mm outside of

export class CabMistView {
  /** @param {THREE.Object3D} model  the vehicle's model; @param {object} mist  its screen's grid from createCabMist */
  constructor(model, mist) {
    this.mist = mist;
    const rainGlass = model.getObjectByName('rainGlass');
    this.data = new Uint8Array(mist.cols * mist.rows * 4);
    this.grain = new Float32Array(mist.cols * mist.rows);
    let seed = 7919;
    for (let k = 0; k < this.grain.length; k++) this.grain[k] = (((seed = (seed * 16807) % 2147483647) / 2147483647) - 0.5) * 0.14;
    this.texture = new THREE.DataTexture(this.data, mist.cols, mist.rows, THREE.RGBAFormat);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.magFilter = this.texture.minFilter = THREE.LinearFilter;
    this.texture.generateMipmaps = false;
    this.texture.needsUpdate = true;
    const [x0, y0, x1, y1] = mist.box;
    this.screen = new THREE.Mesh(
      new THREE.PlaneGeometry(x1 - x0, y1 - y0),
      new THREE.MeshStandardMaterial({ map: this.texture, transparent: true, depthWrite: false, side: THREE.DoubleSide, roughness: 1, metalness: 0 }),
    );
    this.screen.name = 'mistScreen';
    this.screen.userData.keep = true;
    this.screen.position.set((x0 + x1) / 2, (y0 + y1) / 2, INSIDE);
    this.screen.renderOrder = 1; // after the glass, before the drops on the outside of it
    this.screen.visible = false;
    rainGlass.add(this.screen);
    this.rest = restMeshes(model, rainGlass).map((mesh) => {
      const material = mesh.material.clone();
      mesh.material = material;
      return { material, colour: material.color.clone(), opacity: material.opacity };
    });
    this.fog = new THREE.Color(FOG[0] / 255, FOG[1] / 255, FOG[2] / 255);
    this.drawn = -1;
  }

  /** Dims the fog with the day, as the rain's drops are. */
  setLight(light) {
    this.screen.material.color.setScalar(0.25 + 0.75 * light);
  }

  /** Redraws the screen from its grid and puts the other glass at `m.rest`. */
  update() {
    const m = this.mist;
    const d = this.data;
    let any = false;
    for (let k = 0; k < m.cells.length; k++) {
      const c = m.on[k] ? m.cells[k] : 0;
      if (c > 0.004) any = true;
      const g = 1 + this.grain[k];
      const o = k * 4;
      d[o] = Math.min(255, FOG[0] * g);
      d[o + 1] = Math.min(255, FOG[1] * g);
      d[o + 2] = Math.min(255, FOG[2] * g);
      d[o + 3] = Math.round(255 * MOST * Math.min(1, c * (1 + this.grain[k] * 0.6)));
    }
    this.screen.visible = any;
    this.texture.needsUpdate = true;
    for (const r of this.rest) {
      const look = restGlass(m.rest, r.opacity);
      r.material.opacity = look.opacity;
      r.material.color.copy(r.colour).lerp(this.fog, look.mix);
      r.material.roughness = 0.05 + 0.8 * m.rest;
    }
  }
}

const _centre = new THREE.Vector3();

/** The cab's glass other than the windscreen: every mesh using a material marked `userData.glass` whose middle isn't on the screen's glass. */
function restMeshes(model, rainGlass) {
  model.updateMatrixWorld(true);
  const [x0, y0, x1, y1] = rainGlass.userData.panes.flat().reduce((b, c) => [Math.min(b[0], c[0]), Math.min(b[1], c[1]), Math.max(b[2], c[0]), Math.max(b[3], c[1])], [Infinity, Infinity, -Infinity, -Infinity]);
  const out = [];
  model.traverse((o) => {
    if (!o.isMesh || !o.material?.userData?.glass || o.parent === rainGlass) return;
    o.geometry.computeBoundingBox();
    rainGlass.worldToLocal(o.geometry.boundingBox.getCenter(_centre).applyMatrix4(o.matrixWorld));
    const onScreen = Math.abs(_centre.z) < 0.05 && _centre.x > x0 - 0.05 && _centre.x < x1 + 0.05 && _centre.y > y0 - 0.05 && _centre.y < y1 + 0.05;
    if (!onScreen) out.push(o);
  });
  return out;
}

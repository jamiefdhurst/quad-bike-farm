import * as THREE from 'three';
import { antisolar, rainbowRows } from '../world/mist.js';

// The look of a rainbow (world/mist.js decides when and where): a ribbon of colour on a circle round the point opposite the sun, hung
// far off in the sky and following the camera so it never gets nearer. Added to the sky, so the stripes fade to nothing at both edges.
// Only the part above the horizon is drawn, so a low sun gives a tall bow and a high one gives none.

const DISTANCE = 900; // metres off, inside the camera's far plane
const STEPS = 72;
const COLOURS = ['#7a2cff', '#3d4cff', '#28b4ff', '#35e07a', '#f4ee3a', '#ff9a2e', '#ff3a2a']; // violet inside to red outside
const BANDS = COLOURS.length;

export class RainbowView {
  constructor(scene) {
    this.scene = scene;
    this.mesh = null;
    this.key = '';
    this.material = new THREE.MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
      fog: false,
    });
    this.colours = COLOURS.map((c) => new THREE.Color(c));
  }

  /** The bow's ribbon for this sun, as a new geometry: the edges are black, which with adding makes them soft. */
  build(axis, params) {
    const rows = rainbowRows(axis, STEPS, BANDS, params.innerDegrees, params.outerDegrees);
    const positions = [];
    const colours = [];
    const index = [];
    const rowStart = new Map();
    rows.forEach((row, i) => {
      if (!row) return;
      rowStart.set(i, positions.length / 3);
      row.forEach((d, j) => {
        positions.push(d.x * DISTANCE, d.y * DISTANCE, d.z * DISTANCE);
        // Vertex j is the edge between stripe j - 1 and stripe j; the outer and inner edges are black.
        const c = j === 0 || j === BANDS ? null : this.colours[j - 1].clone().lerp(this.colours[j], 0.5);
        colours.push(c ? c.r : 0, c ? c.g : 0, c ? c.b : 0);
      });
    });
    for (let i = 0; i < STEPS; i++) {
      if (!rowStart.has(i) || !rowStart.has(i + 1)) continue;
      const a = rowStart.get(i);
      const b = rowStart.get(i + 1);
      for (let j = 0; j < BANDS; j++) index.push(a + j, a + j + 1, b + j, a + j + 1, b + j + 1, b + j);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(colours, 3));
    g.setIndex(index);
    return g;
  }

  /** `strength` 0..1; `sunDir` is the direction to the sun; `camera` is what the bow follows; `light` dims it with the daylight. */
  update(strength, sunDir, camera, params, light = 1) {
    const on = strength > 0.01;
    if (this.mesh) this.mesh.visible = on;
    if (!on) return;
    const axis = antisolar(sunDir);
    // The sun moves slowly, so the ribbon is only rebuilt when it has moved a little (or the bow's width was edited).
    const key = `${axis.x.toFixed(2)},${axis.y.toFixed(2)},${axis.z.toFixed(2)},${params.innerDegrees},${params.outerDegrees}`;
    if (!this.mesh || key !== this.key) {
      const old = this.mesh?.geometry;
      const geometry = this.build(axis, params);
      if (!this.mesh) {
        this.mesh = new THREE.Mesh(geometry, this.material);
        this.mesh.frustumCulled = false; // it moves with the camera and is big
        this.scene.add(this.mesh);
      } else this.mesh.geometry = geometry;
      old?.dispose();
      this.key = key;
    }
    this.mesh.visible = true;
    this.mesh.position.copy(camera.position);
    this.material.opacity = strength * params.maxOpacity * light;
  }
}

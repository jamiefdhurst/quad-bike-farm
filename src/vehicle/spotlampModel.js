import * as THREE from 'three';
import { glowTexture, LENS_GLOW } from './quadModel.js';

// The spotlamps' look: a pair of chrome-backed round lamps on short stalks above the headlamps, hidden until fitted at the bench. The lens
// glows and a halo blooms when they are on. The real light is the pool's (effects/vehicleLights.js), which reads `userData.spotLamps`
// (the lenses, pointing along +z like the headlamp beams) off the model.

const HOUSING = new THREE.MeshStandardMaterial({ color: 0x1b1b1d, metalness: 0.7, roughness: 0.4 });
const RIM = new THREE.MeshStandardMaterial({ color: 0xb9bdc2, metalness: 0.9, roughness: 0.25 });
const STALK = new THREE.MeshStandardMaterial({ color: 0x111112, metalness: 0.5, roughness: 0.6 });

const LAMP_R = 0.05; // metres
const LAMP_LEN = 0.075;
const RISE = 0.11; // the lamp's centre above the headlamp it is mounted over
const EMBED = 0.03; // the stalk goes this far into the headlamp's housing, so it never floats

/** Where the pair goes, from the headlamps' positions (model frame): above each, or two either side of the middle if there is one in the middle. */
export function spotlampSpots(headlamps) {
  if (!headlamps.length) return [];
  const xs = [...new Set(headlamps.map((h) => Math.round(h.x * 100) / 100))];
  const y = Math.max(...headlamps.map((h) => h.y));
  const z = Math.max(...headlamps.map((h) => h.z));
  const wide = xs.some((x) => Math.abs(x) > 0.08);
  return (wide ? xs.filter((x) => Math.abs(x) > 0.08) : [-0.12, 0.12]).map((x) => ({ x, y, z }));
}

/**
 * Adds the (hidden) pair to a vehicle's model, which already has its headlamp beams (`addHeadlightBeams`). Returns the group, or null if
 * the model has no headlamps to mount them by.
 */
export function addSpotlamps(model) {
  const beams = (model.userData.beams ?? []).filter((o) => !o.isSprite);
  if (!beams.length) return null;
  model.updateMatrixWorld(true);
  const heads = beams.map((b) => model.worldToLocal(b.getWorldPosition(new THREE.Vector3())));
  const spots = spotlampSpots(heads);
  const group = new THREE.Group();
  group.name = 'spotlamps';
  group.visible = false;
  const lensMat = new THREE.MeshStandardMaterial({ color: 0xeeeeee, emissive: 0x000000, roughness: 0.15, metalness: 0.1 });
  const haloMat = new THREE.SpriteMaterial({ map: glowTexture(), color: 0xf4f8ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
  const lenses = [];
  const keep = (o) => {
    o.userData.keep = true;
    return o;
  };
  for (const s of spots) {
    const top = s.y + RISE;
    const stalk = keep(new THREE.Mesh(new THREE.BoxGeometry(0.022, RISE - LAMP_R + EMBED, 0.022), STALK));
    stalk.position.set(s.x, s.y - EMBED + (RISE - LAMP_R + EMBED) / 2, s.z);
    const body = keep(new THREE.Mesh(new THREE.CylinderGeometry(LAMP_R, LAMP_R * 0.85, LAMP_LEN, 20).rotateX(Math.PI / 2), HOUSING));
    body.position.set(s.x, top, s.z + LAMP_LEN / 2 - 0.02);
    const rim = keep(new THREE.Mesh(new THREE.TorusGeometry(LAMP_R, 0.007, 8, 24), RIM));
    rim.position.set(s.x, top, s.z + LAMP_LEN - 0.02);
    const lens = keep(new THREE.Mesh(new THREE.CircleGeometry(LAMP_R - 0.004, 20), lensMat));
    lens.name = 'spotLens';
    lens.position.set(s.x, top, s.z + LAMP_LEN - 0.018);
    const halo = keep(new THREE.Sprite(haloMat));
    halo.position.set(s.x, top, s.z + LAMP_LEN + 0.03);
    halo.scale.setScalar(0.6);
    group.add(stalk, body, rim, lens, halo);
    lenses.push(lens);
  }
  group.userData.lensMaterial = lensMat;
  group.userData.haloMaterial = haloMat;
  model.add(group);
  model.userData.spotLamps = lenses;
  model.userData.spotGroup = group;
  return group;
}

/** Shows or hides the pair and sets how brightly it burns (0..1). */
export function setSpotlamps(model, fitted, level) {
  const g = model.userData.spotGroup;
  if (!g) return;
  g.visible = fitted;
  const lit = level > 0.02;
  g.userData.lensMaterial.emissive.setHex(lit ? 0xf4f8ff : 0x000000);
  g.userData.lensMaterial.emissiveIntensity = lit ? LENS_GLOW * level : 0;
  g.userData.haloMaterial.opacity = lit ? Math.min(1, 0.85 * level) : 0;
}

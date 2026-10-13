import * as THREE from 'three';

// The barn's generator (items/generator.js): a small diesel set in a red tubular cage, the engine in its grey cover with a recoil starter
// housing and a pull handle at one end, the black alternator drum at the other, a tank on top with a cap and a sight gauge, a silencer and
// a short exhaust stack, and a panel on the front with a socket, a fuel level dial, a switch and a green lamp. Local axes: +z is the
// front (the panel), +x the starter end. It shakes a little while it runs.

export const GENERATOR_SIZE = { x: 0.96, z: 0.62, y: 0.78 }; // overall, for the interaction box
export const GENERATOR_EXHAUST = { x: -0.18, y: 0.82, z: -0.12 }; // the top of the stack, in its own space

function dialTexture() {
  const c = document.createElement('canvas');
  c.width = 96;
  c.height = 64;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#ece6d2';
  ctx.fillRect(0, 0, 96, 64);
  ctx.strokeStyle = '#2a261c';
  ctx.fillStyle = '#2a261c';
  ctx.lineWidth = 2;
  for (let i = 0; i <= 4; i++) {
    const a = -1 + (i / 4) * 2;
    ctx.beginPath();
    ctx.moveTo(48 + Math.sin(a) * 28, 54 - Math.cos(a) * 28);
    ctx.lineTo(48 + Math.sin(a) * 38, 54 - Math.cos(a) * 38);
    ctx.stroke();
  }
  ctx.font = 'bold 11px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('E', 18, 60);
  ctx.fillText('F', 78, 60);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function buildGeneratorModel() {
  const g = new THREE.Group();
  g.name = 'generator';
  const red = new THREE.MeshStandardMaterial({ color: 0xa8281c, roughness: 0.5, metalness: 0.3 });
  const grey = new THREE.MeshStandardMaterial({ color: 0x7c8186, roughness: 0.55, metalness: 0.45 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x1b1c1e, roughness: 0.7, metalness: 0.3 });
  const steel = new THREE.MeshStandardMaterial({ color: 0x9ea3a8, roughness: 0.35, metalness: 0.8 });
  const rubber = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.95 });
  const tankMat = new THREE.MeshStandardMaterial({ color: 0xc89a1e, roughness: 0.5, metalness: 0.2 });
  const panelMat = new THREE.MeshStandardMaterial({ color: 0x2c3033, roughness: 0.6, metalness: 0.3 });
  const part = (geo, mat, x, y, z, rot) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    if (rot) m.rotation.set(rot[0], rot[1], rot[2]);
    m.castShadow = true;
    m.receiveShadow = true;
    g.add(m);
    return m;
  };
  const { x: W, z: D } = GENERATOR_SIZE;
  const base = 0.07; // the skid's height off the ground
  // The skid: two rubber-footed rails along the length and cross pieces.
  for (const z of [-D / 2 + 0.05, D / 2 - 0.05]) part(new THREE.BoxGeometry(W, 0.05, 0.05), red, 0, base, z);
  for (const x of [-W / 2 + 0.05, 0, W / 2 - 0.05]) part(new THREE.BoxGeometry(0.05, 0.05, D - 0.05), red, x, base, 0);
  for (const x of [-W / 2 + 0.08, W / 2 - 0.08]) for (const z of [-D / 2 + 0.05, D / 2 - 0.05]) part(new THREE.CylinderGeometry(0.03, 0.035, 0.05, 10), rubber, x, 0.025, z);
  // The cage: four corner posts, a top frame and a carrying bar across it.
  const top = 0.74;
  for (const x of [-W / 2 + 0.03, W / 2 - 0.03]) for (const z of [-D / 2 + 0.03, D / 2 - 0.03]) part(new THREE.CylinderGeometry(0.016, 0.016, top - base, 8), red, x, (top + base) / 2, z);
  for (const z of [-D / 2 + 0.03, D / 2 - 0.03]) part(new THREE.CylinderGeometry(0.016, 0.016, W - 0.06, 8), red, 0, top, z, [0, 0, Math.PI / 2]);
  for (const x of [-W / 2 + 0.03, W / 2 - 0.03]) part(new THREE.CylinderGeometry(0.016, 0.016, D - 0.06, 8), red, x, top, 0, [Math.PI / 2, 0, 0]);
  part(new THREE.CylinderGeometry(0.014, 0.014, W - 0.06, 8), red, 0, top, 0, [0, 0, Math.PI / 2]);
  // The engine in its cover (starter end) and the alternator drum (the other end).
  part(new THREE.BoxGeometry(0.5, 0.42, 0.44), grey, 0.19, 0.31, -0.02);
  part(new THREE.BoxGeometry(0.46, 0.04, 0.4), dark, 0.19, 0.53, -0.02); // the cover's top lip
  for (let i = 0; i < 5; i++) part(new THREE.BoxGeometry(0.004, 0.2, 0.3), dark, 0.0 + i * 0.015, 0.32, 0.2); // slats on the cover's front edge
  part(new THREE.CylinderGeometry(0.19, 0.19, 0.4, 20), dark, -0.27, 0.36, -0.02, [0, 0, Math.PI / 2]);
  for (let i = 0; i < 3; i++) part(new THREE.CylinderGeometry(0.195, 0.195, 0.012, 20), grey, -0.4 + i * 0.12, 0.36, -0.02, [0, 0, Math.PI / 2]); // cooling rings
  // The recoil starter housing on the end, with the handle on its cord. It stands 1.5 cm proud of the engine cover's end: flush, its back face shared a plane
  // with the cover's and the grey and the red flickered.
  part(new THREE.CylinderGeometry(0.11, 0.11, 0.07, 16), red, W / 2 - 0.055, 0.35, -0.02, [0, 0, Math.PI / 2]);
  part(new THREE.CylinderGeometry(0.045, 0.045, 0.012, 12), dark, W / 2 - 0.016, 0.35, -0.02, [0, 0, Math.PI / 2]);
  const cord = new THREE.Group();
  cord.position.set(W / 2 - 0.02, 0.32, -0.02);
  g.add(cord);
  const cordLine = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.1, 6), rubber);
  cordLine.rotation.z = Math.PI / 2;
  cordLine.position.x = 0.05;
  cord.add(cordLine);
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.09, 10), new THREE.MeshStandardMaterial({ color: 0xd8b018, roughness: 0.6 }));
  handle.position.set(0.1, 0, 0);
  handle.rotation.x = Math.PI / 2;
  cord.add(handle);
  // The fuel tank on top, a cap, and a sight gauge down the front.
  part(new THREE.BoxGeometry(0.42, 0.16, 0.34), tankMat, 0.17, 0.62, -0.02);
  part(new THREE.CylinderGeometry(0.04, 0.045, 0.03, 12), dark, 0.28, 0.715, -0.07);
  part(new THREE.CylinderGeometry(0.012, 0.012, 0.13, 8), steel, 0.34, 0.62, D / 2 - 0.12);
  // The silencer and the stack.
  part(new THREE.CylinderGeometry(0.06, 0.06, 0.26, 14), steel, GENERATOR_EXHAUST.x, 0.62, GENERATOR_EXHAUST.z, [0, 0, Math.PI / 2]);
  part(new THREE.CylinderGeometry(0.022, 0.022, 0.22, 10), steel, GENERATOR_EXHAUST.x + 0.1, 0.72, GENERATOR_EXHAUST.z);
  part(new THREE.CylinderGeometry(0.03, 0.022, 0.025, 10), dark, GENERATOR_EXHAUST.x + 0.1, 0.835, GENERATOR_EXHAUST.z);
  // The panel on the front: a dial for the fuel, a socket, a switch and a green lamp.
  const fz = D / 2 - 0.005;
  part(new THREE.BoxGeometry(0.34, 0.2, 0.02), panelMat, -0.25, 0.2, fz);
  const face = part(new THREE.PlaneGeometry(0.1, 0.066), new THREE.MeshBasicMaterial({ map: dialTexture() }), -0.335, 0.235, fz + 0.011);
  face.castShadow = false;
  const pivot = new THREE.Group();
  pivot.position.set(-0.335, 0.235 - 0.026, fz + 0.013);
  const needle = new THREE.Mesh(new THREE.BoxGeometry(0.003, 0.04, 0.002), new THREE.MeshBasicMaterial({ color: 0xb52418 }));
  needle.position.y = 0.02;
  pivot.add(needle);
  g.add(pivot);
  const lamp = part(new THREE.CylinderGeometry(0.011, 0.011, 0.008, 10), new THREE.MeshStandardMaterial({ color: 0x222222, emissive: 0x22ff44, emissiveIntensity: 0, roughness: 0.3 }), -0.2, 0.235, fz + 0.012, [Math.PI / 2, 0, 0]);
  part(new THREE.CylinderGeometry(0.03, 0.03, 0.025, 14), steel, -0.2, 0.15, fz + 0.012, [Math.PI / 2, 0, 0]); // the 230 V socket's surround
  part(new THREE.CylinderGeometry(0.02, 0.02, 0.02, 12), dark, -0.2, 0.15, fz + 0.02, [Math.PI / 2, 0, 0]);
  const sw = part(new THREE.BoxGeometry(0.014, 0.04, 0.012), red, -0.3, 0.14, fz + 0.016);
  sw.rotation.z = 0.5;

  /** `level` 0..1 on the dial; `running` for the lamp and the shake; `pull` 0..1 of the cord out; `time` for the shake. */
  const set = ({ level = 0, running = false, pull = 0, time = 0 }) => {
    pivot.rotation.z = -(-1 + Math.max(0, Math.min(1, level)) * 2);
    lamp.material.emissiveIntensity = running ? 1.6 : 0;
    sw.rotation.z = running ? -0.5 : 0.5;
    cord.scale.x = 1 + pull * 2.4;
    g.rotation.z = running ? Math.sin(time * 52) * 0.0035 : 0;
    g.rotation.x = running ? Math.sin(time * 41 + 1) * 0.0025 : 0;
  };
  set({});
  return { group: g, set };
}

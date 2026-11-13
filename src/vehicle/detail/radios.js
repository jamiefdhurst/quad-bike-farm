import * as THREE from 'three';

// Radio head units (TODO 100): one piece the vehicles share, so a radio is the same wherever it is fitted and a new kind (a cassette player, a
// loud aftermarket stereo with an orange display) is one more style here rather than a drawing inside a vehicle's model. A unit faces +Z out of a
// panel whose face is at z = 0 (turn the group to suit, as with the switchgear kit), is `w` by `h`, and sits 1 mm proud of the panel.
//
//   const unit = buildRadio('dab', { w: 0.3, h: 0.07 });
//   unit.userData.setPower(true);       // the display lights (and goes dark again): call it from the dash's update with the radio's state
//   unit.userData.faceMaterial          // add to the model's cleanMaterials: a cab's inside never gets muddy
//
// The sound is the radio's own (vehicle/radio.js); this is only what you see.

/** The styles there are. `draw(g, W, H, on)` paints the face on a canvas `W` by `H`; `on` is whether the display is lit. */
export const RADIO_STYLES = {
  // The black digital head unit in the photo of the Tor's dash: a chrome strip top and bottom, a big silver knob at the left, a dark
  // display with orange digits, a row of blue preset buttons and two dark buttons at the right.
  dab: {
    draw(g, W, H, on) {
      g.fillStyle = '#0e1012';
      g.fillRect(0, 0, W, H);
      g.fillStyle = '#e4e6e8'; // the chrome trim
      g.fillRect(0, 0, W, H * 0.05);
      g.fillRect(0, H * 0.95, W, H * 0.05);
      g.fillStyle = on ? '#12202a' : '#07090a'; // the display, dark until the radio is on
      g.fillRect(W * 0.3, H * 0.2, W * 0.46, H * 0.4);
      if (on) {
        g.fillStyle = '#f09a28';
        g.font = `bold ${H * 0.28}px Helvetica, Arial, sans-serif`;
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillText('97.4 FM', W * 0.53, H * 0.42, W * 0.42);
      }
      g.fillStyle = on ? '#2d86d6' : '#1c3550'; // the blue preset buttons along the bottom
      for (let i = 0; i < 6; i++) g.fillRect(W * (0.3 + i * 0.078), H * 0.68, W * 0.06, H * 0.14);
      g.fillStyle = '#9a9ea3'; // the big volume knob
      g.beginPath();
      g.arc(W * 0.16, H * 0.5, H * 0.3, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#41454a';
      g.beginPath();
      g.arc(W * 0.16, H * 0.5, H * 0.17, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#2a2d30';
      for (const y of [0.25, 0.6]) g.fillRect(W * 0.82, H * y, W * 0.14, H * 0.14);
    },
  },
};

RADIO_STYLES.cassette = {
  // A period car cassette player, as Amy's Finch has: a silver-grey faceplate, a cassette door in the middle with its slot, a tuning scale above a row of pale
  // push buttons, a knob at each end. The scale lights amber when it is on.
  draw(g, W, H, on) {
    g.fillStyle = '#8f9294';
    g.fillRect(0, 0, W, H);
    g.fillStyle = 'rgba(255,255,255,0.18)'; // a brushed highlight along the top
    g.fillRect(0, 0, W, H * 0.08);
    g.fillStyle = on ? '#e8b64a' : '#d8d2bc'; // the tuning scale's window, lit when the radio is on
    g.fillRect(W * 0.26, H * 0.12, W * 0.48, H * 0.26);
    g.fillStyle = '#4a4034';
    for (let i = 0; i < 20; i++) g.fillRect(W * (0.28 + i * 0.0225), H * 0.2, W * 0.003, H * (i % 5 === 0 ? 0.14 : 0.08)); // its figures
    g.fillStyle = '#b32a1c';
    g.fillRect(W * (on ? 0.5 : 0.44), H * 0.1, W * 0.007, H * 0.3); // its needle
    g.fillStyle = '#0b0b0b'; // the cassette door
    g.fillRect(W * 0.26, H * 0.46, W * 0.48, H * 0.34);
    g.fillStyle = '#2a2a2a';
    g.fillRect(W * 0.3, H * 0.58, W * 0.4, H * 0.06); // its slot
    for (let i = 0; i < 4; i++) {
      g.fillStyle = '#d6d6d4'; // the push buttons
      g.fillRect(W * (0.77 + i * 0.05), H * 0.3, W * 0.04, H * 0.4);
    }
    for (const x of [0.11, 0.89]) {
      g.fillStyle = '#26282a'; // the volume and tuning knobs
      g.beginPath();
      g.arc(W * x, H * 0.5, H * 0.3, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#8a8d90';
      g.fillRect(W * x - W * 0.004, H * 0.22, W * 0.008, H * 0.2);
    }
  },
};

RADIO_STYLES.headunit = {
  // An aftermarket head unit, as Jess fitted: a black faceplate with a big orange display along the top, a row of small grey buttons under it and a
  // volume knob each end, with a slot for a detachable panel. The display shows a station when it is on.
  draw(g, W, H, on) {
    g.fillStyle = '#141516';
    g.fillRect(0, 0, W, H);
    g.fillStyle = on ? '#2a1204' : '#0a0a0a'; // the display, dark until the radio is on
    g.fillRect(W * 0.2, H * 0.14, W * 0.6, H * 0.36);
    if (on) {
      g.fillStyle = '#ff8a2a';
      g.font = `bold ${H * 0.3}px Helvetica, Arial, sans-serif`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText('98.4', W * 0.5, H * 0.33, W * 0.5);
    }
    for (let i = 0; i < 6; i++) {
      g.fillStyle = '#3a3b3d'; // the small preset buttons
      g.fillRect(W * (0.22 + i * 0.1), H * 0.62, W * 0.07, H * 0.24);
    }
    for (const x of [0.09, 0.91]) {
      g.fillStyle = '#4a4c4f'; // a knob each end
      g.beginPath();
      g.arc(W * x, H * 0.5, H * 0.3, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#9a9ea3';
      g.fillRect(W * x - W * 0.004, H * 0.24, W * 0.008, H * 0.2);
    }
  },
};

/** A canvas texture of a style's face, lit or not. Needs a canvas (a browser, or a test's stub). */
function faceTexture(style, w, h, on) {
  const px = 1400;
  const c = document.createElement('canvas');
  c.width = Math.round(w * px);
  c.height = Math.round(h * px);
  RADIO_STYLES[style].draw(c.getContext('2d'), c.width, c.height, on);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/** A radio head unit of `style` (see RADIO_STYLES), `w` by `h`, as a group facing +Z. */
export function buildRadio(style = 'dab', { w = 0.3, h = 0.07 } = {}) {
  if (!RADIO_STYLES[style]) throw new Error(`Unknown radio style: ${style}`);
  const group = new THREE.Group();
  group.name = `radio_${style}`;
  const off = faceTexture(style, w, h, false);
  const on = faceTexture(style, w, h, true);
  const mat = new THREE.MeshStandardMaterial({ map: off, transparent: true, roughness: 0.5, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const face = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  face.position.z = 0.001;
  group.add(face);
  group.userData.faceMaterial = mat;
  group.userData.powered = false;
  group.userData.setPower = (lit) => {
    if (lit === group.userData.powered) return;
    group.userData.powered = lit;
    mat.map = lit ? on : off;
    mat.needsUpdate = false; // only the map changes: no recompile
  };
  return group;
}

import * as THREE from 'three';

// Decals and stickers for the vehicle models (TODO 87): makers' badges, stripes, warning labels, a chassis plate, race numbers and
// a dealer's sticker, drawn on canvases. Never a real maker's name or logo: every maker here is made up (docs/decisions/vehicles.md, "A
// shared
// detail kit"). `decalLayout` is pure (what to draw, in pixels, tested); `decalTexture` and `decalMesh` draw it.

/**
 * The made-up makers, each standing in for a real one, with how its badge is set. `badge`: 'italic' (slanted bold capitals with
 * an outline), 'block' (capitals in a rounded box) or 'oval' (in an oval). Colours are CSS.
 */
export const MAKERS = {
  kestrel: { name: 'Kestrel', badge: 'italic', ink: '#ffffff', edge: '#7a0f0b', box: null }, // the red quad (a Honda's place)
  tamura: { name: 'Tamura', badge: 'block', ink: '#ffffff', edge: null, box: '#1d3f8f' }, // the blue, the loan and the yellow (Yamaha's)
  ridgeback: { name: 'Ridgeback', badge: 'italic', ink: '#d9f2d0', edge: '#1f3a17', box: null }, // the green (Kawasaki's)
  viper: { name: 'Viper', badge: 'italic', ink: '#111111', edge: '#f5d000', box: null }, // the orange (Suzuki's)
  hartley: { name: 'Hartley', badge: 'oval', ink: '#f0e6c8', edge: null, box: '#7d1712' }, // the tractor (Ferguson's)
  moorland: { name: 'Moorland', badge: 'oval', ink: '#f2f2ea', edge: null, box: '#244a2c' }, // the Land Rovers
  thorne: { name: 'Thorne', badge: 'oval', ink: '#ffffff', edge: null, box: '#1b3d7a' }, // the Fiesta (Ford's)
  fenwick: { name: 'Fenwick', badge: 'block', ink: '#f4f1e6', edge: null, box: '#3c5a2e' }, // the trailers (an Ifor Williams's place)
  ashby: { name: 'Ashby', badge: 'block', ink: '#f4f4f4', edge: null, box: '#3a3a3a' }, // the Corsa (Vauxhall's)
  vauclair: { name: 'Vauclair', badge: 'block', ink: '#d9dadb', edge: null, box: '#1b1c1e' }, // your car (Peugeot's)
};

/** Which maker each vehicle's badge names, by spec id. The three-wheeler has none yet (its item says). */
export const MAKER_FOR = {
  red: 'kestrel', blue: 'tamura', loan: 'tamura', green: 'ridgeback', yellow: 'tamura', orange: 'viper', kids: 'viper', moto: 'tamura', atc: 'kestrel', plover: 'ashby',
  tractor: 'hartley', utv: 'ridgeback', landrover: 'moorland', landrover200: 'moorland', fiesta: 'thorne', corsa: 'ashby', p309: 'vauclair',
};

/** Names a decal must never carry. tests/decals.test.js checks every maker and every built-in string against it. */
export const REAL_NAMES = ['honda', 'yamaha', 'kawasaki', 'suzuki', 'land rover', 'landrover', 'ford', 'vauxhall', 'opel', 'massey', 'ferguson', 'john deere', 'deere', 'kubota', 'polaris', 'can-am', 'bombardier', 'gator', 'peugeot'];

/** The farm-ATV warning sticker's words, in the usual order. */
export const WARNING_LINES = ['WARNING', 'Improper use can result in SEVERE INJURY or DEATH.', 'Always wear a helmet.', 'Never carry a passenger.', 'Read the owner’s manual.'];

/** A dealer's sticker: a made-up dealer down the valley, with a made-up number. */
export const DEALER = { name: 'Pennine Farm Machinery', line: 'Sales · Service · Hire', phone: '01535 600 412' };

/** A chassis number that looks the part: the maker's three letters, a model code and a serial, the same for the same seed. */
export function chassisNumber(maker, seed = 1) {
  let v = Math.abs(Math.floor(seed)) % 2147483646 + 1;
  const next = () => (v = (v * 16807) % 2147483647);
  const letters = (MAKERS[maker]?.name ?? 'XXX').slice(0, 3).toUpperCase();
  const digit = () => String(next() % 10);
  const letter = () => 'ABCDEFGHJKLMNPRSTVWXYZ'[next() % 22];
  return `${letters}${letter()}${letter()}${digit()}${digit()}${digit()}-${Array.from({ length: 6 }, digit).join('')}`;
}

/**
 * What to draw for one decal, as `{ w, h, ops }` in canvas pixels. Ops: { op: 'rect', x, y, w, h, fill, r? }, { op: 'text', text,
 * x, y, size, maxW, fill, stroke?, weight?, italic?, align? }, { op: 'tri', x, y, size, fill, stroke }, { op: 'dot', x, y, r, fill },
 * { op: 'oval', x, y, rx, ry, fill, stroke? }. Kinds and their options:
 * - 'badge' { maker, model? }: the maker's name in its badge style, the model name under it if given.
 * - 'stripes' { colours: [css...], text?, ink? }: bands across a sticker that fade out at one end, with a model name on them.
 * - 'warning' {}: the yellow and black warning label.
 * - 'chassis' { maker, seed, year?, model? }: a riveted plate with the stamped maker, model, number and year.
 * - 'number' { text, ground?, ink? }: a race number board.
 * - 'dealer' {}: the dealer's sticker.
 */
export function decalLayout(kind, opts = {}) {
  switch (kind) {
    case 'badge': {
      const m = MAKERS[opts.maker];
      if (!m) throw new Error(`Unknown maker: ${opts.maker}`);
      const w = 512;
      const h = opts.model ? 192 : 128;
      const ops = [];
      const big = opts.model ? 100 : 104;
      const y = opts.model ? 72 : h / 2;
      if (m.badge === 'block') ops.push({ op: 'rect', x: 8, y: 8, w: w - 16, h: (opts.model ? 128 : h) - 16, fill: m.box, r: 22 });
      if (m.badge === 'oval') ops.push({ op: 'oval', x: w / 2, y, rx: w / 2 - 8, ry: (opts.model ? 64 : h / 2) - 6, fill: m.box, stroke: m.ink });
      const fit = m.badge === 'italic' ? w - 24 : m.badge === 'oval' ? w * 0.7 : w - 80;
      ops.push({ op: 'text', text: m.name.toUpperCase(), x: w / 2, y, size: big, maxW: fit, fill: m.ink, stroke: m.edge, weight: '900', italic: m.badge === 'italic' });
      if (opts.model) ops.push({ op: 'text', text: opts.model.toUpperCase(), x: w / 2, y: 160, size: 48, maxW: w - 40, fill: m.badge === 'italic' ? m.ink : m.box, stroke: m.badge === 'italic' ? m.edge : null, weight: 'bold', italic: true });
      return { w, h, ops };
    }
    case 'stripes': {
      const w = 1024;
      const h = 128;
      const colours = opts.colours ?? ['#ffffff', '#222222'];
      const band = h / (colours.length * 2 + 1);
      const ops = [];
      colours.forEach((fill, i) => {
        // Each band breaks into shorter and shorter blocks towards the back, the way '80s and '90s graphics fade out.
        const y = band * (1 + i * 2);
        ops.push({ op: 'rect', x: 0, y, w: w * 0.55, h: band, fill });
        for (let k = 0; k < 7; k++) ops.push({ op: 'rect', x: w * (0.57 + k * 0.06), y, w: w * 0.045 * (1 - k / 8), h: band, fill });
      });
      if (opts.text) ops.push({ op: 'text', text: opts.text.toUpperCase(), x: w * 0.27, y: h / 2, size: h * 0.62, maxW: w * 0.5, fill: opts.ink ?? '#111111', weight: '900', italic: true });
      return { w, h, ops };
    }
    case 'warning': {
      const w = 512;
      const h = 256;
      const ops = [
        { op: 'rect', x: 0, y: 0, w, h, fill: '#f2c200', r: 10 },
        { op: 'rect', x: 0, y: 0, w, h: 58, fill: '#111111', r: 10 },
        { op: 'tri', x: 46, y: 29, size: 40, fill: '#f2c200', stroke: '#111111' },
        { op: 'text', text: WARNING_LINES[0], x: w / 2 + 24, y: 30, size: 40, maxW: w - 120, fill: '#f2c200', weight: '900' },
      ];
      WARNING_LINES.slice(1).forEach((text, i) => ops.push({ op: 'text', text, x: w / 2, y: 92 + i * 44, size: 26, maxW: w - 30, fill: '#111111', weight: i === 0 ? 'bold' : 'normal' }));
      return { w, h, ops };
    }
    case 'chassis': {
      const m = MAKERS[opts.maker];
      if (!m) throw new Error(`Unknown maker: ${opts.maker}`);
      const w = 384;
      const h = 192;
      const ink = '#2a2a2a';
      const ops = [{ op: 'rect', x: 0, y: 0, w, h, fill: '#b9bcbf', r: 12 }, { op: 'rect', x: 6, y: 6, w: w - 12, h: h - 12, fill: '#c9ccce', r: 9 }];
      for (const [x, y] of [[20, 20], [w - 20, 20], [20, h - 20], [w - 20, h - 20]]) ops.push({ op: 'dot', x, y, r: 8, fill: '#8d9093' });
      ops.push(
        { op: 'text', text: `${m.name.toUpperCase()} MOTOR CO.`, x: w / 2, y: 38, size: 28, maxW: w - 80, fill: ink, weight: 'bold' },
        { op: 'text', text: `TYPE ${opts.model ?? '—'}`, x: w / 2, y: 82, size: 24, maxW: w - 60, fill: ink },
        { op: 'text', text: chassisNumber(opts.maker, opts.seed ?? 1), x: w / 2, y: 120, size: 26, maxW: w - 60, fill: ink, weight: 'bold' },
        { op: 'text', text: `MADE ${opts.year ?? 1989}`, x: w / 2, y: 158, size: 22, maxW: w - 80, fill: ink },
      );
      return { w, h, ops };
    }
    case 'number': {
      const w = 256;
      const h = 256;
      return {
        w,
        h,
        ops: [
          { op: 'rect', x: 0, y: 0, w, h, fill: opts.ground ?? '#f4f4f0', r: 30 },
          { op: 'text', text: String(opts.text ?? '7'), x: w / 2, y: h / 2 + 8, size: 200, maxW: w - 30, fill: opts.ink ?? '#111111', weight: '900' },
        ],
      };
    }
    case 'dealer': {
      const w = 512;
      const h = 160;
      return {
        w,
        h,
        ops: [
          { op: 'rect', x: 0, y: 0, w, h, fill: '#f7f7f2', r: 14 },
          { op: 'rect', x: 0, y: 0, w: 22, h, fill: '#1f5a2e' },
          { op: 'text', text: DEALER.name, x: w / 2 + 11, y: 46, size: 44, maxW: w - 60, fill: '#1f5a2e', weight: 'bold' },
          { op: 'text', text: DEALER.line, x: w / 2 + 11, y: 94, size: 28, maxW: w - 60, fill: '#333333' },
          { op: 'text', text: DEALER.phone, x: w / 2 + 11, y: 132, size: 28, maxW: w - 60, fill: '#333333', weight: 'bold' },
        ],
      };
    }
    default:
      throw new Error(`Unknown decal kind: ${kind}`);
  }
}

/** Every string a layout would print: for the test that no real name gets in. */
export function decalText(layout) {
  return layout.ops.filter((o) => o.op === 'text').map((o) => o.text);
}

function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

/** Draws a layout's ops on a 2D context. Text is shrunk to its `maxW`. */
export function drawDecal(g, layout) {
  g.clearRect(0, 0, layout.w, layout.h);
  for (const o of layout.ops) {
    if (o.op === 'rect') {
      g.fillStyle = o.fill;
      if (o.r) {
        roundRect(g, o.x, o.y, o.w, o.h, o.r);
        g.fill();
      } else g.fillRect(o.x, o.y, o.w, o.h);
    } else if (o.op === 'oval') {
      g.beginPath();
      g.ellipse(o.x, o.y, o.rx, o.ry, 0, 0, Math.PI * 2);
      g.fillStyle = o.fill;
      g.fill();
      if (o.stroke) {
        g.lineWidth = Math.max(3, o.ry * 0.06);
        g.strokeStyle = o.stroke;
        g.stroke();
      }
    } else if (o.op === 'dot') {
      g.beginPath();
      g.arc(o.x, o.y, o.r, 0, Math.PI * 2);
      g.fillStyle = o.fill;
      g.fill();
    } else if (o.op === 'tri') {
      const s = o.size;
      g.beginPath();
      g.moveTo(o.x, o.y - s / 2);
      g.lineTo(o.x + s * 0.58, o.y + s / 2);
      g.lineTo(o.x - s * 0.58, o.y + s / 2);
      g.closePath();
      g.fillStyle = o.fill;
      g.fill();
      g.fillStyle = o.stroke;
      g.font = `900 ${s * 0.7}px Helvetica, Arial, sans-serif`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText('!', o.x, o.y + s * 0.12);
    } else if (o.op === 'text') {
      const font = (size) => `${o.italic ? 'italic ' : ''}${o.weight ?? 'normal'} ${size}px Helvetica, Arial, sans-serif`;
      g.font = font(o.size);
      const tw = g.measureText(o.text).width;
      if (tw > o.maxW) g.font = font(o.size * (o.maxW / tw));
      g.textAlign = o.align ?? 'center';
      g.textBaseline = 'middle';
      if (o.stroke) {
        g.lineJoin = 'round';
        g.lineWidth = o.size * 0.12;
        g.strokeStyle = o.stroke;
        g.strokeText(o.text, o.x, o.y);
      }
      g.fillStyle = o.fill;
      g.fillText(o.text, o.x, o.y);
    }
  }
}

const textures = new Map();

/** A decal's texture, drawn once for the same kind and options and shared. */
export function decalTexture(kind, opts = {}) {
  const key = `${kind}|${JSON.stringify(opts)}`;
  if (textures.has(key)) return textures.get(key);
  const layout = decalLayout(kind, opts);
  const c = document.createElement('canvas');
  c.width = layout.w;
  c.height = layout.h;
  drawDecal(c.getContext('2d'), layout);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  textures.set(key, tex);
  return tex;
}

/**
 * A decal on a plane `width` metres across (its height from the layout's shape), facing +Z, to be placed by the caller a millimetre
 * off the surface it sits on. Named meshes are left out of merging, and a map keeps it out anyway. It takes the mud coat and the wear
 * layer like any other part, so it gets muddy and its edges lift.
 */
export function decalMesh(kind, opts = {}, { width = 0.2, roughness = 0.45, name = `decal_${kind}` } = {}) {
  const layout = decalLayout(kind, opts);
  const mat = new THREE.MeshStandardMaterial({ map: decalTexture(kind, opts), transparent: true, roughness, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, (width * layout.h) / layout.w), mat);
  mesh.name = name;
  return mesh;
}

import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { buildTractorModel, TRACTOR_LAYOUT, poseBaleSpike, poseTractorControls } from '../src/vehicle/tractorModel.js';
import { TRACTOR_SPEC } from '../src/vehicle/quadSpecs.js';
import { MF_PANEL, MF_COWL, MF_BONNET, panelY } from '../src/vehicle/mf35Body.js';

// The dash paints its dials on canvases; nothing here looks at them, so any 2D context that swallows every call will do.
const ctx = new Proxy(() => ctx, { get: (t, k) => (k === 'measureText' ? () => ({ width: 10 }) : ctx), set: () => true });
vi.stubGlobal('document', { createElement: () => ({ width: 1, height: 1, getContext: () => ctx }) });

// Quad, the girls' mounts and the controls look these parts up by name, so a redrawn tractor must keep them all.
const NAMED = [
  'body', 'bodyRoot', 'bonnet', 'exhaustFlap', 'exhaustTip', 'steeringColumn', 'handlebars', 'gripLeft', 'gripRight', 'riderHands',
  'gearLever', 'handThrottle', 'clutchPedal', 'stopKnob', 'fuelTap', 'chokeLever', 'mudguardLeft', 'mudguardRight', 'riderAnchor',
  'cameraAnchor',
];

describe('tractor model', () => {
  const model = buildTractorModel();

  it.each(NAMED)('has %s', (name) => {
    expect(model.getObjectByName(name)).toBeTruthy();
  });

  it('has the four wheels, each with a spin group', () => {
    for (const w of TRACTOR_LAYOUT.wheels) expect(model.getObjectByName(w.name).getObjectByName('spin')).toBeTruthy();
  });

  it('has a bale spike with its lever on the left of the seat, and poses them', () => {
    expect(model.getObjectByName('spikeLever').position.x).toBeGreaterThan(0.1);
    poseBaleSpike(model, 1.5, true, 1);
    expect(model.getObjectByName('spikeCarriage').position.y).toBe(1.5);
    const up = model.getObjectByName('spikeLever').rotation.x;
    poseBaleSpike(model, 0.6, false, 0);
    expect(model.getObjectByName('spikeLever').rotation.x).toBeGreaterThan(up);
    expect(model.getObjectByName('baleSpike').visible).toBe(false);
  });

  it('keeps the anchors where the girls and the camera expect them', () => {
    expect(model.getObjectByName('riderAnchor').position.toArray()).toEqual([0, 1.15, -0.8]);
    expect(model.getObjectByName('cameraAnchor').position.toArray()).toEqual([0, 1.86, -0.84]);
  });

  it('is the real size of a Massey Ferguson 35: about 1.7 m across and 1.9 m to the exhaust tip (the parking spaces were sized for something bigger)', () => {
    const plain = model.clone(); // without the bale spike's mast, which stands taller than the exhaust
    plain.getObjectByName('baleSpike').removeFromParent();
    plain.updateMatrixWorld(true);
    const box = new THREE.Box3();
    box.expandByObject(plain.getObjectByName('bodyRoot'));
    const size = box.getSize(new THREE.Vector3());
    expect(size.x).toBeGreaterThan(1.5);
    expect(size.x).toBeLessThan(1.8);
    expect(size.y).toBeGreaterThan(1.8);
    expect(size.y).toBeLessThan(2.05);
  });

  it('sets the instruments straight into the red metal: no housing round the dials, a steel plate in the body paint behind them', () => {
    const dash = model.getObjectByName('dash');
    expect(dash.getObjectByName('dashHousing')).toBeFalsy();
    const plate = dash.getObjectByName('dashPlate');
    expect(plate).toBeTruthy();
    expect(plate.material).toBe(model.getObjectByName('bonnet').material); // the same paint, not a plastic moulding
  });

  it('puts the dash on the cowl’s slope, the wheel above the panel’s rear and the levers and knobs on the metal', () => {
    const panel = new THREE.Vector3(...MF_PANEL.at);
    expect(Math.abs(panelY(panel.z) - panel.y)).toBeLessThan(1e-9);
    expect(panelY(0.4)).toBeGreaterThan(panelY(0.1)); // sloping up to the front, towards the driver's eye
    const bars = model.getObjectByName('handlebars').getWorldPosition(new THREE.Vector3());
    expect(bars.y).toBeGreaterThan(1.1);
    expect(bars.y).toBeLessThan(1.35); // about the bonnet's height, not 40 cm above it
    const cowlTop = Math.max(...MF_COWL.map((st) => st.y1));
    expect(cowlTop).toBeLessThan(MF_BONNET[1].y1 + 0.01); // the cowl never stands above the bonnet's ridge
    for (const name of ['gearLever', 'handThrottle', 'stopKnob']) {
      const o = model.getObjectByName(name);
      expect(o.position.y, name).toBeGreaterThan(0.85);
      expect(o.position.y, name).toBeLessThan(1.25);
    }
  });

  it('has real-sized wheels: 1.17 m rears, 0.71 m fronts, at the MF35’s wheelbase', () => {
    const [fl, , rl] = TRACTOR_LAYOUT.wheels;
    expect(rl.radius * 2).toBeCloseTo(1.17, 2);
    expect(fl.radius * 2).toBeCloseTo(0.71, 2);
    expect(fl.z - rl.z).toBeCloseTo(1.83, 2);
  });

  it('has a control for everything: gears, hand throttle, clutch, brakes, accelerator, hand brake, stop knob and the lights switch, all posed', () => {
    for (const n of ['gearLever', 'handThrottle', 'clutchPedal', 'brakePedals', 'accelPedal', 'parkBrakeLever', 'stopKnob', 'lightsRocker']) expect(model.getObjectByName(n), n).toBeTruthy();
    const m = buildTractorModel();
    const at = (n) => m.getObjectByName(n);
    poseTractorControls(m, { gear: 0, hand: 0, pedal: 0 });
    const rest = { brakes: at('brakePedals').rotation.x, accel: at('accelPedal').rotation.x, park: at('parkBrakeLever').rotation.x, stop: at('stopKnob').position.z };
    poseTractorControls(m, { gear: 1, hand: 1, pedal: 1, brake: 1, throttle: 1, park: 1, stop: 1 });
    expect(at('brakePedals').rotation.x).toBeLessThan(rest.brakes - 0.2);
    expect(at('accelPedal').rotation.x).toBeLessThan(rest.accel - 0.1);
    expect(at('parkBrakeLever').rotation.x).toBeLessThan(rest.park - 0.3);
    expect(at('stopKnob').position.z).toBeLessThan(rest.stop - 0.04);
    expect(at('clutchPedal').rotation.x).toBeLessThan(0);
  });

  it('has a lights switch and tail lamps that the lights code finds: P is wired in the spec and the guards’ lamps share the tail material', () => {
    expect(TRACTOR_SPEC.barLights).toBe('switch');
    expect(model.userData.tailMaterial).toBeTruthy();
    expect(model.userData.tailHalos.length).toBe(2);
    expect(model.getObjectByName('headlight')).toBeTruthy();
    expect(model.getObjectByName('lightsRocker').parent.name).toBe('dash'); // on the panel
  });

  it('has only the three gauges the game can drive (rev counter, water temperature, fuel), all inside the plate', async () => {
    const { buildDash } = await import('../src/vehicle/dash.js');
    const rings = buildDash('tractor').group.children.filter((o) => o.geometry?.type === 'TorusGeometry');
    expect(rings.length).toBe(6); // a bezel and its lip for each of three dials
    const plate = model.getObjectByName('dashPlate').geometry;
    plate.computeBoundingBox();
    for (const r of rings) {
      expect(Math.abs(r.position.x) + r.geometry.parameters.radius, 'inside the plate').toBeLessThan(0.115); // (the plate's half width, in the dash group's own frame)
    }
  });

  it('carries the seat on a bracket bolted to the gearbox cover, its arm and spring under the pan', () => {
    for (const n of ['seatBracket', 'seatArm', 'seatSpring', 'seatPan', 'seatCushion']) expect(model.getObjectByName(n), n).toBeTruthy();
    const top = (n) => new THREE.Box3().setFromObject(model.getObjectByName(n));
    const cover = top('tunnelCover');
    expect(top('seatBracket').intersectsBox(cover.clone().expandByScalar(0.01))).toBe(true); // on the cover
    expect(top('seatArm').intersectsBox(top('seatBracket'))).toBe(true);
    expect(top('seatSpring').intersectsBox(top('seatPan').clone().expandByScalar(0.012))).toBe(true);
  });

  it('keeps every wheel part inboard of the tyre’s outer face', () => {
    for (const w of TRACTOR_LAYOUT.wheels) {
      const wheel = model.getObjectByName(w.name);
      wheel.updateMatrixWorld(true);
      const side = Math.sign(w.x);
      const spin = wheel.getObjectByName('spin');
      let tyreFace = 0;
      let rimFace = 0;
      spin.traverse((o) => {
        if (!o.isMesh) return;
        o.geometry.computeBoundingBox();
        const b = o.geometry.boundingBox;
        const size = b.getSize(new THREE.Vector3());
        const face = side > 0 ? b.max.x : -b.min.x;
        if (size.y > (w.front ? 0.6 : 1.0)) tyreFace = Math.max(tyreFace, face);
        else rimFace = Math.max(rimFace, face);
      });
      expect(rimFace, w.name).toBeLessThanOrEqual(tyreFace + 0.001);
    }
  });
});

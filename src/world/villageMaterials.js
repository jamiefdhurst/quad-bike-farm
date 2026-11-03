// The village's materials, made once (world/villageProps.js): walls, roofs, paint, metal, glass that glows after dark, and the painted doors.

import * as THREE from 'three';
import { stoneTexture, corrugatedTexture } from './outbuildingProps.js';
import { woodTexture, paintedTexture, doorTexture, sashTexture } from './neighbourTextures.js';
import { slateTexture, concreteTexture } from './neighbourFarmProps.js';
import { brickTexture, clayTileTexture, pavingTexture, hedgeTexture, phoneGlassTexture } from './villageTextures.js';

const std = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.85, ...extra });

/** Every material the village uses. `doorColours` are the paints of the front doors; `renders` the paints of the rendered walls. */
export function makeVillageMaterials(random, { doorColours = [], renders = [] } = {}) {
  const glassMap = sashTexture(false);
  const litMap = sashTexture(true);
  const m = {
    stone: new THREE.MeshStandardMaterial({ map: stoneTexture(random), roughness: 0.95 }),
    brick: new THREE.MeshStandardMaterial({ map: brickTexture(random), roughness: 0.92 }),
    brickDark: std(0x6b3a2c),
    render: new THREE.MeshStandardMaterial({ map: paintedTexture(random, '#e4dcc4'), roughness: 0.9 }),
    renders: {},
    slate: new THREE.MeshStandardMaterial({ map: slateTexture(random), roughness: 0.8, side: THREE.DoubleSide }),
    clay: new THREE.MeshStandardMaterial({ map: clayTileTexture(random), roughness: 0.85, side: THREE.DoubleSide }),
    tin: new THREE.MeshStandardMaterial({ map: corrugatedTexture(random, '#8d9294', 0.3), roughness: 0.7, metalness: 0.3, side: THREE.DoubleSide }),
    timber: new THREE.MeshStandardMaterial({ map: woodTexture(random), roughness: 0.9 }),
    weathered: new THREE.MeshStandardMaterial({ map: woodTexture(random, [128, 120, 108]), roughness: 0.95 }),
    paint: std(0xeeece4, { roughness: 0.5 }),
    paintDark: std(0x2b3a34, { roughness: 0.55 }),
    fascia: std(0xe8e5da, { roughness: 0.6 }),
    lead: std(0x6c7176, { roughness: 0.6, metalness: 0.4 }),
    iron: std(0x1f2326, { roughness: 0.5, metalness: 0.6 }),
    // Gutters are half-round troughs, seen from inside as well as out.
    gutter: std(0x2b3033, { roughness: 0.55, metalness: 0.5, side: THREE.DoubleSide }),
    brass: std(0xb8a24a, { roughness: 0.4, metalness: 0.7 }),
    pot: std(0x9a5a38),
    concrete: new THREE.MeshStandardMaterial({ map: concreteTexture(random), roughness: 0.95 }),
    paving: new THREE.MeshStandardMaterial({ map: pavingTexture(random), roughness: 0.95 }),
    kerb: std(0x9b9a92, { roughness: 0.95 }),
    hedge: new THREE.MeshStandardMaterial({ map: hedgeTexture(random), roughness: 1 }),
    leaf: std(0x3c6a2e, { roughness: 1 }),
    bark: std(0x4a3a2a, { roughness: 1 }),
    crown: std(0x3f6a2c, { roughness: 1 }),
    blooms: [std(0xd8423a, { roughness: 0.7 }), std(0xf0c030, { roughness: 0.7 }), std(0xc064c8, { roughness: 0.7 }), std(0xf4f0e8, { roughness: 0.7 })],
    glass: new THREE.MeshStandardMaterial({ map: glassMap, roughness: 0.2, metalness: 0.2 }),
    // Windows and lamps glow once it is dark (setNight): the emissive is scaled with the darkness, never a light.
    glow: new THREE.MeshStandardMaterial({ map: glassMap, emissive: 0xffffff, emissiveMap: litMap, emissiveIntensity: 0, roughness: 0.4 }),
    // The little panes over a front door: plain dark glass, lit from inside after dark (a window's sash texture would stretch over them).
    fanGlass: new THREE.MeshStandardMaterial({ color: 0x2a3640, emissive: 0xffd88a, emissiveIntensity: 0, roughness: 0.15, metalness: 0.2 }),
    lampGlow: new THREE.MeshStandardMaterial({ color: 0xddd6c0, emissive: 0xffd88a, emissiveIntensity: 0, roughness: 0.4 }),
    signGlow: new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffe9b0, emissiveIntensity: 0, roughness: 0.5 }),
    // Plain glass you can see through (the shop window, the bus shelter, the phone box's panes).
    clear: new THREE.MeshStandardMaterial({ color: 0xa8c4d0, transparent: true, opacity: 0.2, roughness: 0.05, metalness: 0.1, depthWrite: false }),
    phoneGlass: new THREE.MeshStandardMaterial({ map: phoneGlassTexture(false), roughness: 0.3, transparent: true, opacity: 0.85 }),
    phoneGlow: new THREE.MeshStandardMaterial({ map: phoneGlassTexture(false), emissive: 0xffffff, emissiveMap: phoneGlassTexture(true), emissiveIntensity: 0, roughness: 0.3 }),
    red: std(0xb4141b, { roughness: 0.45, metalness: 0.15 }),
    doors: {},
  };
  for (const c of doorColours) m.doors[c] = new THREE.MeshStandardMaterial({ map: doorTexture(random, c), roughness: 0.5 });
  for (const c of renders) m.renders[c] = new THREE.MeshStandardMaterial({ map: paintedTexture(random, c), roughness: 0.9 });
  m.setNight = (darkness) => {
    const k = Math.max(0, Math.min(1, (darkness - 0.3) / 0.5));
    m.glow.emissiveIntensity = k * 0.9;
    m.phoneGlow.emissiveIntensity = k * 1.1;
    m.lampGlow.emissiveIntensity = k * 1.6;
    m.fanGlass.emissiveIntensity = k * 0.7;
    m.signGlow.emissiveIntensity = k * 0.9;
  };
  return m;
}

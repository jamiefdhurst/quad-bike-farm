import * as THREE from 'three';

// A tiling speckle of ice crystals, used as the bump map on a frosted seat so the frost has a grain and catches the light rather than
// being a flat white tint. One shared texture (a canvas of grey noise with a few brighter flecks).

let shared = null;

export function frostTexture() {
  if (shared) return shared;
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const g = canvas.getContext('2d');
  let seed = 12345;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  g.fillStyle = '#808080';
  g.fillRect(0, 0, size, size);
  for (let i = 0; i < 2600; i++) {
    const v = Math.round(110 + rnd() * 145);
    g.fillStyle = `rgb(${v},${v},${v})`;
    const r = rnd() < 0.15 ? 2 : 1;
    g.fillRect(Math.floor(rnd() * size), Math.floor(rnd() * size), r, r);
  }
  shared = new THREE.CanvasTexture(canvas);
  shared.wrapS = shared.wrapT = THREE.RepeatWrapping;
  shared.repeat.set(6, 6);
  return shared;
}

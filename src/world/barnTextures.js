// The textures the barn's boards, tin and floor are drawn with (barnBuild.js, barnWide.js). Canvas, so no files.

import * as THREE from 'three';

export function canvasTexture(w, h, draw, repeat = [1, 1]) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(...repeat);
  tex.anisotropy = 4;
  return tex;
}

/** Vertical boards, with a few darker gaps and the odd grain line. */
export function boardTexture(random, base) {
  return (repeat) =>
    canvasTexture(
      256,
      64,
      (ctx, w, h) => {
        ctx.fillStyle = base;
        ctx.fillRect(0, 0, w, h);
        for (let x = 0; x < w; x += 32) {
          ctx.fillStyle = 'rgba(0,0,0,0.35)';
          ctx.fillRect(x, 0, 2, h);
          ctx.fillStyle = `rgba(${random() < 0.5 ? '255,255,255' : '0,0,0'},${0.03 + random() * 0.06})`;
          ctx.fillRect(x + 2, 0, 30, h);
        }
        for (let i = 0; i < 90; i++) {
          ctx.strokeStyle = 'rgba(0,0,0,0.09)';
          const x = random() * w;
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x + (random() - 0.5) * 3, h);
          ctx.stroke();
        }
      },
      repeat,
    );
}

/** Corrugated tin: light and dark ribs across the sheet, a little rust. */
export function tinTexture(random, repeat) {
  return canvasTexture(
    128,
    128,
    (ctx, w, h) => {
      for (let x = 0; x < w; x += 16) {
        const g = ctx.createLinearGradient(x, 0, x + 16, 0);
        g.addColorStop(0, '#6e7478');
        g.addColorStop(0.5, '#a9aeb1');
        g.addColorStop(1, '#6e7478');
        ctx.fillStyle = g;
        ctx.fillRect(x, 0, 16, h);
      }
      for (let i = 0; i < 40; i++) {
        ctx.fillStyle = `rgba(120,70,40,${0.05 + random() * 0.1})`;
        ctx.fillRect(random() * w, random() * h, 2 + random() * 6, 6 + random() * 30);
      }
    },
    repeat,
  );
}

export function concreteTexture(random, repeat) {
  return canvasTexture(
    256,
    256,
    (ctx, w, h) => {
      ctx.fillStyle = '#8b8a85';
      ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 2600; i++) {
        const v = 100 + random() * 60;
        ctx.fillStyle = `rgba(${v},${v - 2},${v - 6},${0.18 + random() * 0.25})`;
        ctx.fillRect(random() * w, random() * h, 1 + random() * 3, 1 + random() * 3);
      }
      // A few oil stains and an expansion joint.
      for (let i = 0; i < 5; i++) {
        const g = ctx.createRadialGradient(0, 0, 1, 0, 0, 8 + random() * 20);
        g.addColorStop(0, 'rgba(40,36,30,0.45)');
        g.addColorStop(1, 'rgba(40,36,30,0)');
        ctx.save();
        ctx.translate(random() * w, random() * h);
        ctx.fillStyle = g;
        ctx.fillRect(-30, -30, 60, 60);
        ctx.restore();
      }
      ctx.fillStyle = 'rgba(30,30,30,0.5)';
      ctx.fillRect(0, h / 2 - 1, w, 2);
    },
    repeat,
  );
}

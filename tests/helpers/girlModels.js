import fs from 'node:fs';
import { vi } from 'vitest';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { fakeCanvas } from './vehicleModels.js';
import { decodePng, glbImage } from './png.js';

// Each girl built in node the way Companion builds her (rig, figure, outfit), for the tests that look at her shape.
// The glTF's textures need an image decoder, so the loader gets a stand-in; the canvases are stand-ins too, which means the polo's
// neckline is not cut (it is cut from the texture's pixels), so the triangle counts here are a little above the game's.

async function loadCompanionGltf({ paint = false } = {}) {
  const buf = fs.readFileSync(new URL('../../public/models/companion.glb', import.meta.url));
  // With `paint`, her palette texture's real pixels, so what is painted hair (or skin) reads as it does in the game.
  const texture = paint ? decodePng(glbImage(buf)) : null;
  vi.stubGlobal('self', globalThis);
  vi.stubGlobal('document', {
    createElement: () => {
      // Blank pixels: nothing reads as the palette's shirt colour, so the neckline cut finds nothing to cut.
      const canvas = fakeCanvas();
      // With `paint`, a canvas the texture's height reads it in its left part: the texture itself, or the neckline strip's canvas
      // (outfit.js withNecklineStrip), which has it on the left and the strip, left blank here, on the right.
      canvas.getContext().getImageData = (x, y, w, h) => {
        const data = new Uint8ClampedArray(w * h * 4);
        if (texture && x === 0 && y === 0 && h === texture.height && w >= texture.width) {
          for (let r = 0; r < h; r++) data.set(texture.data.subarray(r * texture.width * 4, (r + 1) * texture.width * 4), r * w * 4);
        }
        return { data };
      };
      return canvas;
    },
    createElementNS: () => ({
      style: {},
      width: texture?.width ?? 4,
      height: texture?.height ?? 4,
      addEventListener(type, fn) {
        this['_' + type] = fn;
      },
      removeEventListener() {},
      set src(_) {
        setTimeout(() => this._load?.({}), 0);
      },
    }),
  });
  URL.createObjectURL = () => 'blob:stand-in';
  URL.revokeObjectURL = () => {};
  const data = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  return new Promise((resolve, reject) => new GLTFLoader().parse(data, '', resolve, reject));
}

/**
 * [{ id, rig, height }] for every girl in CHARACTERS, dressed as her params say, standing in the model's rest pose. `paint`: her
 * texture's real pixels (her hair found as the game finds it, and her neckline cut), rather than blank ones.
 */
export async function buildAllGirls({ paint = false } = {}) {
  const gltf = await loadCompanionGltf({ paint });
  const { CharacterRig } = await import('../../src/npc/characterRig.js');
  const { shapeFigure } = await import('../../src/npc/figure.js');
  const { applyOutfit, refitOutfit, OUTFITS } = await import('../../src/npc/outfit.js');
  const { CHARACTERS } = await import('../../src/npc/characters.js');
  return CHARACTERS.map(({ id, params }) => {
    const rig = new CharacterRig(gltf, params.height);
    shapeFigure(rig, { bust: params.bust, waist: params.waist, hips: params.hips });
    const outfit = OUTFITS[params.outfit] ?? OUTFITS.original;
    applyOutfit(rig, outfit);
    refitOutfit(rig, outfit);
    rig.root.updateMatrixWorld(true);
    return { id, rig, height: params.height };
  });
}

/** Meshes, triangles and the world-space bounding box of a rig's visible meshes (skinned meshes at their current pose). */
export function measureGirl(rig) {
  let meshes = 0;
  let tris = 0;
  const box = new THREE.Box3();
  const v = new THREE.Vector3();
  rig.root.traverse((o) => {
    if (!o.isMesh || !o.visible) return;
    meshes++;
    const g = o.geometry;
    tris += (g.index ? g.index.count : g.attributes.position.count) / 3;
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      if (o.isSkinnedMesh) o.applyBoneTransform(i, v);
      box.expandByPoint(v.applyMatrix4(o.matrixWorld));
    }
  });
  const size = box.getSize(new THREE.Vector3());
  return { meshes, tris: Math.round(tris), size: [size.x, size.y, size.z].map((n) => Math.round(n * 1000) / 1000) };
}

import * as THREE from 'three';
import { createGroundPlan, paintGround, paintContext, createDetailCanvas } from './groundTexture.js';
import { patchColor, patchBlend } from './patchwork.js';
import { tarmacMask, tarmacMaskSteps } from './roadWet.js';
import { TILE_CELLS, TILE_MARGIN, SLOT } from './wearTiles.js';
import { DEFAULT_GROUND_PARAMS, GroundGrid, TileSet, tileMeshData, cutTiles, groundBounds } from './groundTiles.js';
import { PaintSet, PAINT_PX, paintWindow, overviewScale } from './groundPaint.js';

export { patchAt } from './patchwork.js';

/**
 * Builds the ground: one Rapier heightfield over the whole of `layout.ground` and the visual terrain in tiles that are built as they are needed
 * (groundTiles.js), plus a coarser patchwork ring of neighbouring fields out to the horizon. The ground is painted a tile at a time as you come
 * near it, over a coarse painting of the whole of it (groundPaint.js).
 */
export function createTerrain({ scene, physics, RAPIER, layout, heights, track, renderer, wear, fields, roadMud, autumn = false, params = { ...DEFAULT_GROUND_PARAMS } }) {
  const bounds = groundBounds(layout);

  // Sample heights once; shared by the tiles and the collider.
  const grid = new GroundGrid(bounds, heights.heightAt);

  // Physics. Rapier's heightfield is column-major with rows along z, and centred on the collider's translation.
  const collider = physics.createCollider(
    RAPIER.ColliderDesc.heightfield(grid.nz, grid.nx, grid.heights, { x: grid.nx, y: 1, z: grid.nz })
      .setTranslation((bounds.minX + bounds.maxX) / 2, 0, (bounds.minZ + bounds.maxZ) / 2)
      .setFriction(0.9),
  );

  const plan = createGroundPlan({ track, layout, fields, puddles: heights.puddles, bogs: heights.bogs, autumn });
  const groundTexture = (canvas) => {
    const tex = new THREE.CanvasTexture(canvas);
    tex.flipY = false;
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    return tex;
  };

  const detailTex = new THREE.CanvasTexture(createDetailCanvas());
  detailTex.wrapS = detailTex.wrapT = THREE.RepeatWrapping;

  // Worn ground, from the wear tiles (wearTiles.js): an atlas of the tiles that exist, a texel a grid point, soft in red, bog in green and
  // thawed frost in blue, and a table of which slot holds each tile.
  const wearTex = new THREE.DataTexture(wear.atlas, wear.atlasSize, wear.atlasSize, THREE.RGBAFormat);
  wearTex.magFilter = wearTex.minFilter = THREE.LinearFilter;
  wearTex.needsUpdate = true;
  const wearIndexTex = new THREE.DataTexture(wear.index, wear.dimX, wear.dimZ, THREE.RGBAFormat);
  wearIndexTex.magFilter = wearIndexTex.minFilter = THREE.NearestFilter;
  wearIndexTex.needsUpdate = true;
  // Mud carried onto the road (roadMud.js): one texel a grid point, the smear in red.
  const mudData = roadMud ?? { data: new Uint8Array(4), nx: 1, nz: 1, minX: 0, minZ: 0, sizeX: 1, sizeZ: 1 };
  const roadMudTex = new THREE.DataTexture(mudData.data, mudData.nx, mudData.nz, THREE.RGBAFormat);
  roadMudTex.magFilter = roadMudTex.minFilter = THREE.LinearFilter;
  roadMudTex.needsUpdate = true;
  const snow = { value: 0 }; // 0..1 how far the ground is under snow (the weather's cover); the World feeds it
  const frost = { value: 0 }; // 0..1 how hard the frost is (the weather's); the World feeds it
  const roadWet = { value: 0 }; // 0..1 how wet the tarmac is (roadWet.js); the World feeds it
  const skyTint = { value: new THREE.Color() }; // what the wet tarmac mirrors: the horizon's colour now, the World feeds it
  // The hay meadow (hayMask.js, hayView.js): the view fills these when the hay job is set up. Until then they point at a blank texel far away.
  const blank = new THREE.DataTexture(new Uint8Array(4), 1, 1, THREE.RGBAFormat);
  blank.needsUpdate = true;
  const hayPatch = {
    map: { value: blank }, origin: { value: new THREE.Vector2(1e6, 1e6) }, size: { value: new THREE.Vector2(1, 1) },
    trackMap: { value: blank }, trackOrigin: { value: new THREE.Vector2(1e6, 1e6) }, trackSize: { value: new THREE.Vector2(1, 1) },
  };
  const qr = fields.quarry?.rect;
  const quarryRect = new THREE.Vector4(...(qr ? [qr.minX, qr.minZ, qr.maxX, qr.maxZ] : [1e6, 1e6, 1e6 + 1, 1e6 + 1])); // the pit's field, for its gravel grain
  const shared = {
    detailTex,
    quarryRect,
    frost,
    snow,
    roadWet,
    skyTint,
    hayPatch,
    wear: { map: wearTex, index: wearIndexTex, origin: new THREE.Vector2(wear.originX, wear.originZ), tile: wear.tileSize, dims: new THREE.Vector2(wear.dimX, wear.dimZ), atlas: wear.atlasSize },
    roadMud: { map: roadMudTex, origin: new THREE.Vector2(mudData.minX, mudData.minZ), size: new THREE.Vector2(mudData.sizeX, mudData.sizeZ) },
  };

  // Every ground material (the overview's, and one for each tile painted), so the wet can darken them all. They share one program.
  const materials = new Set();
  let wet = 0;
  const wetten = (m) => {
    m.color.setScalar(1 - 0.24 * wet);
    m.roughness = 0.95 - 0.25 * wet;
  };
  // Where the tarmac is, for the shine (roadWet.js): the farm road, the lane and the village's streets, a texture over the ground it was made for
  // and none (a blank texel far away) where there is no road.
  const noTarmac = { map: blank, origin: new THREE.Vector2(1e6, 1e6), size: new THREE.Vector2(1, 1) };
  const tarmacBoxes = fields.tarmacBoxes();
  const tarmacOf = (mask) => {
    if (!mask) return { tarmac: noTarmac, texture: null };
    const texture = new THREE.DataTexture(mask.data, mask.nx, mask.nz, THREE.RedFormat);
    texture.magFilter = texture.minFilter = THREE.LinearFilter;
    texture.unpackAlignment = 1;
    texture.needsUpdate = true;
    return { tarmac: { map: texture, origin: new THREE.Vector2(mask.minX, mask.minZ), size: new THREE.Vector2(mask.sizeX, mask.sizeZ) }, texture };
  };
  const makeMaterial = (map, win, tarmac) => {
    const m = new THREE.MeshStandardMaterial({ map, vertexColors: true, roughness: 0.95 });
    addDetailLayer(m, shared, { origin: new THREE.Vector2(win.minX, win.minZ), size: new THREE.Vector2(win.maxX - win.minX, win.maxZ - win.minZ), tarmac });
    wetten(m);
    materials.add(m);
    return m;
  };

  // The overview: the whole of the ground painted coarsely, once, for the tiles not painted yet and for what is too far to need more.
  const ovScale = overviewScale(bounds);
  const ovCanvas = document.createElement('canvas');
  ovCanvas.width = Math.ceil((bounds.maxX - bounds.minX) * ovScale);
  ovCanvas.height = Math.ceil((bounds.maxZ - bounds.minZ) * ovScale);
  for (const _ of paintGround(plan, paintContext(ovCanvas.getContext('2d'), bounds, ovScale)));
  const ovTarmac = tarmacOf(tarmacMask(fields.tarmacAt, bounds, 2, tarmacBoxes)); // two metres a texel is as fine as the overview needs
  const overviewMat = makeMaterial(groundTexture(ovCanvas), bounds, ovTarmac.tarmac);

  // The tiles. A tile's mesh is made the first time it is wanted and its geometry swapped when its detail changes.
  const mesh = new THREE.Group();
  mesh.name = 'terrainTiles';
  scene.add(mesh);
  const meshes = new Map();
  const paintedTiles = new Map(); // tile id -> { material, texture, tarmacTexture, canvas } for the tiles painted at full size
  // Low-frequency tint, a little darker in the hedge shadow.
  const tint = (x, z) => (0.92 + 0.08 * Math.sin(x * 0.05 + 1.3) * Math.cos(z * 0.06)) * (fields.hedgeDistance(x, z) < 4 ? 0.82 : 1);
  const { tiles, cols, rows } = cutTiles(bounds);
  const tileSet = new TileSet(tiles, cols, rows, params, {
    build(tile, step, edges) {
      const t = tileMeshData(grid, tile, step, edges, tint);
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(t.positions, 3));
      geo.setAttribute('normal', new THREE.BufferAttribute(t.normals, 3));
      geo.setAttribute('color', new THREE.BufferAttribute(t.colors, 3));
      geo.setIndex(new THREE.BufferAttribute(t.index, 1));
      let m = meshes.get(tile.id);
      if (!m) {
        m = new THREE.Mesh(geo, paintedTiles.get(tile.id)?.material ?? overviewMat);
        m.receiveShadow = true;
        m.name = 'terrain';
        meshes.set(tile.id, m);
        mesh.add(m);
      } else {
        m.geometry.dispose();
        m.geometry = geo;
      }
    },
  });

  // The painting of tiles at full size, a little at a time as you come near (groundPaint.js). The canvases are kept to be painted again.
  const spare = new Map();
  const takeCanvas = (w, h) => spare.get(`${w}x${h}`)?.pop() ?? Object.assign(document.createElement('canvas'), { width: w, height: h });
  const giveCanvas = (c) => {
    const list = spare.get(`${c.width}x${c.height}`) ?? [];
    if (list.length < 6) list.push(c);
    spare.set(`${c.width}x${c.height}`, list);
  };
  const paintSet = new PaintSet(tiles, params, {
    begin(tile) {
      const win = paintWindow(tile);
      const canvas = takeCanvas(Math.round((win.maxX - win.minX) * PAINT_PX), Math.round((win.maxZ - win.minZ) * PAINT_PX));
      const ctx = canvas.getContext('2d');
      ctx.reset?.();
      const painting = paintGround(plan, paintContext(ctx, win, PAINT_PX));
      const roadMask = tarmacMaskSteps(fields.tarmacAt, win, 0.5, tarmacBoxes);
      const job = { win, canvas, mask: null, painting, roadMask, step: null };
      let painted = false;
      job.step = () => {
        if (!painted) painted = painting.next().done;
        else {
          const r = roadMask.next();
          if (r.done) job.mask = r.value;
          return r.done;
        }
        return false;
      };
      return job;
    },
    finish(tile, job) {
      const texture = groundTexture(job.canvas);
      const { tarmac, texture: tarmacTexture } = tarmacOf(job.mask);
      const material = makeMaterial(texture, job.win, tarmac);
      // Uploaded now, in the frame that painted it and counted in its time, not whenever it is first drawn.
      renderer.initTexture(texture);
      if (tarmacTexture) renderer.initTexture(tarmacTexture);
      paintedTiles.set(tile.id, { material, texture, tarmacTexture, canvas: job.canvas });
      const m = meshes.get(tile.id);
      if (m) m.material = material;
    },
    drop(tile) {
      const p = paintedTiles.get(tile.id);
      if (!p) return;
      paintedTiles.delete(tile.id);
      const m = meshes.get(tile.id);
      if (m) m.material = overviewMat;
      p.texture.dispose();
      p.tarmacTexture?.dispose();
      p.material.dispose();
      materials.delete(p.material);
      giveCanvas(p.canvas);
    },
  });

  scene.add(createOuterRing(layout, bounds, heights, fields));

  return {
    mesh,
    collider,
    bounds,
    grid,
    tileSet,
    paintSet,
    /** Builds the tiles round (x, z) that the start screen can hide. */
    prime: (x, z) => {
      tileSet.prime(x, z);
      paintSet.prime(x, z);
    },
    /** Keeps the tiles as fine as the distance wants, building a few a frame, and painted as you come near them. */
    update: (x, z) => {
      tileSet.update(x, z);
      paintSet.update(x, z);
    },
    /** How the painting is getting on: tiles painted at full size, those waiting, the time it has taken. */
    paintStats: () => paintSet.stats(),
    /** Darkens the ground as it wets (0..1), every material of it. */
    setWet: (w) => {
      if (w === wet) return;
      wet = w;
      for (const m of materials) wetten(m);
    },
    hayPatch,
    frost,
    snow,
    roadWet,
    skyTint,
    wearTexture: wearTex,
    wearIndexTexture: wearIndexTex,
    roadMudTexture: roadMudTex,
    meshHeightAt: (x, z) => grid.surfaceAt(x, z),
  };
}

/**
 * Multiplies a tiling greyscale texture over the diffuse colour in world space, and lays the worn ground and the road's mud over it. `shared` is
 * what every ground material reads alike; `own` is what this one's painting covers: the `origin` and `size` of its rectangle of ground (the map is
 * read through them, not through the mesh's uvs, so a tile can be given a painting of its own or the overview's) and the `tarmac` map over it.
 */
function addDetailLayer(material, { detailTex, quarryRect, wear, roadMud, frost, snow, roadWet, skyTint, hayPatch }, { origin, size, tarmac }) {
  const scale = 0.45;
  material.onBeforeCompile = (shader) => {
    shader.uniforms.groundOrigin = { value: origin };
    shader.uniforms.groundSize = { value: size };
    shader.uniforms.detailMap = { value: detailTex };
    shader.uniforms.wearMap = { value: wear.map };
    shader.uniforms.wearIndex = { value: wear.index };
    shader.uniforms.wearOrigin = { value: wear.origin };
    shader.uniforms.wearTile = { value: wear.tile };
    shader.uniforms.wearDims = { value: wear.dims };
    shader.uniforms.wearAtlas = { value: wear.atlas };
    shader.uniforms.quarryRect = { value: quarryRect };
    shader.uniforms.uFrost = frost;
    shader.uniforms.uSnow = snow;
    shader.uniforms.uRoadWet = roadWet;
    shader.uniforms.uSkyTint = skyTint;
    shader.uniforms.hayMap = hayPatch.map;
    shader.uniforms.hayOrigin = hayPatch.origin;
    shader.uniforms.haySize = hayPatch.size;
    shader.uniforms.hayTrackMap = hayPatch.trackMap;
    shader.uniforms.hayTrackOrigin = hayPatch.trackOrigin;
    shader.uniforms.hayTrackSize = hayPatch.trackSize;
    shader.uniforms.tarmacMap = { value: tarmac.map };
    shader.uniforms.tarmacOrigin = { value: tarmac.origin };
    shader.uniforms.tarmacSize = { value: tarmac.size };
    shader.uniforms.roadMudMap = { value: roadMud.map };
    shader.uniforms.roadMudOrigin = { value: roadMud.origin };
    shader.uniforms.roadMudSize = { value: roadMud.size };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform vec2 groundOrigin;\nuniform vec2 groundSize;\nvarying vec2 vWorldXZ;\nvarying float vWorldY;\nvarying vec3 vWorldN;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWorldXZ = (modelMatrix * vec4(transformed, 1.0)).xz;\nvWorldY = (modelMatrix * vec4(transformed, 1.0)).y;\nvWorldN = normalize(mat3(modelMatrix) * objectNormal);\nvMapUv = (vWorldXZ - groundOrigin) / groundSize;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform sampler2D detailMap;\nuniform sampler2D wearMap;\nuniform sampler2D wearIndex;\nuniform vec2 wearOrigin;\nuniform float wearTile;\nuniform vec2 wearDims;\nuniform float wearAtlas;\nuniform sampler2D roadMudMap;\nuniform vec2 roadMudOrigin;\nuniform vec2 roadMudSize;\nuniform float uFrost;\nuniform float uSnow;\nuniform float uRoadWet;\nuniform vec3 uSkyTint;\nuniform sampler2D hayMap;\nuniform vec2 hayOrigin;\nuniform vec2 haySize;\nuniform sampler2D hayTrackMap;\nuniform vec2 hayTrackOrigin;\nuniform vec2 hayTrackSize;\nuniform sampler2D tarmacMap;\nuniform vec2 tarmacOrigin;\nuniform vec2 tarmacSize;\nuniform vec4 quarryRect;\nvarying vec2 vWorldXZ;\nvarying float vWorldY;\nvarying vec3 vWorldN;')
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
        float detail = texture2D(detailMap, vWorldXZ * ${scale.toFixed(3)}).r;
        float detail2 = texture2D(detailMap, vWorldXZ * ${(scale * 0.13).toFixed(3)}).r;
        diffuseColor.rgb *= mix(0.72, 1.28, detail) * mix(0.85, 1.15, detail2);
        // The pit's gravel: the painted ground is about ten pixels a metre, so the walls would show their texels. Fine grit goes over it from the
        // detail map in all three planes (weighted by the face's lean), so a steep wall is as sharp as the floor and nothing stretches.
        float pitIn = step(quarryRect.x, vWorldXZ.x) * step(vWorldXZ.x, quarryRect.z) * step(quarryRect.y, vWorldXZ.y) * step(vWorldXZ.y, quarryRect.w);
        if (pitIn > 0.0) {
          vec3 tw = pow(abs(vWorldN), vec3(4.0));
          tw /= tw.x + tw.y + tw.z;
          vec3 wp = vec3(vWorldXZ.x, vWorldY, vWorldXZ.y);
          float gritA = texture2D(detailMap, wp.zy * 2.6).r * tw.x + texture2D(detailMap, wp.xz * 2.6).r * tw.y + texture2D(detailMap, wp.xy * 2.6).r * tw.z;
          float gritB = texture2D(detailMap, wp.zy * 7.3 + 0.31).r * tw.x + texture2D(detailMap, wp.xz * 7.3 + 0.31).r * tw.y + texture2D(detailMap, wp.xy * 7.3 + 0.31).r * tw.z;
          diffuseColor.rgb *= mix(0.5, 1.5, gritA * 0.45 + gritB * 0.55);
        }
        // The hay meadow (hayMask.js): long green grass, pale stubble in swaths once cut, a darker tan once baled, one surface with the field round it.
        // The picture is read through a wobble and a noise threshold, so the edge and the cut cells' borders are ragged, never a straight line.
        vec2 hayWarp = (vec2(texture2D(detailMap, vWorldXZ * 0.31).r, texture2D(detailMap, vWorldXZ * 0.27 + 0.37).r) - 0.5) * 2.2;
        vec4 hayS = texture2D(hayMap, (vWorldXZ + hayWarp - hayOrigin) / haySize);
        float hayNoise = texture2D(detailMap, vWorldXZ * 0.8).r * 0.6 + texture2D(detailMap, vWorldXZ * 0.09).r * 0.4 - 0.5;
        float hayIn = smoothstep(0.38, 0.62, hayS.a + hayNoise * 0.55);
        float hayCut = smoothstep(0.4, 0.6, hayS.r + hayNoise * 0.5);
        float hayBaled = smoothstep(0.4, 0.6, hayS.g + hayNoise * 0.5);
        float hayGrain = texture2D(detailMap, vWorldXZ * 2.1).r;
        float hayStripe = 0.5 + 0.5 * sin(vWorldXZ.x * 1.9635 + hayNoise * 1.5);
        vec3 hayCol = mix(vec3(0.17, 0.27, 0.05) * mix(0.8, 1.25, hayGrain) * mix(0.9, 1.1, detail2), vec3(0.58, 0.47, 0.2) * mix(0.78, 1.22, hayGrain) * mix(0.84, 1.1, hayStripe) * mix(0.85, 1.15, detail), hayCut);
        hayCol = mix(hayCol, vec3(0.44, 0.34, 0.13) * mix(0.8, 1.2, hayGrain) * mix(0.85, 1.15, detail), hayBaled);
        vec2 hayTrackUv = (vWorldXZ - hayTrackOrigin) / hayTrackSize;
        float hayTrackIn = step(0.0, hayTrackUv.x) * step(hayTrackUv.x, 1.0) * step(0.0, hayTrackUv.y) * step(hayTrackUv.y, 1.0);
        float hayPressed = texture2D(hayTrackMap, hayTrackUv).r * hayTrackIn * (1.0 - hayCut);
        hayCol = mix(hayCol, vec3(0.42, 0.5, 0.2) * mix(0.9, 1.1, hayGrain), hayPressed * 0.9);
        diffuseColor.rgb = mix(diffuseColor.rgb, hayCol, hayIn * 0.94);
        // Ground the tyres have worn: churned brown where it's soft, dark and glossy where it's a bog, ragged at the edges.
        // Found through the table of tiles: where a tile has been worn its slot in the atlas, else nothing and the ground is as it was painted.
        vec2 wearTp = (vWorldXZ - wearOrigin) / wearTile;
        vec2 wearTi = floor(wearTp);
        float wearIn = step(0.0, wearTi.x) * step(0.0, wearTi.y) * step(wearTi.x, wearDims.x - 1.0) * step(wearTi.y, wearDims.y - 1.0);
        vec4 wearSlot = texture2D(wearIndex, (wearTi + 0.5) / wearDims);
        wearIn *= step(0.5, wearSlot.r * 255.0);
        vec2 wearTexel = (floor(wearSlot.rg * 255.0 + 0.5) - 1.0) * ${SLOT}.0 + (wearTp - wearTi) * ${TILE_CELLS}.0 + ${TILE_MARGIN}.0;
        vec4 wearS = texture2D(wearMap, wearTexel / wearAtlas) * wearIn;
        vec2 worn = wearS.rg;
        float rag = (texture2D(detailMap, vWorldXZ * 0.9).r - 0.5) * 0.4;
        float wornSoft = smoothstep(0.15, 0.55, worn.r + rag);
        float wornBog = smoothstep(0.25, 0.65, worn.g + rag);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.19, 0.14, 0.085), wornSoft * 0.75);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.085, 0.06, 0.036), wornBog * 0.9);
        // Mud the tyres have carried onto the road: brown smears along their lines, broken up at the edges, the thick ones darker.
        vec2 mudUv = (vWorldXZ - roadMudOrigin) / roadMudSize;
        float mudIn = step(0.0, mudUv.x) * step(mudUv.x, 1.0) * step(0.0, mudUv.y) * step(mudUv.y, 1.0);
        float smear = texture2D(roadMudMap, mudUv).r * mudIn;
        float onRoad = smoothstep(0.04, 0.3, smear + rag * 0.5) * smoothstep(0.0, 0.03, smear);
        diffuseColor.rgb = mix(diffuseColor.rgb, mix(vec3(0.3, 0.23, 0.15), vec3(0.17, 0.12, 0.075), smoothstep(0.3, 0.9, smear)), onRoad * 0.85);
        // Frost on a freezing morning: white on the grass with a glitter of crystals, melted along the lines the tyres have rolled (the
        // wear map's blue) and gone where the ground is churned. It sits less thickly on the road.
        float thawed = wearS.b;
        float grain = texture2D(detailMap, vWorldXZ * 2.3).r;
        float patchy = 0.75 + 0.25 * (texture2D(detailMap, vWorldXZ * 0.07).r - 0.5) * 2.0;
        float frostAmt = uFrost * patchy * (1.0 - smoothstep(0.1, 0.6, thawed)) * (1.0 - wornSoft) * (1.0 - 0.45 * onRoad);
        float glitter = smoothstep(0.82, 1.0, texture2D(detailMap, vWorldXZ * 5.1).r) * frostAmt;
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.86, 0.91, 0.94) * mix(0.9, 1.08, grain), frostAmt * 0.72) + vec3(0.25) * glitter;
        // Snow: it lies in patches at first and joins up as the cover grows. The tyres' lines and churned ground show through it
        // (the wear map), so tracks stay, and it lies a little thinner where mud has been on the road, and the tarmac takes more cover to whiten (it is grey-white first and goes first).
        float snowPatch = texture2D(detailMap, vWorldXZ * 0.11).r * 0.6 + texture2D(detailMap, vWorldXZ * 0.9).r * 0.4;
        float tarmacHere = texture2D(tarmacMap, (vWorldXZ - tarmacOrigin) / tarmacSize).r;
        float snowLay = smoothstep(0.0, 0.25, uSnow * 1.5 - (snowPatch - 0.25) * 0.9 - 0.4 * tarmacHere);
        float snowAmt = snowLay * (1.0 - 0.7 * smoothstep(0.1, 0.5, thawed)) * (1.0 - 0.85 * wornSoft) * (1.0 - 0.3 * onRoad);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.93, 0.95, 0.98) * mix(0.93, 1.04, grain), snowAmt * 0.93);
        float snowGlint = smoothstep(0.86, 1.0, texture2D(detailMap, vWorldXZ * 6.3).r) * snowAmt;
        diffuseColor.rgb += vec3(0.12) * snowGlint;
        // Wet tarmac: dark and glossy, drying in patches (each spot has its own point at which it goes dull), not under frost, snow or mud.
        float dryPoint = clamp(0.5 + (texture2D(detailMap, vWorldXZ * 0.04).r * 0.7 + texture2D(detailMap, vWorldXZ * 0.17).r * 0.3 - 0.5) * 3.2, 0.05, 0.95);
        float wetRoad = tarmacHere * smoothstep(dryPoint - 0.05, dryPoint + 0.1, uRoadWet) * (1.0 - 0.8 * onRoad) * (1.0 - frostAmt) * (1.0 - snowAmt);
        diffuseColor.rgb *= 1.0 - 0.45 * wetRoad;`,
      )
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n        roughnessFactor *= 1.0 - 0.4 * wornBog;\n        roughnessFactor = mix(roughnessFactor, 0.55, frostAmt * 0.5);\n        roughnessFactor = mix(roughnessFactor, 0.85, snowAmt * 0.6);\n        roughnessFactor = mix(roughnessFactor, 0.08, wetRoad);')
      // The sky in the wet road, strongest where you look along it.
      .replace('#include <opaque_fragment>', 'float skyLook = pow(1.0 - clamp(dot(normalize(vViewPosition), normal), 0.0, 1.0), 3.0);\n        outgoingLight += uSkyTint * wetRoad * (0.04 + 0.35 * skyLook);\n        #include <opaque_fragment>');
  };
}

function createOuterRing(layout, bounds, heights, fields) {
  const m = layout.outerMargin;
  const minX = bounds.minX - m;
  const minZ = bounds.minZ - m;
  const spanX = bounds.maxX - bounds.minX + 2 * m;
  const spanZ = bounds.maxZ - bounds.minZ + 2 * m;
  const stepTarget = 4;
  const segX = Math.ceil(spanX / stepTarget);
  const segZ = Math.ceil(spanZ / stepTarget);
  const stepX = spanX / segX;
  const stepZ = spanZ / segZ;
  const nz = segZ + 1;
  const count = (segX + 1) * nz;
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  for (let ix = 0; ix <= segX; ix++) {
    for (let iz = 0; iz <= segZ; iz++) {
      const i = ix * nz + iz;
      const x = minX + ix * stepX;
      const z = minZ + iz * stepZ;
      positions.set([x, heights.heightAt(x, z), z], i * 3);
      // Fading from the farm's grass just beyond its hedges, as the ground texture does (groundTexture.js).
      colors.set(patchColor(x, z, patchBlend(fields.outside(x, z))), i * 3);
    }
  }
  const indices = [];
  const inside = (ix, iz) => {
    const x = minX + ix * stepX;
    const z = minZ + iz * stepZ;
    return x >= bounds.minX - 1e-3 && x <= bounds.maxX + 1e-3 && z >= bounds.minZ - 1e-3 && z <= bounds.maxZ + 1e-3;
  };
  for (let ix = 0; ix < segX; ix++) {
    for (let iz = 0; iz < segZ; iz++) {
      if (inside(ix, iz) && inside(ix + 1, iz + 1) && inside(ix + 1, iz) && inside(ix, iz + 1)) continue;
      const a = ix * nz + iz;
      const b = a + 1;
      const c = a + nz;
      const d = c + 1;
      indices.push(a, b, c, c, b, d);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }));
  mesh.receiveShadow = true;
  mesh.name = 'outerTerrain';
  return mesh;
}

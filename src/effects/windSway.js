// Hedges and trees leaning and rocking in the wind, done in the vertex shader so the thousands of instances cost nothing on the CPU.
// `swayMaterials(root, metres)` patches a model's materials; the game moves the shared `windUniforms` each frame (world/wind.js).
// The lean is along the wind in world space whatever way each instance is turned, bigger higher up, with a slow rock out of step
// from place to place so a hedge ripples rather than nodding as one.

/** How far the top leans in an ordinary wind, in metres, for each kind (the game sets them from the wind's tuning). */
export const swayMetres = { hedge: { value: 0.14 }, tree: { value: 0.6 } };

export const windUniforms = {
  uWindDir: { value: [0, 0] }, // the wind's direction (unit x, z)
  uWindPush: { value: 0 }, // how strong it is now, 1 an ordinary wind
  uWindTime: { value: 0 },
};

/** Patches every material under `root` so what it draws leans in the wind: `kind` ('hedge' or 'tree') says how far, over `height` metres. */
export function swayMaterials(root, kind, height) {
  const metres = swayMetres[kind];
  const done = new Set();
  root.traverse((o) => {
    if (!o.isMesh) return;
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
      if (done.has(m)) continue;
      done.add(m);
      const prior = m.onBeforeCompile;
      m.onBeforeCompile = (shader, renderer) => {
        prior?.call(m, shader, renderer);
        Object.assign(shader.uniforms, windUniforms, { uSwayMetres: metres });
        shader.vertexShader = shader.vertexShader
          .replace('#include <common>', `#include <common>\nuniform vec2 uWindDir;\nuniform float uWindPush;\nuniform float uWindTime;\nuniform float uSwayMetres;`)
          .replace(
            '#include <begin_vertex>',
            `#include <begin_vertex>
#ifdef USE_INSTANCING
{
  mat3 sm = mat3(instanceMatrix);
  vec3 wp = (instanceMatrix * vec4(position, 1.0)).xyz;
  float up = clamp((wp.y - instanceMatrix[3].y) / ${height.toFixed(2)}, 0.0, 1.0);
  float rock = 0.55 + 0.45 * sin(uWindTime * 1.7 + instanceMatrix[3].x * 0.31 + instanceMatrix[3].z * 0.23 + wp.y * 0.4);
  float lean = uSwayMetres * uWindPush * rock * up * up;
  transformed += inverse(sm) * vec3(uWindDir.x * lean, 0.0, uWindDir.y * lean);
}
#endif`,
          );
      };
      m.customProgramCacheKey = () => `sway${kind}/${height}`;
      m.needsUpdate = true;
    }
  });
}

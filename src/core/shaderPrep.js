// Shaders prepared before anything needs them (#372). Three.js builds a material's shader the first time it is drawn, which is a hitch of tens
// to hundreds of milliseconds, so the first look at the village, a vehicle or a hidden set piece stuttered. This asks for every program up
// front, while the start screen is up: a slice of the scene at a time so the page stays responsive, with the graphics driver linking them
// in parallel where it can.

/** Makes every hidden object under `root` visible (three.js only prepares what it would draw), and returns the function that hides them again. */
export function showHidden(root) {
  const hidden = [];
  root.traverse((o) => {
    if (!o.visible) {
      hidden.push(o);
      o.visible = true;
    }
  });
  return () => {
    for (const o of hidden) o.visible = false;
  };
}

const tick = () => new Promise((r) => setTimeout(r, 0));

/** Asks the renderer for the shaders of everything in `scene`, hidden things included, a few top-level children at a time, and resolves once they
 * are all linked. Visibility is put back before anything can draw. Returns { children, ms }. */
export async function prepareShaders(renderer, scene, camera, { pause = tick, now = () => performance.now(), sliceMs = 8 } = {}) {
  const started = now();
  let sliceFrom = started;
  const waiting = [];
  let children = 0;
  for (const child of scene.children) {
    if (child.isLight) continue;
    const restore = showHidden(child);
    try {
      // compileAsync gathers the materials before it returns its promise, so what was hidden can be hidden again straight away.
      waiting.push(renderer.compileAsync(child, camera, scene));
    } finally {
      restore();
    }
    children++;
    if (now() - sliceFrom >= sliceMs) { // give the page back after a few milliseconds, so the start screen and a quick click stay smooth
      await pause();
      sliceFrom = now();
    }
  }
  await Promise.all(waiting);
  return { children, ms: now() - started };
}

// The oaks and bushes the world's builders place (the boundary tree line, the hedgerow oaks, the lanes', the hill's and the river's, the wood's, the
// bushes in and beside the hedges), gathered and scattered once when they are all placed (#837). Each builder used to scatter its own, so a 60 m tile
// with oaks from two of them was two batches, and only the wood's oaks had a far version: the rest were the full 6,300-triangle oak and the full
// bush at any distance, a third of what the hedges cost in view. Now a tile is one batch a model, and each tile swaps for its far version (the far
// oak, the far bush: treeFar.js) beyond `treeFullDistance`, by the hedges' tile swap. docs/decisions/performance.md, "Oaks and bushes far away (#837)".

import * as THREE from 'three';
import { instanceModel } from './assets.js';
import { HedgeSwap } from './hedgeFar.js';
import { farBush, farTree } from './treeFar.js';

export class Scatter {
  constructor() {
    this.sets = []; // { model, castShadow, far, matrices }, one for each model and shadow setting
    this.farModels = new Map(); // a far version made once a model
  }

  /**
   * Adds `matrices` (placed copies of `model`, a GLTF scene) to be scattered with every other builder's of the same model. `far(model)` makes its far
   * version (`farTree`, `farBush`); `castShadow` as for `instanceModel`.
   */
  add(model, matrices, { far, castShadow = true }) {
    if (!matrices.length) return;
    let set = this.sets.find((s) => s.model === model && s.castShadow === castShadow);
    if (!set) this.sets.push((set = { model, castShadow, far, matrices: [] }));
    set.matrices.push(...matrices);
  }

  /** The farm's two oaks: `lists` is [matrices of `models.treeA`, of `models.treeB`]. */
  oaks(models, [a, b]) {
    this.add(models.treeA.scene, a, { far: farTree });
    this.add(models.treeB.scene, b, { far: farTree });
  }

  /** The farm's bush, placed at `matrices`; a bush in the hedges casts no shadow, a thorn standing on its own does. */
  bushes(models, matrices, { castShadow = false } = {}) {
    this.add(models.bush.scene, matrices, { far: farBush, castShadow });
  }

  /** Puts them all in `scene`, near and far in the same tiles, and returns the swap between them for `FarDetail.treeSwaps` (null if nothing was added). */
  build(scene) {
    if (!this.sets.length) return null;
    const near = new THREE.Group();
    near.name = 'trees';
    const far = new THREE.Group();
    far.name = 'treesFar';
    for (const s of this.sets) {
      if (!this.farModels.has(s.model)) this.farModels.set(s.model, s.far(s.model));
      near.add(...instanceModel(s.model, s.matrices, { castShadow: s.castShadow }).children);
      far.add(...instanceModel(this.farModels.get(s.model), s.matrices, { castShadow: s.castShadow }).children);
    }
    scene.add(near, far);
    return new HedgeSwap(near, far);
  }
}

// What you see of your own kit riding an open vehicle (npc/headgear.js): the peak of your helmet along the top of the view and the rubber
// frame of your goggles round the edges, with a faint tint over the lens. A plain element under the mud on the lens (effects/lensMudView.js), so
// mud lands on the goggles, not behind them.

export class GogglesOverlay {
  constructor() {
    const el = document.createElement('div');
    el.id = 'goggles-overlay';
    el.style.cssText = 'position:fixed;inset:0;z-index:3;pointer-events:none;display:none';
    document.body.appendChild(el);
    this.el = el;
    this.key = '';
  }

  /** `you`: { helmet, goggles }; `active`: riding something open. */
  update(you, active) {
    const key = active && (you.helmet || you.goggles) ? `${+you.helmet}${+you.goggles}` : '';
    if (key === this.key) return;
    this.key = key;
    if (!key) {
      this.el.style.display = 'none';
      return;
    }
    const layers = [];
    if (you.goggles) {
      // A frame with rounded eye openings left and right of a nose bridge, drawn as a thick inset shadow, and a light tint over the whole lens.
      layers.push('radial-gradient(ellipse 70% 62% at 50% 50%, rgba(120,170,200,0.05) 0%, rgba(120,170,200,0.05) 78%, rgba(18,18,18,0.92) 100%)');
    }
    if (you.helmet) layers.push('linear-gradient(to bottom, rgba(20,20,22,0.85) 0%, rgba(20,20,22,0.85) 3.5%, rgba(20,20,22,0) 4.5%)');
    this.el.style.background = layers.join(',');
    this.el.style.display = 'block';
  }
}

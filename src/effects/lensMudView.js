// Draws the mud on the lens (lensMud.js) as a canvas laid over the view, under the HUD. Redrawn about ten times a second while anything is
// stuck on it, and not at all when the lens is clean.

const W = 960;
const H = 540;
const REDRAW = 0.1; // seconds between redraws

export class LensMudView {
  constructor() {
    const c = document.createElement('canvas');
    c.id = 'lens-mud';
    c.width = W;
    c.height = H;
    c.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;z-index:4;pointer-events:none;display:none';
    document.body.appendChild(c);
    this.canvas = c;
    this.ctx = c.getContext('2d');
    this.light = 1; // 1 in daylight, down towards a dark brown at night so it does not glow
    this.since = 1;
    this.shown = false;
  }

  /** 0..1 daylight: the mud keeps its colour in the day and goes dark with the night. */
  setLight(v) {
    this.light = v;
  }

  /** Draws `lens` if `active` (riding something open), else hides it. */
  update(dt, lens, active) {
    const on = active && lens.splats.length > 0;
    if (!on) {
      if (this.shown) {
        this.canvas.style.display = 'none';
        this.ctx.clearRect(0, 0, W, H);
        this.shown = false;
      }
      return;
    }
    this.since += dt;
    if (this.shown && this.since < REDRAW) return;
    this.since = 0;
    this.shown = true;
    this.canvas.style.display = 'block';
    this.draw(lens);
  }

  draw(lens) {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, W, H);
    const k = 0.35 + 0.65 * this.light;
    for (const sp of lens.splats) {
      const a = Math.min(1, sp.thick * 1.15);
      const cx = sp.x * W;
      const cy = sp.y * H;
      const r = sp.size * H;
      ctx.save();
      ctx.translate(cx, cy);
      if (sp.kind === 'drop') {
        ctx.fillStyle = `rgba(${Math.round(190 * k)},${Math.round(200 * k)},${Math.round(205 * k)},${(a * 0.35).toFixed(3)})`;
        ctx.beginPath();
        ctx.ellipse(0, 0, r * 0.8, r, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = `rgba(255,255,255,${(a * 0.4).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(-r * 0.25, -r * 0.3, r * 0.22, 0, Math.PI * 2);
        ctx.fill();
      } else if (sp.smeared) {
        // Wiped: a wide, thin, streaky brown with no body to it.
        ctx.rotate((sp.seed - 0.5) * 0.5);
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 1.4);
        g.addColorStop(0, `rgba(${Math.round(84 * k)},${Math.round(62 * k)},${Math.round(40 * k)},${(a * 0.7).toFixed(3)})`);
        g.addColorStop(1, `rgba(${Math.round(84 * k)},${Math.round(62 * k)},${Math.round(40 * k)},0)`);
        ctx.fillStyle = g;
        ctx.scale(1.8, 0.7);
        ctx.beginPath();
        ctx.arc(0, 0, r * 1.4, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // A lumpy blob with a few flecks round it and a wet glint while it is fresh.
        ctx.fillStyle = `rgba(${Math.round(70 * k)},${Math.round(50 * k)},${Math.round(30 * k)},${a.toFixed(3)})`;
        ctx.beginPath();
        const n = 10;
        for (let i = 0; i <= n; i++) {
          const ang = (i / n) * Math.PI * 2;
          const rr = r * (0.75 + 0.35 * Math.sin(ang * 3 + sp.seed * 40) * Math.cos(ang * 2 - sp.seed * 17) + 0.12 * Math.sin(ang * 7 + sp.seed * 9));
          const x = Math.cos(ang) * rr;
          const y = Math.sin(ang) * rr * 0.85;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fill();
        for (let i = 0; i < 4; i++) {
          const ang = sp.seed * 20 + i * 1.7;
          const d = r * (1.15 + 0.5 * ((sp.seed * (i + 3)) % 1));
          ctx.beginPath();
          ctx.arc(Math.cos(ang) * d, Math.sin(ang) * d, r * (0.1 + 0.08 * ((sp.seed * (i + 5)) % 1)), 0, Math.PI * 2);
          ctx.fill();
        }
        if (sp.thick > 0.5) {
          ctx.fillStyle = `rgba(255,240,215,${((sp.thick - 0.5) * 0.35).toFixed(3)})`;
          ctx.beginPath();
          ctx.ellipse(-r * 0.25, -r * 0.3, r * 0.2, r * 0.1, -0.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();
    }
  }
}

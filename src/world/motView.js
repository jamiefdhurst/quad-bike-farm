import './mot.css';

// The MOT sheet the garage hands you after a test (farm/mot.js `sheetLines`): a paper card low on the screen, like the rolling road's slip, that
// fades by itself. A fail is red and a pass green, and it is how you read what to put right at the bench.

export class MotSheet {
  constructor() {
    const el = document.createElement('div');
    el.className = 'mot-sheet';
    el.style.display = 'none';
    el.innerHTML = '<div class="ms-card"><div class="ms-title"></div><div class="ms-rows"></div><div class="ms-verdict"></div><div class="ms-advice"></div></div>';
    document.body.appendChild(el);
    this.el = el;
    this.title = el.querySelector('.ms-title');
    this.rows = el.querySelector('.ms-rows');
    this.verdict = el.querySelector('.ms-verdict');
    this.advice = el.querySelector('.ms-advice');
    this.left = 0;
  }

  get isShown() {
    return this.left > 0;
  }

  show(lines, passed, seconds = 30) {
    this.title.textContent = lines.title;
    this.rows.replaceChildren(
      ...lines.rows.map((r) => {
        const row = Object.assign(document.createElement('div'), { className: `ms-row ${r.pass ? 'ms-pass' : 'ms-fail'}` });
        row.append(Object.assign(document.createElement('span'), { textContent: r.name }), Object.assign(document.createElement('span'), { textContent: r.pass ? 'pass' : r.note }));
        return row;
      }),
    );
    this.verdict.textContent = lines.verdict;
    this.verdict.className = `ms-verdict ${passed ? 'ms-pass' : 'ms-fail'}`;
    this.advice.textContent = lines.advice;
    this.el.style.display = 'block';
    this.left = seconds;
  }

  hide() {
    this.left = 0;
    this.el.style.display = 'none';
  }

  update(dt) {
    if (this.left <= 0) return;
    this.left -= dt;
    if (this.left <= 0) this.hide();
  }
}

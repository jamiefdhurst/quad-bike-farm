// Small context menu for talking to NPCs. Works without leaving pointer lock:
// number keys pick an option, or scroll to highlight and click (or press Enter).

export class Menu {
  constructor(root) {
    this.el = document.createElement('div');
    this.el.className = 'menu';
    this.el.style.display = 'none';
    root.appendChild(this.el);
    this.options = [];
    this.selected = 0;
    this.isOpen = false;
  }

  /**
   * @param {string} title
   * @param {{label: string, run: () => void}[]} options
   */
  open(title, options) {
    this.title = title;
    this.options = [...options, { label: 'Never mind', run: () => {} }];
    this.selected = 0;
    this.isOpen = true;
    this.render();
    this.el.style.display = 'block';
  }

  close() {
    this.isOpen = false;
    this.el.style.display = 'none';
  }

  render() {
    const items = this.options
      .map(
        (o, i) =>
          `<div class="menu-item${i === this.selected ? ' selected' : ''}"><span class="key">${i + 1}</span>${o.label}</div>`,
      )
      .join('');
    this.el.innerHTML = `<div class="menu-title">${this.title}</div>${items}<div class="menu-footer">1-${this.options.length} or scroll and click · E to close</div>`;
  }

  choose(index) {
    const option = this.options[index];
    this.close();
    option?.run();
  }

  /** Returns true while the menu is consuming input. */
  handleInput(input) {
    if (!this.isOpen) return false;
    for (let i = 0; i < this.options.length && i < 9; i++) {
      if (input.wasPressed(`Digit${i + 1}`) || input.wasPressed(`Numpad${i + 1}`)) {
        this.choose(i);
        return true;
      }
    }
    const steps = input.takeWheelSteps();
    if (steps !== 0) {
      this.selected = (this.selected + Math.sign(steps) + this.options.length) % this.options.length;
      this.render();
    }
    if (input.wasPressed('ArrowDown')) {
      this.selected = (this.selected + 1) % this.options.length;
      this.render();
    }
    if (input.wasPressed('ArrowUp')) {
      this.selected = (this.selected - 1 + this.options.length) % this.options.length;
      this.render();
    }
    if (input.wasClicked(0) || input.wasPressed('Enter') || input.wasPressed('Space')) {
      this.choose(this.selected);
      return true;
    }
    if (input.wasPressed('KeyE') || input.wasPressed('KeyQ') || input.wasPressed('Escape')) {
      this.close();
    }
    return true;
  }
}

import '../world/classifieds.css';

/**
 * The last few days' stories (farm/dayStory.js), read from the wall calendar by day. A close-up card like the tin's: `B` or `Esc` closes it.
 * It is up while the calendar can't yet be used to call it a day, so the calendar does one thing at a time.
 */
export class StoriesView {
  constructor({ game }) {
    this.game = game;
    const el = document.createElement('div');
    el.className = 'classifieds day-stories';
    el.style.display = 'none';
    el.innerHTML = '<div class="cl-card"><div class="cl-title">The last few days</div><div class="cl-body"></div><div class="cl-keys">B to close</div></div>';
    document.body.appendChild(el);
    this.el = el;
    this.bodyEl = el.querySelector('.cl-body');
  }

  get isOpen() {
    return this.el.style.display !== 'none';
  }

  open() {
    this.render();
    this.el.style.display = 'block';
    document.body.classList.add('classifieds-open');
    this.game.player.moveEnabled = false;
  }

  close() {
    this.el.style.display = 'none';
    document.body.classList.remove('classifieds-open');
    this.game.player.moveEnabled = true;
  }

  handleInput(input) {
    this.game.player.moveEnabled = false;
    input.takeWheelSteps();
    if (input.wasPressed('KeyB') || input.wasPressed('Escape')) this.close();
  }

  render() {
    const stories = this.game.stories.slice().reverse();
    const rows = stories.map((s) => {
      const row = document.createElement('div');
      row.className = 'cl-ad';
      row.textContent = `Day ${s.day}: ${s.text}`;
      return row;
    });
    if (!rows.length) rows.push(Object.assign(document.createElement('div'), { className: 'cl-hint', textContent: 'No days written up yet. Call it a day at the calendar in the evening.' }));
    this.bodyEl.replaceChildren(...rows);
  }
}

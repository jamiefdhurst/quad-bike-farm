import RAPIER from '@dimforge/rapier3d-compat';
import { Game } from './game.js';

const status = document.getElementById('overlay-status');

try {
  await RAPIER.init();
  const game = new Game(RAPIER, document.getElementById('game'));
  await game.load((msg) => (status.textContent = msg));
  status.textContent = 'Ready';
  game.start();
} catch (err) {
  status.textContent = `Failed to start: ${err.message}`;
  throw err;
}

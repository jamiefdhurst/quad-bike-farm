// The standard build, whose wasm is a file the browser fetches and caches (the -compat one carries it as base64 inside the bundle).
import * as RAPIER from '@dimforge/rapier3d';
import { Game } from './game.js';

const status = document.getElementById('overlay-status');

try {
  const game = new Game(RAPIER, document.getElementById('game'));
  await game.load((msg) => (status.textContent = msg));
  status.textContent = 'Ready';
  game.start();
} catch (err) {
  status.textContent = `Failed to start: ${err.message}`;
  throw err;
}

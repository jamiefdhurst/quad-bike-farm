import * as THREE from 'three';
import { decalMesh } from './detail/decals.js';
import { KODIAK_DECK } from './kodiakBody.js';

// The loan quad's own parts (TODO 96) on top of what it shares with the blue's body (grizzlyDetail.js): the stickers, the dealer's among them.


/** The model's name along each side of the tank cover, the dealer's sticker on the rear fender's top beside the seat, and a warning label. */
export function addKodiakDecals(root) {
  for (const s of [-1, 1]) {
    const name = decalMesh('stripes', { colours: ['#1c3b78', '#e4572e'], text: 'Ursa 450', ink: '#ffffff' }, { width: 0.26, name: 'tankDecal' });
    name.position.set(s * 0.193, 0.79, 0.3); // the tank cover's side, a millimetre proud
    name.rotation.y = s * (Math.PI / 2);
    root.add(name);
  }
  const dealer = decalMesh('dealer', {}, { width: 0.12, name: 'dealerDecal' });
  dealer.position.set(0.445, KODIAK_DECK.rear.top - KODIAK_DECK.rear.crown * 0.55 + 0.001, -0.42); // flat on the left rear fender's top beside the seat
  dealer.rotation.x = -Math.PI / 2;
  root.add(dealer);
  const warn = decalMesh('warning', {}, { width: 0.08, name: 'warningDecal' });
  warn.position.set(-0.445, KODIAK_DECK.rear.top - KODIAK_DECK.rear.crown * 0.55 + 0.001, -0.42);
  warn.rotation.x = -Math.PI / 2;
  warn.rotation.z = Math.PI;
  root.add(warn);
}


// The wardrobe scene's looks: every outfit the girls can be dealt (npc/outfits.js), each with every layer the barn's rack adds
// (a jumper, a wax jacket with its hood down or up, both). One look at a time, in a fixed order, so running the scene again shows the
// next. Pure: the scene (sceneSetups.js) does the dressing.

/** What she wears on top, as a patch on her style (`completeStyle`). `kind` is an OUTFIT_KINDS key. */
export const OUTFIT_LOOKS = [
  { name: 'her polo', style: { kind: 'polo', popped: false } },
  { name: 'her polo, collar popped', style: { kind: 'polo', popped: true } },
  { name: 'a plaid shirt buttoned over her polo', style: { kind: 'plaid', plaidOpen: false, popped: false } },
  { name: 'a plaid shirt worn open', style: { kind: 'plaid', plaidOpen: true, popped: false } },
  { name: 'two polos', style: { kind: 'doublePolo', popped: false } },
  { name: 'a shirt and tie, done up', style: { kind: 'shirtTie', tieLoose: false, shirtOverPolo: false, popped: false } },
  { name: 'a shirt and tie, loosened', style: { kind: 'shirtTie', tieLoose: true, shirtOverPolo: false, popped: false } },
  { name: 'a shirt and tie over her polo', style: { kind: 'shirtTie', tieLoose: false, shirtOverPolo: true, popped: false } },
  { name: 'the crop-top (Jess only; Amy keeps her polo)', style: { kind: 'cropTop', popped: false }, only: ['jess'] },
];

/** What goes over it from the rack. */
export const LAYERS = [
  { name: 'nothing over it', jumper: false, coat: false, hood: false },
  { name: 'a jumper', jumper: true, coat: false, hood: false },
  { name: 'a wax jacket, hood down', jumper: false, coat: true, hood: false },
  { name: 'a wax jacket, hood up', jumper: false, coat: true, hood: true },
  { name: 'a jumper under a wax jacket, hood up', jumper: true, coat: true, hood: true },
];

export const LOOK_COUNT = OUTFIT_LOOKS.length * LAYERS.length;

/** Look number `n` (it wraps): every layer for an outfit, then the next outfit. */
export function wardrobeLook(n) {
  const i = ((Math.floor(n) % LOOK_COUNT) + LOOK_COUNT) % LOOK_COUNT;
  return { number: i + 1, outfit: OUTFIT_LOOKS[Math.floor(i / LAYERS.length)], layer: LAYERS[i % LAYERS.length] };
}

/** The style patch a girl wears for a look: an outfit she can't wear (Amy's crop-top) falls back to her polo. */
export function styleFor(look, girlId, canWear) {
  const o = look.outfit;
  const ok = (!o.only || o.only.includes(girlId)) && canWear(o.style.kind);
  return ok ? o.style : OUTFIT_LOOKS[0].style;
}

export function describeLook(look) {
  return `look ${look.number} of ${LOOK_COUNT}: ${look.outfit.name}, ${look.layer.name}`;
}

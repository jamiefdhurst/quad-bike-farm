// Her own day (#20, was TODO 125). Each girl starts a game with a loose agenda, one thing she has in mind for today ("wants to jump the
// ramp", "wants the Land Rover out"). Every offer kind on it is boosted in the chooser all game (game.js updateMinds multiplies
// `boost` in beside the memory and the mood), so she keeps drifting back to it without ever being forced, and early on she says what
// it is. Rolled afresh each load, from her own odds (`agendaOdds` in characters.js), so it isn't kept in the farm's save. Pure.

/** The things she might have in mind: a label for the debug panel, and the offer kinds (chooser.js) that meet it. */
export const AGENDAS = {
  ramp: { label: 'jump the ramp', kinds: ['jumps'] },
  doughnuts: { label: 'spin some doughnuts', kinds: ['doughnuts'] },
  race: { label: 'have a race', kinds: ['race', 'raceDare'] },
  bigOne: { label: 'take a big one out', kinds: ['bigGo'] },
  hill: { label: 'time herself up the hill', kinds: ['climb'] },
  cones: { label: 'do the cones properly', kinds: ['cones'] },
  landRover: { label: 'get the Land Rover out', kinds: ['warmCab'] },
  car: { label: 'take her car out', kinds: ['carGo'] },
  bench: { label: 'get something done at the bench', kinds: ['benchWork'] },
  tea: { label: 'have a proper cup of tea', kinds: ['tea', 'flask'] },
  tidy: { label: 'tidy the quads', kinds: ['lineUp'] },
  fire: { label: 'sit by the bonfire', kinds: ['fire'] },
};

export const AGENDA_IDS = Object.keys(AGENDAS);

/** The line key she says it with. */
export const agendaKey = (id) => `agenda_${id}`;

/** Every agenda as { key: [line] }, with the line each girl says (`say(id)`), for the voice sets. */
export function agendaLineSet(say, make = (lines) => lines) {
  return Object.fromEntries(AGENDA_IDS.map((id) => [agendaKey(id), make(say(id))]));
}

/** Deals one from her odds ({ id: weight }); ids that aren't agendas or have no weight are never dealt. */
export function dealAgenda(odds, random = Math.random) {
  const entries = Object.entries(odds ?? {}).filter(([id, w]) => AGENDAS[id] && w > 0);
  const total = entries.reduce((s, [, w]) => s + w, 0);
  if (!total) return null;
  let r = random() * total;
  for (const [id, w] of entries) if ((r -= w) < 0) return id;
  return entries[entries.length - 1][0];
}

export class Agenda {
  /** `odds`: her taste ({ id: weight }); `p`: agendaMention (seconds before she says so, on average). */
  constructor(odds, p, random = Math.random) {
    this.id = dealAgenda(odds, random);
    this.said = false;
    this.mentionIn = p.agendaMention * (0.5 + random()); // half to one and a half times the usual wait
  }

  /** Swaps it (the debug panel and the console); she has not said this one yet. */
  set(id, p) {
    this.id = AGENDAS[id] ? id : null;
    this.said = false;
    this.mentionIn = p.agendaMention * 0.5;
  }

  /** How much more she wants this offer kind because of it: `agendaBoost` if it's on the agenda, otherwise 1. */
  boost(key, p) {
    return this.id && AGENDAS[this.id].kinds.includes(key) ? p.agendaBoost : 1;
  }

  /** Time passes; true once, when it's time to say what she has in mind (the caller says it, then calls `mention()`). */
  due(dt) {
    if (!this.id || this.said) return false;
    return (this.mentionIn -= dt) <= 0;
  }

  mention() {
    this.said = true;
  }

  /** Said now whatever the timer: the debug panel's "Say what she has in mind". */
  nudge() {
    this.said = false;
    this.mentionIn = 0;
  }

  describe() {
    if (!this.id) return 'nothing in particular';
    return `${AGENDAS[this.id].label}${this.said ? '' : ' (not said yet)'}`;
  }
}

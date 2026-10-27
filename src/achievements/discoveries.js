// The notebook's "Things I've learnt": what you've worked out about the farm, written down the first time it shows itself. Unlike the
// bucket list it isn't a score and nothing is asked of you; a locked line is "???" with a nudge. Pure logic. The game calls `learn(id)` at
// the spot where each thing happens (`stallDiscovery` turns an engine stall into one) and the farm save keeps the ids.

// Each: id, group, text (what you wrote, first person, past what you saw), hint (shown while it's still "???").
export const DISCOVERIES = [
  { id: 'chokeFlood', group: 'Engines', text: 'Leave the choke on and it floods and cuts out. Push it in once it is warm.', hint: 'Something about the choke' },
  { id: 'flood', group: 'Engines', text: 'A flooded engine clears if I crank it with the throttle held open.', hint: 'When it will not catch' },
  { id: 'reserve', group: 'Engines', text: 'When it coughs and dies the tap\'s reserve still has the last couple of litres.', hint: 'Running dry' },
  { id: 'weakBattery', group: 'Engines', text: 'A weak battery cannot keep it ticking over. Keep the revs up.', hint: 'A tired battery' },
  { id: 'bumpStart', group: 'Engines', text: 'A flat battery does not matter if it is rolling. Push it and it catches.', hint: 'No juice to crank it' },
  { id: 'overheat', group: 'Engines', text: 'Run it hot for long enough and it cuts out. Let it cool.', hint: 'Working it too hard' },
  { id: 'seize', group: 'Engines', text: 'Run it short of oil and it seizes solid.', hint: 'Skimping on the oil' },
  { id: 'water', group: 'Engines', text: 'Too much water getting in and it just gives up.', hint: 'Somewhere deep' },
  { id: 'fuelWater', group: 'Engines', text: 'Water in the petrol makes it stall.', hint: 'Bad fuel' },
  { id: 'wax', group: 'Engines', text: 'Diesel waxes up in the cold and starves the engine.', hint: 'A very cold morning' },
  { id: 'carbDrip', group: 'Quads', text: 'A sticky float drips petrol with the tap on. Turn the tap off when I park.', hint: 'A damp patch under a parked quad' },
  { id: 'jessTap', group: 'The girls', text: 'Jess turns the fuel tap off while I am away. If it will not run, check the tap.', hint: 'A quad that will not run after a while away' },
  { id: 'jessChoke', group: 'The girls', text: 'Jess puts the choke on a warm engine. If it runs rich, check the choke.', hint: 'A quad running badly after a while away' },
  { id: 'amyCan', group: 'The girls', text: 'Amy hides the jerry can when I am away. It comes back in time.', hint: 'Something missing' },
  { id: 'amyToolbox', group: 'The girls', text: 'Amy hides the toolbox when I am away. It comes back in time.', hint: 'Something else missing' },
];

/** The discovery an engine stall on a vehicle you're driving teaches, or null. `choke` is how far the choke was in (0..1). */
export function stallDiscovery(reason, choke = 0) {
  if (reason === 'flooded') return choke > 0.3 ? 'chokeFlood' : 'flood';
  const byReason = { noFuel: 'reserve', battery: 'weakBattery', overheated: 'overheat', seized: 'seize', water: 'water', fuelWater: 'fuelWater', wax: 'wax' };
  return byReason[reason] ?? null;
}

/** The discovery a found prank teaches ({ girl, kind } as in pranks.js), or null. */
export function prankDiscovery(prank) {
  if (prank.girl === 'jess') return prank.kind === 'tap' ? 'jessTap' : 'jessChoke';
  return prank.kind === 'hideToolbox' ? 'amyToolbox' : 'amyCan';
}

export class Discoveries {
  constructor(list = DISCOVERIES) {
    this.list = list;
    this.learnt = new Set();
    this.listeners = [];
  }

  onLearn(fn) {
    this.listeners.push(fn);
  }

  /** Writes it down the first time. Returns true if that was new; an id that isn't on the list does nothing. */
  learn(id) {
    const d = this.list.find((x) => x.id === id);
    if (!d || this.learnt.has(id)) return false;
    this.learnt.add(id);
    for (const fn of this.listeners) fn(d);
    return true;
  }

  toJSON() {
    return [...this.learnt];
  }

  /** What an earlier day wrote down, quietly. Ids no longer on the list are dropped. */
  restore(ids) {
    if (!Array.isArray(ids)) return;
    for (const id of ids) if (this.list.some((d) => d.id === id)) this.learnt.add(id);
  }

  forget() {
    this.learnt.clear();
  }

  /** For the notebook, in the shape paginate takes: a line you haven't learnt yet reads "???" with its hint. */
  entries() {
    return this.list.map((d) => {
      const done = this.learnt.has(d.id);
      return { id: d.id, group: d.group, name: done ? d.text : '???', hint: done ? '' : d.hint, points: 0, done, available: true };
    });
  }

  score() {
    return { count: this.learnt.size, totalCount: this.list.length };
  }
}

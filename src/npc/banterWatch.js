// Works out, each frame, which of the girls' exchanges (banter.js) could start:
// who's where, who's riding with you, who's driving or stuck. Keeps a little
// memory so moments (back from a ride, just got stuck) only count once.

const near = (a, b, d) => a.distanceTo(b) < d;

export class BanterWatch {
  constructor() {
    this.rideTime = new Map(); // companion -> seconds riding with you this time
    this.stuckSeen = new Map(); // companion -> already remarked on this time stuck
    this.talked = null; // { chosen, jealous } waiting for the wheel to close
  }

  /** You've opened one girl's wheel; the other may have something to say when it closes. */
  noteTalk(chosen, others) {
    const here = chosen.root.getWorldPosition(chosen.tmpV.clone());
    const jealous = others.find((o) => o !== chosen && near(o.root.getWorldPosition(o.tmpV.clone()), here, 12) && !o.fsm.is('driving'));
    this.talked = jealous ? { chosen, jealous } : null;
  }

  /**
   * @param {number} dt
   * @param {object} s
   * @param {object[]} s.companions  Each with .character.id
   * @param {object|null} s.ridden   The unit you're at the controls of
   * @param {THREE.Vector3} s.you    Where you are
   * @param {boolean} s.wheelOpen
   * @param {{favoured: string, other: string}|null} [s.rivalry]  Who you clearly favour (favour.js)
   */
  triggers(dt, { companions, ridden, you, wheelOpen, rivalry = null }) {
    const out = [];
    if (companions.length < 2) return out;
    const id = (c) => c.character.id;
    const [a, b] = companions;
    const pairs = [
      [a, b],
      [b, a],
    ];
    const withYou = (c) => !!ridden && c.isSeated && c.quad === ridden.quad;
    const driving = (c) => c.fsm.is('driving') && c.drive?.phase !== 'start';
    const onFoot = (c) => c.fsm.is('idle', 'walking');
    // World positions (seated, a girl's root is relative to the quad).
    const at = new Map(companions.map((c) => [c, c.root.getWorldPosition(c.tmpV.clone())]));

    // You've just closed one's wheel with the other close by.
    if (this.talked && !wheelOpen) {
      out.push({ when: 'talked', edge: true, roles: { chosen: id(this.talked.chosen), jealous: id(this.talked.jealous) } });
      this.talked = null;
    }

    for (const [x, y] of pairs) {
      const xPos = at.get(x);
      const yPos = at.get(y);
      // Riding with you past the other.
      if (withYou(x)) {
        this.rideTime.set(x, (this.rideTime.get(x) ?? 0) + dt);
        if (ridden.quad.speed > 2 && !withYou(y) && near(xPos, yPos, 25)) out.push({ when: 'riding', roles: { rider: id(x), watcher: id(y) } });
      } else if ((this.rideTime.get(x) ?? 0) > 30) {
        // Back from a decent ride, by the other one.
        if (near(xPos, yPos, 12)) out.push({ when: 'back', edge: true, roles: { rider: id(x), watcher: id(y) } });
        this.rideTime.set(x, 0);
      } else {
        this.rideTime.set(x, 0);
      }
      // Driving on her own (or with her friend on the back) while the other watches, or shares it.
      if (driving(x)) {
        if (y.isSeated && y.quad === x.quad) {
          if (x.quad.speed > 1.5) out.push({ when: 'sharing', roles: { driver: id(x), passenger: id(y) } });
        } else if (onFoot(y) && !x.quad.passenger && near(xPos, yPos, 30)) {
          out.push({ when: 'watching', roles: { driver: id(x), onlooker: id(y) } });
        }
      }
      // Stuck in a bog (on it, or just got off it), with the other in shouting distance.
      const stuck = x.quad.bog?.stuck && near(xPos, x.quad.position, 4);
      if (stuck && !this.stuckSeen.get(x) && near(xPos, yPos, 40) && !(y.quad === x.quad && !onFoot(y))) {
        this.stuckSeen.set(x, true);
        out.push({ when: 'stuck', edge: true, roles: { stuck: id(x), mocker: id(y) } });
      }
      if (!x.quad.bog?.stuck) this.stuckSeen.set(x, false);
    }

    // Standing about together, near you, with nothing else going on.
    const settled = (c) => c.fsm.is('idle') || (c.isSeated && !withYou(c));
    if (settled(a) && settled(b) && near(at.get(a), at.get(b), 8) && near(at.get(a), you, 14) && !(ridden && ridden.quad.speed > 3)) {
      out.push({ when: 'idle' });
      if (rivalry) out.push({ when: 'favoured', roles: rivalry });
    }
    return out;
  }
}

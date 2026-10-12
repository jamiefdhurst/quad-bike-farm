import * as THREE from 'three';
import { createRandom } from '../core/random.js';
import { registerTuning } from '../core/tuning.js';
import { DEFAULT_PHOTO_PARAMS, PHOTO_PARAM_RANGES, PhotoWall, inFrame, photoReaction, isBlank, clockText } from './photos.js';
import { PhotoBoardView } from './photoBoard.js';

const SAY = { pose: 'photoPose', face: 'photoFace', palm: 'photoPutAway' };
const _dir = new THREE.Vector3();
const _at = new THREE.Vector3();

/**
 * The camera, in the game: the key raises it (the girls in the picture pose, pull a face or put a hand up), the shutter goes a moment later,
 * and the shot is pinned on the barn's corkboard (photos.js, photoBoard.js). The picture is the game's canvas, copied small right after
 * the frame is drawn.
 */
export class PhotoHost {
  constructor(g) {
    this.g = g;
    this.params = { ...DEFAULT_PHOTO_PARAMS };
    this.wall = new PhotoWall(this.params);
    this.view = new PhotoBoardView({ game: g, wall: this.wall });
    this.random = createRandom((g.farmSeed ^ 0x9407 ^ (g.farm.day * 977)) >>> 0);
    this.pending = null; // { left, girls }: the camera is up, the shutter not gone yet
    this.shooting = false; // the shutter goes at the end of this frame
    this.flash = 0;
    this.last = 'none yet';
    this.canvas = document.createElement('canvas');
    this.flashEl = document.createElement('div');
    this.flashEl.id = 'photo-flash';
    document.body.appendChild(this.flashEl);
    registerTuning('Photos', this.params, PHOTO_PARAM_RANGES);
  }

  /** Who is in the picture from where you are looking now: ids of the girls. */
  inFrameNow() {
    const g = this.g;
    g.camera.getWorldDirection(_dir);
    const cam = { x: g.camera.position.x, z: g.camera.position.z, yaw: Math.atan2(_dir.x, _dir.z) };
    return g.companions.filter((c) => inFrame(cam, c.root.getWorldPosition(_at), this.params)).map((c) => c.character.id);
  }

  /** The camera key. Returns whether the camera came up. */
  press() {
    const g = this.g;
    if (this.pending || this.shooting || this.wall.cooling > 0) return false;
    const girls = this.inFrameNow();
    this.pending = { left: this.params.shutterDelay, girls };
    const me = g.player.position;
    g.notice('photo', { x: me.x, y: me.y, z: me.z }, { key: 'camera', strength: 1 });
    for (const c of g.companions) {
      if (!girls.includes(c.character.id)) continue;
      const kind = photoReaction({ pose: c.params.photoPose, face: c.params.photoFace, palm: c.params.photoPalm }, c.favourView().mood);
      if (c.react(kind, { from: me, force: true })) c.voice.say(SAY[kind], { chance: 0.7 });
    }
    return true;
  }

  update(dt) {
    this.wall.update(dt);
    if (this.flash > 0) {
      this.flash = Math.max(0, this.flash - dt);
      this.flashEl.style.opacity = String(this.flash / this.params.flashSeconds);
    }
    if (this.pending && (this.pending.left -= dt) <= 0) {
      this.pending = null;
      this.shooting = true;
    }
  }

  /** Called straight after the frame is drawn: if the shutter went, the picture is on the canvas now. */
  afterRender() {
    if (!this.shooting) return;
    this.shooting = false;
    const g = this.g;
    const p = this.params;
    const src = g.renderer.domElement;
    const sh = Math.min(src.height, src.width / (p.width / p.height));
    const sw = sh * (p.width / p.height);
    this.canvas.width = p.width;
    this.canvas.height = p.height;
    const ctx = this.canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(src, (src.width - sw) / 2, (src.height - sh) / 2, sw, sh, 0, 0, p.width, p.height);
    this.flash = p.flashSeconds;
    this.flashEl.style.opacity = '1';
    if (isBlank(ctx.getImageData(0, 0, p.width, p.height).data, p.blankSpread)) {
      this.last = 'nothing in it';
      g.hud.toast('Nothing in that one', 1.6);
      return;
    }
    const girls = this.inFrameNow();
    this.wall.add({ data: this.canvas.toDataURL('image/jpeg', p.quality), day: g.farm.day, time: clockText(g.daylight.hour), girls }, this.random);
    this.view.refresh();
    this.last = girls.length ? `with ${girls.join(' and ')}` : 'just you';
    g.hud.toast('Photo pinned on the corkboard in the barn', 2);
    g.achievements.note('photo');
    if (girls.length) g.achievements.note('photoGirl');
    g.achievements.best('photosPinned', this.wall.photos.length);
    g.saveFarm?.();
  }

  /** E at the corkboard: the card, and a girl nearby may say something about it. */
  openBoard() {
    this.view.open();
    if (!this.wall.photos.length) return;
    const me = this.g.player.position;
    const near = this.g.companions
      .filter((c) => c.availability().canRemark && Math.hypot(c.root.position.x - me.x, c.root.position.z - me.z) < 8)
      .sort((a, b) => Math.hypot(a.root.position.x - me.x, a.root.position.z - me.z) - Math.hypot(b.root.position.x - me.x, b.root.position.z - me.z))[0];
    near?.voice.say('photoWall', { chance: 0.5 });
  }

  clear() {
    this.wall.clear();
    this.view.refresh();
  }

  describe() {
    return `${this.wall.photos.length} pinned (last: ${this.last})`;
  }
}

import * as THREE from 'three';
import { createRandom } from '../core/random.js';
import { registerTuning } from '../core/tuning.js';
import { DEFAULT_PHOTO_PARAMS, PHOTO_PARAM_RANGES, PhotoWall, inFrame, photoReaction, isBlank, clockText } from './photos.js';
import { PhotoBoardView } from './photoBoard.js';
import { DEFAULT_PHOTO_MODE_PARAMS, PHOTO_MODE_RANGES, PhotoCam, pngSize, pngName } from './photoMode.js';

const SAY = { pose: 'photoPose', face: 'photoFace', palm: 'photoPutAway' };
const HOLD_AT = 1.4; // seconds into a pose (all three are up by 0.3) that photo mode holds it at
const _dir = new THREE.Vector3();
const _at = new THREE.Vector3();

/**
 * The camera, in the game: the key raises it (the girls in the picture pose, pull a face or put a hand up), the shutter goes a moment later,
 * and the shot is pinned on the barn's cork board (photos.js, photoBoard.js). The picture is the game's canvas, copied small right after
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
    this.modeParams = { ...DEFAULT_PHOTO_MODE_PARAMS };
    this.cam = new PhotoCam(this.modeParams);
    registerTuning('Photo mode', this.modeParams, PHOTO_MODE_RANGES);
    this.modeActive = false; // photo mode: the world stands still and the camera flies free (8)
    this.hudHidden = false;
    this.girlsPosing = false;
    this.saved = null; // the camera as it was, and what was hanging from it
    this.fullSize = false; // the next shutter also saves a full-size PNG
    this.saves = 0;
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
      if (!girls.includes(c.character.id) || c.isAsleep) continue; // asleep, she doesn't pose
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

  // Photo mode (8) ---------------------------------------------------------------------------------------------------------------

  /** The key (or the console): into photo mode and out of it. Returns whether it is on now. */
  toggleMode() {
    return this.modeActive ? this.exitMode() : this.enterMode();
  }

  enterMode() {
    const g = this.g;
    if (this.modeActive) return true;
    const cam = g.camera;
    this.saved = { pos: cam.position.clone(), quat: cam.quaternion.clone(), fov: cam.fov, hidden: cam.children.map((c) => [c, c.visible]) };
    cam.getWorldDirection(_dir);
    this.cam.place(cam.position, Math.atan2(-_dir.x, -_dir.z), Math.asin(Math.max(-1, Math.min(1, _dir.y))), cam.fov);
    // What you carry hangs from the camera and would float in front of the lens.
    for (const c of cam.children) c.visible = false;
    this.modeActive = true;
    this.girlsPosing = false;
    this.pending = null;
    g.hud.toast('Photo mode: WASD fly, Space and C up and down, wheel zooms, Enter takes it, E poses the girls, H hides the HUD, B to leave', 4);
    if (typeof speechSynthesis !== 'undefined') speechSynthesis.pause();
    return true;
  }

  exitMode() {
    const g = this.g;
    if (!this.modeActive) return false;
    this.modeActive = false;
    this.setGirlsPosing(false);
    this.setHudHidden(false);
    const s = this.saved;
    if (s) {
      g.camera.position.copy(s.pos);
      g.camera.quaternion.copy(s.quat);
      g.camera.fov = s.fov;
      g.camera.updateProjectionMatrix();
      for (const [c, v] of s.hidden) c.visible = v;
    }
    this.saved = null;
    this.pending = null;
    if (typeof speechSynthesis !== 'undefined') speechSynthesis.resume();
    g.redraw = true;
    return false;
  }

  setHudHidden(on) {
    this.hudHidden = on;
    const hud = document.getElementById('hud');
    if (hud) hud.style.visibility = on ? 'hidden' : '';
  }

  /** G: every girl in the picture strikes a pose (or pulls a face, or puts a hand up) and holds it; again to let them go. */
  setGirlsPosing(on) {
    this.girlsPosing = on;
    const inShot = this.inFrameNow();
    for (const c of this.g.companions) {
      if (on) {
        if (!inShot.includes(c.character.id) || c.isAsleep) continue;
        const kind = photoReaction({ pose: c.params.photoPose, face: c.params.photoFace, palm: c.params.photoPalm }, c.favourView().mood);
        c.react(kind, { force: true });
      } else if (c.reaction && SAY[c.reaction.type]) c.reaction = null;
    }
  }

  /** One frame of photo mode, in place of the whole game's: the camera, the held poses and the shutter. */
  modeFrame(dt, input) {
    const g = this.g;
    const p = this.modeParams;
    const key = (a, b) => (input.isDown(a) ? 1 : 0) - (input.isDown(b) ? 1 : 0);
    if (input.wasPressed('Digit8') || input.wasPressed('KeyB')) return this.exitMode();
    const mouse = input.takeMouseDelta();
    const k = g.player.params.mouseSensitivity * p.lookScale;
    this.cam.step(
      dt,
      { forward: key('KeyW', 'KeyS'), right: key('KeyD', 'KeyA'), up: key('Space', 'KeyC') },
      { x: mouse.x * k, y: mouse.y * k },
      input.takeWheelSteps(),
      input.isDown('ShiftLeft') || input.isDown('ShiftRight'),
      (x, z) => g.world.heightAt(x, z),
    );
    const cam = g.camera;
    cam.position.set(this.cam.pos.x, this.cam.pos.y, this.cam.pos.z);
    cam.rotation.set(this.cam.pitch, this.cam.yaw, 0, 'YXZ');
    if (Math.abs(cam.fov - this.cam.fov) > 0.01) {
      cam.fov = this.cam.fov;
      cam.updateProjectionMatrix();
    }
    if (input.wasPressed('KeyH')) this.setHudHidden(!this.hudHidden);
    if (input.wasPressed('KeyE')) this.setGirlsPosing(!this.girlsPosing);
    if (input.wasPressed('Enter') || input.wasClicked(0)) this.shoot();
    // The girls stand where they were; only a held pose moves them, eased in and then kept at its height.
    for (const c of g.companions) {
      const r = c.reaction;
      if (!r || !SAY[r.type]) continue;
      c.updateReaction(dt);
      if (c.reaction) c.reaction.t = Math.min(c.reaction.t, HOLD_AT);
      c.rig.update(dt);
    }
    g.world.sky.update(0, g.player.position, cam);
    g.world.drawDistance.update(cam.position);
    g.world.farDetail.pixelsPerRadian = 0; // a photo can be blown up, so nothing is left out for being small
    g.world.farDetail.update(cam.position, dt, true);
    this.update(dt);
    g.audioHub.setPaused(true);
  }

  /** Enter or a click in photo mode: the shutter goes at the end of the frame, and the full-size picture is saved as well. */
  shoot() {
    if (this.shooting || this.wall.cooling > 0) return false;
    this.shooting = true;
    this.fullSize = true;
    return true;
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
    if (this.fullSize) this.savePng(src);
    this.fullSize = false;
    if (isBlank(ctx.getImageData(0, 0, p.width, p.height).data, p.blankSpread)) {
      this.last = 'nothing in it';
      g.hud.toast('Nothing in that one', 1.6);
      return;
    }
    const girls = this.inFrameNow();
    this.wall.add({ data: this.canvas.toDataURL('image/jpeg', p.quality), day: g.farm.day, time: clockText(g.daylight.hour), girls }, this.random);
    this.view.refresh();
    this.last = girls.length ? `with ${girls.join(' and ')}` : 'just you';
    g.hud.toast('Photo pinned on the cork board in the barn', 2);
    g.achievements.note('photo');
    if (girls.length) g.achievements.note('photoGirl');
    if (this.modeActive && girls.length >= 2) g.achievements.note('photoModeBoth');
    if (g.companions.some((c) => c.isAsleep && girls.includes(c.character.id))) g.achievements.note('photoAsleep');
    g.achievements.best('photosPinned', this.wall.photos.length);
    g.saveFarm?.();
  }

  /** The frame just drawn, saved to the player's downloads at `pngWidth` across (the screen's shape). */
  savePng(src) {
    const size = pngSize(src.width, src.height, this.modeParams.pngWidth);
    const c = document.createElement('canvas');
    c.width = size.w;
    c.height = size.h;
    c.getContext('2d').drawImage(src, 0, 0, size.w, size.h);
    const name = pngName(this.g.farm.day, clockText(this.g.daylight.hour), ++this.saves);
    c.toBlob((blob) => {
      if (!blob) return;
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 10000);
    }, 'image/png');
    this.g.hud.toast(`Saved ${name}`, 2);
  }

  /** E at the cork board: the card, and a girl nearby may say something about it. */
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
    return `${this.wall.photos.length} pinned (last: ${this.last})${this.modeActive ? '; photo mode on' : ''}`;
  }
}

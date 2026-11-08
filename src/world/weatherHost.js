// The weather in the running game: the console's and the panel's switches for it, the time of day moving on, the forecast turning the day,
// the wind on the hedges and the hay door's shutter, and the snow laid over the farm and the vehicles. The behaviour is weather.js, forecast.js,
// daylight.js, wind.js and snowCoat.js; the state (`weather`, `wind`, `forecast`, `daylight`) stays on the game, which a lot of other
// code reads. game.js builds this and calls updateDaylight(), updateWind() and updateSnowCoat() inside the frame guard.

import { KIND_WARMTH } from './forecast.js';
import { windUniforms, swayMetres } from '../effects/windSway.js';
import { lightsWanted } from '../npc/girlControls.js';
import { snowUniforms, topsCover, vehicleSnowAfter } from './snowCoat.js';
import { coatTree } from './snowCoatView.js';

const HAY_DOOR_OUT = Math.PI / 2; // the hay door looks east: out of it is +x
const BANG_COOLDOWN = 3; // seconds between the shutter's bangs the girls hear

export class WeatherHost {
  constructor(game) {
    this.g = game;
    this.snowCoated = false; // the snow shader laid over the world and the vehicles (once, when it first snows)
    this.shutterBangCool = 0;
  }

  /** Puts the cold on each vehicle's seat after a change to the frost, the snow or the temperature. */
  seatFrost() {
    for (const unit of this.g.units) unit.quad.seatFrost = this.g.weather.seatFrost;
  }

  /** Changes the weather to a kind at once, with the sky, the rain and the frost on the seats following. */
  setKind(kind) {
    const g = this.g;
    if (!g.weather.setKind(kind)) return false;
    g.forecast.cancel(); // set by hand: the day no longer turns, and the board has nothing to say
    g.weather.promise = null;
    g.world.setWeather(g.weather);
    this.seatFrost();
    return true;
  }

  /** How hard it is raining now, 0 to 1 (it settles back to what the weather would do in time). */
  setRain(amount) {
    this.g.weather.rain = this.g.weather.target = Math.max(0, Math.min(1, amount));
  }

  /** How hard it is snowing now, 0 to 1 (it settles back to what the weather would do in time). */
  setSnow(amount) {
    this.g.weather.snow = this.g.weather.snowTarget = Math.max(0, Math.min(1, amount));
  }

  /** How far the ground and the seats are under snow, 0 to 1. */
  setSnowCover(amount) {
    this.g.weather.cover = Math.max(0, Math.min(1, amount));
    this.seatFrost();
  }

  /** The day's temperature in degrees C. */
  setTemperature(celsius) {
    // It goes on following the time of day from there: the day's warmest moves so that it is this now.
    if (this.g.daylight) this.g.weather.peak = this.g.daylight.peakFor(celsius);
    this.g.weather.temperature = celsius;
    this.seatFrost();
  }

  /** Sets the time of day (hours after midnight; past 24 is the same night going on), with the temperature and the frost following at once. */
  setTime(hour) {
    const g = this.g;
    if (!g.daylight) return;
    g.daylight.hour = hour;
    g.weather.temperature = Math.round(g.daylight.temperature(g.weather.peak) * 10) / 10;
    this.seatFrost();
  }

  /**
   * The time of day moving on (world/daylight.js): the temperature with it, so the frost on the ground and the seats forms as the night
   * cools and thaws as the morning warms. The sky follows in world.update.
   */
  updateDaylight(dt) {
    const g = this.g;
    const d = g.daylight;
    if (!d) return;
    d.update(dt);
    const w = g.weather;
    w.temperature = Math.round(d.temperature(w.peak) * 10) / 10;
    w.sunUp = d.sun.light;
    w.dark = d.darkness; // for what the girls say about it (companionVoice.watchWeather)
    for (const unit of g.units) {
      unit.quad.dayFrost = w.seatFrost;
      // A girl driving a cab in the dark puts its lights on, and puts them off again once she has parked (but not the work light's).
      const q = unit.quad;
      if (!q.lights) continue;
      const driving = g.companions.some((c) => c.quad === q && c.fsm.is('driving'));
      const act = lightsWanted(driving, d.darkness, q.lights.mode, !q.girlLights || g.workLight.job?.vehicle === unit.id);
      if (act) q.lights.set(act);
      q.girlLights = driving ? q.girlLights || act === 'low' : q.girlLights && !act;
    }
    const turn = g.forecast.update(d.hour);
    if (turn) this.turn(turn);
    g.station.update(d.hour, w.temperature, w.kind, w.rain, w.target, w.from, w.mix);
    g.station.setForecast(g.forecast.board(d.hour));
    const board = g.boardUnit ?? g.player.vehicle?.unit ?? null;
    g.vehicleLights.update(g.units, g.camera.position, board, g.lightingUnit ?? null, d.darkness);
  }

  /** The weather turns to another kind (forecast.js): the sky eases across, the rain follows and the day's warmest moves; the girls notice. */
  turn(turn) {
    const g = this.g;
    const seconds = (g.forecastParams.shiftHours * 3600) / g.daylight.p.clockRate;
    const warmth = ((KIND_WARMTH[turn.to] ?? 0) - (KIND_WARMTH[turn.from] ?? 0)) * g.forecastParams.tempShiftScale;
    g.weather.beginShift(turn.to, seconds, { warmth, note: { ...turn } });
    console.info(`The weather turns from ${turn.from} to ${turn.to} (${turn.told ? 'as the board said' : 'not on the board'}) over ${Math.round(seconds)} s`);
  }

  /** Turns the weather now, as it would at its time (the debug panel and the console). Returns false if this kind has nowhere to turn. */
  turnNow() {
    const g = this.g;
    const turn = g.forecast.turnNow(g.weather.kind, g.daylight.hour, g.forecastRandom);
    if (!turn) return false;
    this.turn(turn);
    return true;
  }

  /**
   * The wind (world/wind.js): ticks the day's wind and gusts, leans the hedges and trees with it, swings the hay door's shutter (a bang
   * when it slams, which the girls hear) and now and then blows loose hay out of the loft door.
   */
  updateWind(dt) {
    const g = this.g;
    const wind = g.wind;
    wind.update(dt, g.weather.wind);
    const p = wind.p;
    windUniforms.uWindDir.value = [Math.sin(wind.heading), Math.cos(wind.heading)];
    windUniforms.uWindPush.value = wind.strength;
    windUniforms.uWindTime.value += dt;
    swayMetres.hedge.value = p.swayHedge;
    swayMetres.tree.value = p.swayTree;
    const barn = g.world.props?.barn;
    if (!barn?.shutter) return;
    const bang = g.shutter.update(dt, wind.along(HAY_DOOR_OUT));
    barn.shutter.rotation.y = -g.shutter.angle;
    this.shutterBangCool = Math.max(0, this.shutterBangCool - dt);
    if (bang && this.shutterBangCool <= 0) {
      this.shutterBangCool = BANG_COOLDOWN;
      g.doorAudio.bang(bang.strength);
      g.notice('bang', { x: barn.hayDoor.x + 0.3, y: barn.hayDoor.y + 0.7, z: barn.hayDoor.z }, { key: 'shutter', strength: 0.6 * bang.strength });
    }
    if (wind.hayBlows(HAY_DOOR_OUT)) this.blowHay();
    g.hayBlow.update(dt);
  }

  /** Loose hay lifted off the loft floor and out of the hay door on a strong gust, to land in the yard downwind. */
  blowHay() {
    const g = this.g;
    const door = g.world.props.barn.hayDoor;
    const wind = g.wind;
    const len = Math.max(0.1, Math.hypot(wind.x, wind.z));
    const to = { x: door.x + (wind.x / len) * 8, y: door.y, z: door.z + (wind.z / len) * 8 };
    g.hayBlow.drop({ x: door.x + 0.2, y: door.y + 0.3, z: door.z }, to, g.world.heightAt(to.x, to.z));
  }

  /** Lays the snow shader over the world and over each vehicle (once). The ground and the vehicles are left out of the world's, which they don't share. */
  coatSnow() {
    if (this.snowCoated) return;
    this.snowCoated = true;
    const g = this.g;
    const p = g.snowCoatParams;
    const covered = (x, z) => g.world.covered(x, z);
    g.world.terrain.mesh.userData.snowOwn = true; // the terrain shader draws the ground's own
    for (const unit of g.units) {
      unit.snowUniforms = snowUniforms(p);
      unit.snowLevel = covered(unit.quad.position.x, unit.quad.position.z) ? 0 : topsCover(g.weather.cover, p);
      unit.snowUniforms.uSnowTops.value = unit.snowLevel;
      unit.quad.model.userData.snowOwn = true;
      coatTree(unit.quad.model, unit.snowUniforms, { covered: () => false, p });
    }
    coatTree(g.scene, g.worldSnow.uniforms, { covered, p });
  }

  /** The world's snow follows the ground's cover; a vehicle's settles while it snows, slides off as it moves and thaws indoors (snowCoat.js). */
  updateSnowCoat(dt) {
    const g = this.g;
    const w = g.weather;
    if (!this.snowCoated) {
      if (w.cover <= 0 && w.snow <= 0) return;
      this.coatSnow();
    }
    g.worldSnow.update(dt, w.cover);
    const p = g.snowCoatParams;
    for (const unit of g.units) {
      if (!unit.snowUniforms) continue;
      const q = unit.quad;
      unit.snowLevel = vehicleSnowAfter(unit.snowLevel, dt, { snow: w.snow, cover: w.cover, speed: q.speed, indoors: !!g.world.covered(q.position.x, q.position.z) }, p);
      unit.snowUniforms.uSnowTops.value = unit.snowLevel;
      unit.snowUniforms.uSnowWet.value = g.worldSnow.uniforms.uSnowWet.value;
      unit.snowUniforms.uSnowEdge.value = p.holdEdge;
    }
  }
}

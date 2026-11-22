// The screenshot scenes behind ?shot=start|play|end. Each one plays the real rules forward
// from a fresh world for a fixed number of steps, steered by a simple autopilot, so the frame
// is what a short game really looks like and the same seed always gives the same frame.
import { LEVELS, STEP } from './config.js';
import { EVENT_OVER } from './world.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';

const START_SECONDS = 5;
const PLAY_SECONDS = 18;

/** Steer toward the nearest untaken intel; sneak whenever a guard is close. */
function autopilot(state) {
  const player = state.player;
  let target = null;
  let bestDist = Infinity;
  for (const file of state.intel) {
    if (file.taken) continue;
    const d = Math.hypot(file.x - player.x, file.y - player.y);
    if (d < bestDist) {
      bestDist = d;
      target = file;
    }
  }
  if (target === null) {
    // Everything stolen: head for the exit.
    const exit = LEVELS[state.levelIndex].exit;
    const dx = exit.x + exit.w / 2 - player.x;
    const dy = exit.y + exit.h / 2 - player.y;
    const len = Math.hypot(dx, dy) || 1;
    return { vector: { x: dx / len, y: dy / len }, sneak: false };
  }
  let dx = target.x - player.x;
  let dy = target.y - player.y;
  const len = Math.hypot(dx, dy) || 1;
  dx /= len;
  dy /= len;
  let sneak = false;
  for (const guard of state.guards) {
    if (Math.hypot(guard.x - player.x, guard.y - player.y) < 320) sneak = true;
  }
  return { vector: { x: dx, y: dy }, sneak };
}

/**
 * Set `world` to the named scene (start, play or end; any other name is start) and return the
 * screen to draw over it and the best score to show.
 */
export function stageShot(name, world) {
  world.reset();
  if (name !== 'play' && name !== 'end') {
    for (let index = 0; index < START_SECONDS / STEP; index += 1) world.step(STEP, { x: 0, y: 0 }, false, true);
    return { screen: SCREEN_TITLE, best: 0 };
  }
  if (name === 'end') {
    // Walk the thief straight at the nearest guard, in the open, on one life:
    // spotted, chased and caught, as a hurried player is.
    world.state.lives = 1;
    const guard = world.state.guards[0];
    world.state.player.x = guard.x - 150;
    world.state.player.y = guard.y;
    for (let index = 0; index < 600; index += 1) {
      const events = world.step(STEP, { x: 1, y: 0 }, false, false);
      if (events & EVENT_OVER) break;
    }
    const over = world.state.lives === 0;
    return { screen: over ? SCREEN_OVER : SCREEN_PLAY, best: world.state.score };
  }
  for (let index = 0; index < PLAY_SECONDS / STEP; index += 1) {
    const move = autopilot(world.state);
    const events = world.step(STEP, move.vector, move.sneak, false);
    if (events & EVENT_OVER) break;
    if (world.state.won) break;
  }
  return { screen: world.state.won ? SCREEN_WIN : SCREEN_PLAY, best: world.state.score };
}

// The game's rules and state, with no drawing and no browser in it: the thief, the guards
// with their vision cones, patrols and alerts, the intel to steal and the exit to reach.
// step() advances one fixed step and returns what happened as bit flags, so the caller can
// react without the world knowing about screens or sound. Nothing here allocates after
// createWorld returns.
import { FIELD, GUARD, LEVELS, LEVEL, LIVES, PLAYER, VISION } from './config.js';

export const EVENT_CAUGHT = 1;
export const EVENT_INTEL = 2;
export const EVENT_LEVEL = 4;
export const EVENT_WIN = 8;
export const EVENT_OVER = 16;

export const GUARD_PATROL = 'patrol';
export const GUARD_PAUSE = 'pause';
export const GUARD_INVESTIGATE = 'investigate';
export const GUARD_CHASE = 'chase';
export const GUARD_RETURN = 'return';

function clamp(value, min, max) {
  return value < min ? min : value > max ? max : value;
}

function dist(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}

/** True when the segment a→b crosses rect r (slab test, segment clipped to the rect). */
function segmentHitsRect(ax, ay, bx, by, r) {
  const dx = bx - ax;
  const dy = by - ay;
  let tmin = 0;
  let tmax = 1;
  if (dx === 0) {
    if (ax < r.x || ax > r.x + r.w) return false;
  } else {
    let t1 = (r.x - ax) / dx;
    let t2 = (r.x + r.w - ax) / dx;
    if (t1 > t2) { const t = t1; t1 = t2; t2 = t; }
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return false;
  }
  if (dy === 0) {
    if (ay < r.y || ay > r.y + r.h) return false;
  } else {
    let t1 = (r.y - ay) / dy;
    let t2 = (r.y + r.h - ay) / dy;
    if (t1 > t2) { const t = t1; t1 = t2; t2 = t; }
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return false;
  }
  return true;
}

function circleHitsRect(x, y, radius, r) {
  const cx = clamp(x, r.x, r.x + r.w);
  const cy = clamp(y, r.y, r.y + r.h);
  const dx = x - cx;
  const dy = y - cy;
  return dx * dx + dy * dy < radius * radius;
}

function pointInRect(x, y, r) {
  return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
}

export function createWorld(random) {
  const levelDef = () => LEVELS[state.levelIndex];
  const state = {
    player: { x: 0, y: 0, facing: -Math.PI / 2, sneaking: false, moving: false, inShadow: false },
    guards: [],
    intel: [],
    score: 0,
    lives: LIVES,
    levelIndex: 0,
    level: 1,
    detection: 0,
    alarm: false,
    alarmRaised: false,
    exitOpen: false,
    won: false,
    elapsed: 0,
    levelTime: 0,
    caughtFlash: 0,
  };

  function loadLevel(index) {
    const def = LEVELS[index];
    state.levelIndex = index;
    state.level = index + 1;
    state.player.x = def.playerStart.x;
    state.player.y = def.playerStart.y;
    state.player.facing = -Math.PI / 2;
    state.detection = 0;
    state.alarm = false;
    state.alarmRaised = false;
    state.exitOpen = false;
    state.levelTime = 0;
    state.intel = def.intel.map((spot) => ({ x: spot.x, y: spot.y, taken: false }));
    state.guards = def.guards.map((g) => ({
      x: g.waypoints[0].x,
      y: g.waypoints[0].y,
      facing: 0,
      state: GUARD_PATROL,
      waypointIndex: 1 % g.waypoints.length,
      pauseLeft: 0,
      pause: g.pause,
      waypoints: g.waypoints,
      target: null,
      stareLeft: 0,
      unseenFor: 0,
      scanPhase: random() * Math.PI * 2,
    }));
    // Guards start facing their next waypoint.
    for (const guard of state.guards) {
      const next = guard.waypoints[guard.waypointIndex];
      guard.facing = Math.atan2(next.y - guard.y, next.x - guard.x);
    }
  }

  function reset() {
    state.score = 0;
    state.lives = LIVES;
    state.won = false;
    state.elapsed = 0;
    state.caughtFlash = 0;
    loadLevel(0);
  }

  function moveCircle(body, dx, dy, radius) {
    const walls = levelDef().walls;
    let nx = clamp(body.x + dx, radius, FIELD.width - radius);
    for (const wall of walls) {
      if (circleHitsRect(nx, body.y, radius, wall)) {
        nx = dx > 0 ? wall.x - radius : dx < 0 ? wall.x + wall.w + radius : nx;
      }
    }
    body.x = clamp(nx, radius, FIELD.width - radius);
    let ny = clamp(body.y + dy, radius, FIELD.height - radius);
    for (const wall of walls) {
      if (circleHitsRect(body.x, ny, radius, wall)) {
        ny = dy > 0 ? wall.y - radius : dy < 0 ? wall.y + wall.h + radius : ny;
      }
    }
    body.y = clamp(ny, radius, FIELD.height - radius);
  }

  function hasLineOfSight(ax, ay, bx, by) {
    for (const wall of levelDef().walls) {
      if (segmentHitsRect(ax, ay, bx, by, wall)) return false;
    }
    return true;
  }

  function guardSeesPlayer(guard) {
    const player = state.player;
    const d = dist(guard.x, guard.y, player.x, player.y);
    const range = VISION.range * (player.sneaking ? PLAYER.sneakVisibility : 1);
    if (d > range) return 0;
    const angle = Math.atan2(player.y - guard.y, player.x - guard.x);
    let diff = angle - guard.facing;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    if (Math.abs(diff) > VISION.halfAngle) return 0;
    if (!hasLineOfSight(guard.x, guard.y, player.x, player.y)) return 0;
    // Closer and more centred = seen faster.
    return (1 - (d / range) * 0.6) * (1 - Math.abs(diff) / VISION.halfAngle * 0.4);
  }

  function playerInShadow() {
    for (const zone of levelDef().shadows) {
      if (pointInRect(state.player.x, state.player.y, zone)) return true;
    }
    return false;
  }

  function moveGuardToward(guard, tx, ty, speed, dt) {
    const dx = tx - guard.x;
    const dy = ty - guard.y;
    const d = Math.hypot(dx, dy);
    if (d < 2) return true;
    const step = Math.min(d, speed * dt);
    const nx = (dx / d) * step;
    const ny = (dy / d) * step;
    guard.facing = Math.atan2(dy, dx);
    moveCircle(guard, nx, ny, GUARD.radius);
    return d - step < 2;
  }

  function respawnAfterCaught() {
    const def = levelDef();
    state.player.x = def.playerStart.x;
    state.player.y = def.playerStart.y;
    state.detection = 0;
    state.alarm = false;
    state.caughtFlash = 1.2;
    for (const guard of state.guards) {
      guard.x = guard.waypoints[0].x;
      guard.y = guard.waypoints[0].y;
      guard.state = GUARD_PATROL;
      guard.waypointIndex = 1 % guard.waypoints.length;
      guard.target = null;
      guard.unseenFor = 0;
      const next = guard.waypoints[guard.waypointIndex];
      guard.facing = Math.atan2(next.y - guard.y, next.x - guard.x);
    }
  }

  /**
   * One fixed step. `vector` is the normalised steering {x, y}; `sneaking` holds Shift.
   * With `harmless` set (the title screen's backdrop) guards patrol but never spot the
   * player and nothing is collected.
   */
  function step(dt, vector, sneaking, harmless) {
    let events = 0;
    state.elapsed += dt;
    state.levelTime += dt;
    if (state.caughtFlash > 0) state.caughtFlash = Math.max(0, state.caughtFlash - dt);

    const player = state.player;
    const speed = sneaking ? PLAYER.sneakSpeed : PLAYER.walkSpeed;
    const moving = vector.x !== 0 || vector.y !== 0;
    player.moving = moving;
    player.sneaking = sneaking && moving;
    if (moving) {
      player.facing = Math.atan2(vector.y, vector.x);
      moveCircle(player, vector.x * speed * dt, vector.y * speed * dt, PLAYER.radius);
    }
    player.inShadow = playerInShadow();

    // Intel pickup.
    if (!harmless) {
      for (const file of state.intel) {
        if (!file.taken && dist(player.x, player.y, file.x, file.y) < PLAYER.radius + 16) {
          file.taken = true;
          state.score += 100;
          events |= EVENT_INTEL;
        }
      }
      if (!state.exitOpen && state.intel.every((file) => file.taken)) state.exitOpen = true;
    }

    // Vision: the most alert guard sets the detection rate.
    let bestSeen = 0;
    let seer = null;
    if (!harmless) {
      for (const guard of state.guards) {
        const seen = guardSeesPlayer(guard);
        if (seen > bestSeen) {
          bestSeen = seen;
          seer = guard;
        }
      }
    }
    if (bestSeen > 0) {
      let rate = VISION.fillRate * bestSeen;
      if (player.inShadow) rate *= VISION.shadowFactor;
      state.detection = Math.min(100, state.detection + rate * dt);
      if (seer !== null) {
        seer.target = { x: player.x, y: player.y };
        seer.unseenFor = 0;
      }
    } else {
      state.detection = Math.max(0, state.detection - VISION.drainRate * dt);
    }

    if (!harmless && state.detection >= 100 && !state.alarm) {
      state.alarm = true;
      state.alarmRaised = true;
      for (const guard of state.guards) {
        guard.state = GUARD_CHASE;
        guard.target = { x: player.x, y: player.y };
        guard.unseenFor = 0;
      }
    }

    // Noise: walking (not sneaking) close to a guard draws it over to listen.
    if (!harmless && moving && !sneaking) {
      for (const guard of state.guards) {
        if (guard.state === GUARD_PATROL || guard.state === GUARD_PAUSE) {
          if (dist(guard.x, guard.y, player.x, player.y) < GUARD.hearRadius) {
            guard.state = GUARD_INVESTIGATE;
            guard.target = { x: player.x, y: player.y };
            guard.stareLeft = GUARD.stareTime;
          }
        }
      }
    }

    // Guards.
    for (const guard of state.guards) {
      const seen = harmless ? 0 : guardSeesPlayer(guard);
      if (seen > 0) {
        guard.target = { x: player.x, y: player.y };
        guard.unseenFor = 0;
        if (guard.state !== GUARD_CHASE && state.detection > 55) {
          guard.state = GUARD_INVESTIGATE;
          guard.stareLeft = GUARD.stareTime;
        }
      } else if (guard.state === GUARD_CHASE || guard.state === GUARD_INVESTIGATE) {
        guard.unseenFor += dt;
      }

      if (guard.state === GUARD_PATROL) {
        const target = guard.waypoints[guard.waypointIndex];
        if (moveGuardToward(guard, target.x, target.y, GUARD.patrolSpeed, dt)) {
          guard.state = GUARD_PAUSE;
          guard.pauseLeft = guard.pause;
        }
      } else if (guard.state === GUARD_PAUSE) {
        // Scan the room while waiting: slow sweep of the cone.
        guard.scanPhase += dt * 1.4;
        guard.facing += Math.sin(guard.scanPhase) * 0.012;
        guard.pauseLeft -= dt;
        if (guard.pauseLeft <= 0) {
          guard.waypointIndex = (guard.waypointIndex + 1) % guard.waypoints.length;
          guard.state = GUARD_PATROL;
        }
      } else if (guard.state === GUARD_INVESTIGATE) {
        if (guard.target !== null && moveGuardToward(guard, guard.target.x, guard.target.y, GUARD.investigateSpeed, dt)) {
          guard.stareLeft -= dt;
          guard.scanPhase += dt * 2.2;
          guard.facing += Math.sin(guard.scanPhase) * 0.02;
          if (guard.stareLeft <= 0 || guard.unseenFor > GUARD.chaseMemory) {
            guard.state = GUARD_RETURN;
            guard.target = null;
          }
        }
      } else if (guard.state === GUARD_CHASE) {
        if (seen > 0) moveGuardToward(guard, player.x, player.y, GUARD.chaseSpeed, dt);
        else if (guard.target !== null) moveGuardToward(guard, guard.target.x, guard.target.y, GUARD.chaseSpeed, dt);
        if (guard.unseenFor > GUARD.chaseMemory) {
          guard.state = GUARD_INVESTIGATE;
          guard.stareLeft = GUARD.stareTime;
          if (state.detection < 40) state.alarm = false;
        }
      } else if (guard.state === GUARD_RETURN) {
        // Walk back to the nearest waypoint, then resume the patrol.
        let nearest = guard.waypoints[0];
        let nearestDist = Infinity;
        for (const point of guard.waypoints) {
          const d = dist(guard.x, guard.y, point.x, point.y);
          if (d < nearestDist) {
            nearestDist = d;
            nearest = point;
          }
        }
        if (moveGuardToward(guard, nearest.x, nearest.y, GUARD.patrolSpeed, dt)) {
          guard.waypointIndex = guard.waypoints.indexOf(nearest);
          guard.state = GUARD_PATROL;
        }
      }

      // Caught?
      if (!harmless && dist(guard.x, guard.y, player.x, player.y) < GUARD.catchDistance) {
        state.lives -= 1;
        events |= EVENT_CAUGHT;
        if (state.lives <= 0) {
          events |= EVENT_OVER;
          return events;
        }
        respawnAfterCaught();
        break;
      }
    }

    // Exit: reach it once it is open.
    if (!harmless && state.exitOpen) {
      const exit = levelDef().exit;
      if (pointInRect(player.x, player.y, exit)) {
        state.score += 250;
        if (!state.alarmRaised) state.score += 300; // Ghost bonus: never raised the alarm.
        if (state.levelIndex + 1 >= LEVEL.count) {
          state.won = true;
          events |= EVENT_WIN;
        } else {
          loadLevel(state.levelIndex + 1);
          events |= EVENT_LEVEL;
        }
      }
    }
    return events;
  }

  reset();
  return { state, reset, step, loadLevel };
}

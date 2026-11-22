// Every tuning number and colour in one place. The playfield is a fixed 1280x720 logical area;
// the renderer scales it to the window, so no rule below depends on the screen size.

export const FIELD = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

export const PLAYER = {
  radius: 13,
  walkSpeed: 205,
  sneakSpeed: 105,
  runSpeed: 300,
  /** Detection radius multiplier while sneaking: harder to spot. */
  sneakVisibility: 0.55,
};

export const LIVES = 3;

/** Guard vision: how far a guard sees, and how wide the cone is (half-angle, radians). */
export const VISION = {
  range: 260,
  halfAngle: 0.55,
  /** Detection fills per second when the player is fully visible, at point blank. */
  fillRate: 55,
  /** Detection drains per second when the player is unseen. */
  drainRate: 22,
  /** In a shadow zone the fill rate is multiplied by this. */
  shadowFactor: 0.35,
  /** While the player runs (not sneaking) the fill rate is multiplied by this. */
  runFactor: 1.6,
};

export const GUARD = {
  radius: 14,
  patrolSpeed: 85,
  chaseSpeed: 195,
  investigateSpeed: 130,
  /** Seconds a guard stares at a suspicious spot before giving up. */
  stareTime: 2.2,
  /** Seconds a guard keeps chasing after losing sight. */
  chaseMemory: 2.5,
  /** Catch distance: closer than this and the player is caught. */
  catchDistance: 26,
  /** Running within this radius of a guard makes noise it investigates. */
  hearRadius: 170,
};

export const LEVEL = { count: 3 };

export const PALETTE = {
  backdrop: '#0b0e14',
  floor: '#171c26',
  floorTile: '#1b212e',
  wall: '#3a4358',
  wallTop: '#4b5878',
  shadow: '#0a0d13',
  shadowEdge: '#232a3a',
  player: '#4fc3f7',
  playerSneak: '#2f9fd8',
  guard: '#e5534b',
  guardCalm: '#d97b4f',
  coneCalm: 'rgba(242, 201, 76, 0.20)',
  coneAlert: 'rgba(229, 83, 75, 0.30)',
  intel: '#f2c94c',
  exit: '#43d68a',
  exitLocked: '#5a6b52',
  text: '#eef1f5',
  muted: '#8b93a3',
  panel: '#252b38',
  alarm: '#ff5d5d',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'shadow-vault.best';

/**
 * The three levels. Walls are cover: they block guard sight and movement.
 * Shadows are dark zones where detection fills much slower.
 * Guards patrol their waypoint loops. Intel is what you steal; the exit
 * opens only once every intel file on the level is collected.
 */
export const LEVELS = [
  {
    name: 'Gallery Wing',
    playerStart: { x: 90, y: 640 },
    exit: { x: 1180, y: 80, w: 56, h: 56 },
    intel: [
      { x: 320, y: 140 },
      { x: 640, y: 360 },
      { x: 980, y: 560 },
    ],
    walls: [
      { x: 220, y: 90, w: 30, h: 240 },
      { x: 420, y: 330, w: 240, h: 30 },
      { x: 420, y: 330, w: 30, h: 200 },
      { x: 760, y: 120, w: 30, h: 220 },
      { x: 900, y: 420, w: 260, h: 30 },
      { x: 1000, y: 420, w: 30, h: 180 },
      { x: 150, y: 480, w: 200, h: 30 },
    ],
    shadows: [
      { x: 60, y: 60, w: 180, h: 130 },
      { x: 560, y: 520, w: 220, h: 140 },
      { x: 1020, y: 180, w: 200, h: 140 },
    ],
    guards: [
      { waypoints: [{ x: 500, y: 180 }, { x: 500, y: 560 }, { x: 850, y: 560 }, { x: 850, y: 180 }], pause: 1.2 },
      { waypoints: [{ x: 1080, y: 300 }, { x: 1080, y: 620 }], pause: 1.6 },
    ],
  },
  {
    name: 'Vault Corridor',
    playerStart: { x: 90, y: 90 },
    exit: { x: 1180, y: 640, w: 56, h: 56 },
    intel: [
      { x: 1180, y: 140 },
      { x: 640, y: 200 },
      { x: 300, y: 580 },
    ],
    walls: [
      { x: 260, y: 200, w: 30, h: 260 },
      { x: 260, y: 200, w: 300, h: 30 },
      { x: 700, y: 90, w: 30, h: 200 },
      { x: 700, y: 430, w: 30, h: 200 },
      { x: 880, y: 330, w: 240, h: 30 },
      { x: 480, y: 480, w: 240, h: 30 },
      { x: 1080, y: 300, w: 30, h: 180 },
    ],
    shadows: [
      { x: 60, y: 480, w: 200, h: 150 },
      { x: 820, y: 60, w: 200, h: 130 },
      { x: 560, y: 560, w: 180, h: 120 },
    ],
    guards: [
      { waypoints: [{ x: 400, y: 340 }, { x: 400, y: 620 }, { x: 820, y: 620 }, { x: 820, y: 340 }], pause: 1.0 },
      { waypoints: [{ x: 950, y: 120 }, { x: 1150, y: 120 }, { x: 1150, y: 480 }], pause: 1.4 },
      { waypoints: [{ x: 150, y: 300 }, { x: 150, y: 620 }], pause: 1.8 },
    ],
  },
  {
    name: 'The Grand Vault',
    playerStart: { x: 640, y: 650 },
    exit: { x: 640, y: 60, w: 56, h: 56 },
    intel: [
      { x: 120, y: 120 },
      { x: 1160, y: 120 },
      { x: 1160, y: 600 },
      { x: 120, y: 600 },
    ],
    walls: [
      { x: 300, y: 160, w: 30, h: 200 },
      { x: 950, y: 160, w: 30, h: 200 },
      { x: 300, y: 480, w: 30, h: 120 },
      { x: 950, y: 480, w: 30, h: 120 },
      { x: 480, y: 300, w: 320, h: 30 },
      { x: 480, y: 480, w: 320, h: 30 },
      { x: 640, y: 330, w: 30, h: 150 },
    ],
    shadows: [
      { x: 60, y: 260, w: 180, h: 160 },
      { x: 1040, y: 260, w: 180, h: 160 },
      { x: 480, y: 560, w: 320, h: 110 },
    ],
    guards: [
      { waypoints: [{ x: 200, y: 200 }, { x: 200, y: 520 }, { x: 1080, y: 520 }, { x: 1080, y: 200 }], pause: 0.8 },
      { waypoints: [{ x: 640, y: 180 }, { x: 640, y: 560 }], pause: 1.2 },
      { waypoints: [{ x: 400, y: 420 }, { x: 880, y: 420 }], pause: 1.0 },
      { waypoints: [{ x: 1150, y: 300 }, { x: 950, y: 300 }], pause: 1.5 },
    ],
  },
];

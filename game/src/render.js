// Drawing only: the world's state and the current screen in, pixels out. The 1280x720 playfield
// is scaled to fit the window and centred, the margin filled with the backdrop colour. Flat
// shapes and canvas text for the HUD and the panels. Text that holds a number is rebuilt only
// when the number changes, so a frame allocates nothing.
import { FIELD, FONT, GUARD, LIVES, LEVELS, PALETTE, PLAYER, VISION } from './config.js';
import { GUARD_CHASE, GUARD_INVESTIGATE } from './world.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_WIN = 'win';

/** The panel's width; its height grows with its lines: room for the title, the lines and the prompt. */
const PANEL = { width: 640, top: 134, line: 34, bottom: 70 };

function cachedLabel(prefix) {
  let value = -1;
  let text = '';
  return function label(next) {
    if (next !== value) {
      value = next;
      text = prefix + next;
    }
    return text;
  };
}

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };
  const scoreLabel = cachedLabel('Score ');
  const bestLabel = cachedLabel('Best ');
  const finalLabel = cachedLabel('Score ');

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / FIELD.width, height / FIELD.height);
    view.x = (width - FIELD.width * view.scale) / 2;
    view.y = (height - FIELD.height * view.scale) / 2;
  }

  const fonts = new Map();
  function text(value, x, y, size, color, align) {
    if (!fonts.has(size)) fonts.set(size, `${size}px ${FONT}`);
    context.font = fonts.get(size);
    context.fillStyle = color;
    context.textAlign = align;
    context.fillText(value, x, y);
  }

  function drawCone(guard, alert) {
    context.beginPath();
    context.moveTo(guard.x, guard.y);
    context.arc(guard.x, guard.y, VISION.range, guard.facing - VISION.halfAngle, guard.facing + VISION.halfAngle);
    context.closePath();
    context.fillStyle = alert ? PALETTE.coneAlert : PALETTE.coneCalm;
    context.fill();
  }

  function drawField(state) {
    const def = LEVELS[state.levelIndex];
    context.fillStyle = PALETTE.floor;
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    // Floor tiles.
    context.fillStyle = PALETTE.floorTile;
    for (let x = 0; x < FIELD.width; x += 80) {
      for (let y = 0; y < FIELD.height; y += 80) {
        if (((x + y) / 80) % 2 === 0) context.fillRect(x, y, 80, 80);
      }
    }
    // Shadow zones: dark cover where detection fills slowly.
    for (const zone of def.shadows) {
      context.fillStyle = PALETTE.shadow;
      context.fillRect(zone.x, zone.y, zone.w, zone.h);
      context.strokeStyle = PALETTE.shadowEdge;
      context.lineWidth = 2;
      context.strokeRect(zone.x, zone.y, zone.w, zone.h);
    }
    // Patrol routes, faint, so a patient player can learn them.
    context.strokeStyle = 'rgba(238, 241, 245, 0.10)';
    context.setLineDash([4, 8]);
    context.lineWidth = 2;
    for (const guard of state.guards) {
      context.beginPath();
      guard.waypoints.forEach((point, index) => {
        if (index === 0) context.moveTo(point.x, point.y);
        else context.lineTo(point.x, point.y);
      });
      context.closePath();
      context.stroke();
    }
    context.setLineDash([]);
    // Walls: cover that blocks sight and movement.
    for (const wall of def.walls) {
      context.fillStyle = PALETTE.wall;
      context.fillRect(wall.x, wall.y, wall.w, wall.h);
      context.fillStyle = PALETTE.wallTop;
      context.fillRect(wall.x, wall.y, wall.w, 6);
    }
    // Exit: green when open, dull while the intel is still out there.
    const exit = def.exit;
    context.fillStyle = state.exitOpen ? PALETTE.exit : PALETTE.exitLocked;
    context.fillRect(exit.x, exit.y, exit.w, exit.h);
    context.fillStyle = PALETTE.text;
    context.font = `bold 15px ${FONT}`;
    context.textAlign = 'center';
    context.fillText(state.exitOpen ? 'EXIT' : 'LOCKED', exit.x + exit.w / 2, exit.y + exit.h / 2 + 5);
    // Intel files.
    for (const file of state.intel) {
      if (file.taken) continue;
      const pulse = 1 + Math.sin(state.elapsed * 4 + file.x) * 0.12;
      context.save();
      context.translate(file.x, file.y);
      context.rotate(Math.PI / 4);
      context.scale(pulse, pulse);
      context.fillStyle = PALETTE.intel;
      context.fillRect(-9, -9, 18, 18);
      context.restore();
    }
    // Vision cones, then the guards themselves.
    for (const guard of state.guards) {
      drawCone(guard, guard.state === GUARD_CHASE || guard.state === GUARD_INVESTIGATE);
    }
    for (const guard of state.guards) {
      const alert = guard.state === GUARD_CHASE;
      const suspicious = guard.state === GUARD_INVESTIGATE;
      context.fillStyle = alert ? PALETTE.guard : PALETTE.guardCalm;
      context.beginPath();
      context.arc(guard.x, guard.y, GUARD.radius, 0, Math.PI * 2);
      context.fill();
      // Facing tick.
      context.strokeStyle = PALETTE.text;
      context.lineWidth = 3;
      context.beginPath();
      context.moveTo(guard.x, guard.y);
      context.lineTo(guard.x + Math.cos(guard.facing) * (GUARD.radius + 8), guard.y + Math.sin(guard.facing) * (GUARD.radius + 8));
      context.stroke();
      if (alert || suspicious) {
        context.font = `bold 22px ${FONT}`;
        context.fillStyle = alert ? PALETTE.alarm : PALETTE.intel;
        context.textAlign = 'center';
        context.fillText(alert ? '!' : '?', guard.x, guard.y - GUARD.radius - 8);
      }
    }
    // The thief.
    const player = state.player;
    if (state.caughtFlash === 0 || Math.floor(state.caughtFlash * 10) % 2 === 1) {
      if (player.inShadow) {
        context.strokeStyle = PALETTE.playerSneak;
        context.lineWidth = 2;
        context.beginPath();
        context.arc(player.x, player.y, PLAYER.radius + 6, 0, Math.PI * 2);
        context.stroke();
      }
      context.fillStyle = player.sneaking ? PALETTE.playerSneak : PALETTE.player;
      context.beginPath();
      context.arc(player.x, player.y, PLAYER.radius, 0, Math.PI * 2);
      context.fill();
      context.strokeStyle = PALETTE.text;
      context.lineWidth = 3;
      context.beginPath();
      context.moveTo(player.x, player.y);
      context.lineTo(player.x + Math.cos(player.facing) * (PLAYER.radius + 7), player.y + Math.sin(player.facing) * (PLAYER.radius + 7));
      context.stroke();
    }
  }

  function drawHud(state) {
    const def = LEVELS[state.levelIndex];
    const intelGot = state.intel.filter((file) => file.taken).length;
    context.textBaseline = 'top';
    text(scoreLabel(state.score), 24, 18, 26, PALETTE.text, 'left');
    text(`${def.name}  ·  Intel ${intelGot}/${state.intel.length}`, FIELD.width / 2, 18, 26, PALETTE.text, 'center');
    const firstLife = FIELD.width - 24 - LIVES * 28;
    text('Lives', firstLife - 12, 18, 26, PALETTE.text, 'right');
    for (let life = 0; life < LIVES; life += 1) {
      context.fillStyle = life < state.lives ? PALETTE.player : PALETTE.wall;
      context.beginPath();
      context.arc(firstLife + life * 28 + 10, 30, 10, 0, Math.PI * 2);
      context.fill();
    }
    // Detection meter.
    const barW = 280;
    const barX = (FIELD.width - barW) / 2;
    const barY = 56;
    context.fillStyle = PALETTE.panel;
    context.fillRect(barX - 2, barY - 2, barW + 4, 20);
    const ratio = state.detection / 100;
    context.fillStyle = ratio < 0.55 ? PALETTE.intel : ratio < 0.85 ? '#e8862e' : PALETTE.alarm;
    context.fillRect(barX, barY, barW * ratio, 16);
    const label = state.alarm ? 'ALARM — RUN!' : state.detection > 55 ? 'SPOTTED!' : state.detection > 0 ? 'SUSPICION RISING' : 'UNSEEN';
    text(label, FIELD.width / 2, 82, 18, state.detection > 55 ? PALETTE.alarm : PALETTE.muted, 'center');
    if (state.alarm) {
      context.fillStyle = 'rgba(229, 83, 75, 0.12)';
      context.fillRect(0, 0, FIELD.width, FIELD.height);
    }
    text(state.player.sneaking ? 'SNEAKING — slow, quiet, hard to spot' : 'WASD / arrows move · hold Shift to sneak', 24, FIELD.height - 34, 18, PALETTE.muted, 'left');
  }

  function drawPanel(title, lines, prompt) {
    const height = PANEL.top + lines.length * PANEL.line + PANEL.bottom;
    const x = (FIELD.width - PANEL.width) / 2;
    const y = (FIELD.height - height) / 2;
    context.fillStyle = PALETTE.panel;
    context.fillRect(x, y, PANEL.width, height);
    context.textBaseline = 'alphabetic';
    text(title, FIELD.width / 2, y + 78, 48, PALETTE.text, 'center');
    for (let index = 0; index < lines.length; index += 1) {
      text(lines[index], FIELD.width / 2, y + PANEL.top + index * PANEL.line, 22, PALETTE.muted, 'center');
    }
    text(prompt, FIELD.width / 2, y + height - 40, 24, PALETTE.intel, 'center');
  }

  const TITLE_LINES = [
    'Sneak past the guards. Steal every intel file.',
    'Reach the exit unseen — it opens when the last file is yours.',
    'Guards see in cones: walls block their sight, shadows hide you.',
    'Walk makes noise. Hold Shift to sneak. Get caught 3 times and it is over.',
    '',
  ];
  const PAUSED_LINES = ['The guards will wait for you.'];
  const OVER_LINES = ['', ''];
  const WIN_LINES = ['', ''];

  /** Paint one frame: the field, then the HUD or a panel for the screen the game is on. */
  function draw(state, screen, best) {
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = PALETTE.backdrop;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    drawField(state);
    if (screen === SCREEN_TITLE) {
      TITLE_LINES[4] = bestLabel(best);
      drawPanel('Shadow Vault', TITLE_LINES, 'Press Space or click to start');
      return;
    }
    drawHud(state);
    if (screen === SCREEN_PAUSED) drawPanel('Paused', PAUSED_LINES, 'Press P to resume');
    else if (screen === SCREEN_OVER) {
      OVER_LINES[0] = finalLabel(state.score);
      OVER_LINES[1] = bestLabel(best);
      drawPanel('Caught!', OVER_LINES, 'Press Space or click to try again');
    } else if (screen === SCREEN_WIN) {
      WIN_LINES[0] = finalLabel(state.score);
      WIN_LINES[1] = bestLabel(best);
      drawPanel('Clean Getaway!', WIN_LINES, 'Press Space or click to play again');
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw };
}

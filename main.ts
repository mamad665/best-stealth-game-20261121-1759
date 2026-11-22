// Shadow Vault — entrypoint for the make.fun best-stealth-game bounty.
// Node 22, standard library only. The playable game lives in game/ as plain
// static files (game/index.html plus its ES modules, no libraries, no network),
// and this program hands it to the judge: it copies game/ and screenshots/
// next to this file into the output directory and writes dossier.json, the
// summary the judge reads, using the vendored make.fun helper.
//
// Run locally with an override output directory:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

function fail(message: string): never {
  throw new Error(`Shadow Vault entrypoint: ${message}`);
}

function requireEntry(relativePath: string): void {
  if (!existsSync(join(repoRoot, relativePath))) {
    fail(`missing required file ${relativePath}`);
  }
}

function copyTree(source: string, destination: string): void {
  mkdirSync(destination, { recursive: true });
  cpSync(join(repoRoot, source), destination, { recursive: true });
}

function countFiles(directory: string): number {
  let total = 0;
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const full = join(directory, entry.name);
    total += entry.isDirectory() ? countFiles(full) : 1;
  }
  return total;
}

function byteSize(directory: string): number {
  let total = 0;
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const full = join(directory, entry.name);
    total += entry.isDirectory() ? byteSize(full) : statSync(full).size;
  }
  return total;
}

// The game cannot be judged without its entry page, so refuse early instead
// of handing in an empty folder.
requireEntry('game/index.html');
requireEntry('game/src/main.js');

mkdirSync(outDir, { recursive: true });
copyTree('game', join(outDir, 'game'));
if (existsSync(join(repoRoot, 'screenshots'))) {
  copyTree('screenshots', join(outDir, 'screenshots'));
}

// The scorer's own caps (reference/gate.json): text_max_bytes is the only one
// that shapes bytes; the rest refuse an entry the scorer would refuse — more
// than 4 screenshots or one over 256 KiB, more than 993 files in game/ or
// 48 MiB of game files in all, or a path under game/ over 1000 bytes long.
const dossier = buildDossier(outDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
writeFileSync(join(outDir, 'dossier.json'), dossier);

const gameFiles = countFiles(join(outDir, 'game'));
const gameBytes = byteSize(join(outDir, 'game'));
console.log(
  `Shadow Vault packaged: ${gameFiles} game files (${gameBytes} bytes) -> ${outDir}/dossier.json`,
);

import { performance } from 'node:perf_hooks';
import { cpus, platform } from 'node:os';
import { readdir, readFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { createGame, stepGame } from '../src/simulation.ts';
import { DEFAULT_SETTINGS } from '../src/types.ts';

const iterations = 120_000;
const samples = [];
for (let run = 0; run < 6; run++) {
  const state = createGame('duel', { ...DEFAULT_SETTINGS, duration: 3600 });
  state.phase = 'playing';
  const started = performance.now();
  for (let i = 0; i < iterations; i++) {
    stepGame(state, { throttle: 1, steer: Math.sin(i / 90), boost: i % 300 < 150,
      jump: i % 140 < 3, drift: i % 250 < 80 }, DEFAULT_SETTINGS, 1 / 120);
  }
  if (run > 0) samples.push(performance.now() - started);
}
samples.sort((a, b) => a - b);
const median = samples[2];
const assets = [];
for (const name of await readdir(new URL('../dist/assets/', import.meta.url))) {
  const bytes = await readFile(new URL(`../dist/assets/${name}`, import.meta.url));
  assets.push({ name, bytes: bytes.length, gzipBytes: gzipSync(bytes).length });
}
console.log(JSON.stringify({ node: process.version, platform: platform(), cpu: cpus()[0]?.model,
  simulation: { iterations, medianMs: +median.toFixed(2), microsecondsPerStep: +(median * 1000 / iterations).toFixed(3) },
  assets, note: 'Mede CPU da simulação e tamanho do build; não mede FPS, GPU ou controles físicos.' }, null, 2));

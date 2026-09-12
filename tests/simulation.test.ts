import { test } from "node:test";
import assert from "node:assert/strict";
import { createGame, resetPositions, stepGame } from "../src/simulation.ts";
import { DEFAULT_SETTINGS, FIELD, NEUTRAL_INPUT } from "../src/types.ts";
import type { GameState, InputFrame } from "../src/types.ts";

const dt = 1 / 120;
function advance(
  state: GameState,
  seconds: number,
  input: InputFrame = NEUTRAL_INPUT,
) {
  for (let i = 0; i < Math.round(seconds / dt); i++)
    stepGame(state, input, DEFAULT_SETTINGS, dt);
}
function shoot(state: GameState, z: number, x = 0, y = FIELD.ballRadius) {
  state.ball.position = { x, y, z };
  state.ball.velocity = { x: 0, y: 0, z: Math.sign(z) * 20 };
  stepGame(state, NEUTRAL_INPUT, DEFAULT_SETTINGS, dt);
}

test("gol exige bola inteira além da linha e dentro da abertura", () => {
  const state = createGame("training", DEFAULT_SETTINGS);
  shoot(state, -FIELD.halfLength);
  assert.deepEqual(state.score, [0, 0]);
  shoot(state, -FIELD.halfLength - FIELD.ballRadius);
  assert.deepEqual(state.score, [1, 0]);
  assert.equal(state.phase, "goal");
  advance(state, 1);
  assert.deepEqual(
    state.score,
    [1, 0],
    "animação não conta o mesmo gol duas vezes",
  );
  advance(state, 1.1);
  assert.equal(state.phase, "playing");
  assert.equal(state.ball.position.z, 0);
  shoot(state, FIELD.halfLength + FIELD.ballRadius);
  assert.deepEqual(state.score, [1, 1]);

  for (const [x, y] of [
    [FIELD.goalHalfWidth, FIELD.ballRadius],
    [0, FIELD.goalHeight],
  ]) {
    const blocked = createGame("training", DEFAULT_SETTINGS);
    shoot(blocked, -FIELD.halfLength, x, y);
    assert.deepEqual(blocked.score, [0, 0]);
    assert.ok(
      blocked.ball.velocity.z > 0,
      "trave lateral/alta rebate para o campo",
    );
  }
});

test("saída congela relógio, empate inicia gol de ouro e gol encerra", () => {
  const state = createGame("duel", { ...DEFAULT_SETTINGS, duration: 60 });
  advance(state, 3);
  assert.equal(state.phase, "playing");
  assert.equal(state.timeRemaining, 60);
  state.timeRemaining = dt;
  stepGame(state, NEUTRAL_INPUT, DEFAULT_SETTINGS, dt);
  assert.equal(state.overtime, true);
  assert.equal(state.phase, "playing");
  shoot(state, -FIELD.halfLength - FIELD.ballRadius);
  assert.equal(state.phase, "goal");
  advance(state, 2.1);
  assert.equal(state.phase, "finished");
  const snapshot = JSON.stringify(state);
  advance(state, 1);
  assert.equal(JSON.stringify(state), snapshot);
});

test("tempo esgotado encerra vantagem e reposicionar preserva placar", () => {
  const state = createGame("duel", DEFAULT_SETTINGS);
  state.phase = "playing";
  state.score = [2, 1];
  state.timeRemaining = dt;
  stepGame(state, NEUTRAL_INPUT, DEFAULT_SETTINGS, dt);
  assert.equal(state.phase, "finished");
  resetPositions(state);
  assert.deepEqual(state.score, [2, 1]);
  assert.equal(state.timeRemaining, 0);
  assert.equal(state.player.position.z, 20);
});

test("turbo consome e recarrega no duelo, treino mantém reserva ilimitada", () => {
  const duel = createGame("duel", DEFAULT_SETTINGS);
  duel.phase = "playing";
  const boost = { ...NEUTRAL_INPUT, throttle: 1, boost: true };
  advance(duel, 1, boost);
  assert.ok(duel.player.boost < 75 && duel.player.boost > 65);
  const pad = duel.pads[0];
  duel.player.position = { x: pad.x, y: 0.72, z: pad.z };
  duel.player.velocity = { x: 0, y: 0, z: 0 };
  duel.player.boost = 30;
  stepGame(duel, NEUTRAL_INPUT, DEFAULT_SETTINGS, dt);
  assert.equal(duel.player.boost, 60);
  assert.equal(pad.cooldown, 6);
  const training = createGame("training", DEFAULT_SETTINGS);
  advance(training, 4, boost);
  assert.equal(training.player.boost, 100);
});

test("salto usa borda de pressão, permite segundo salto e volta ao chão", () => {
  const state = createGame("training", DEFAULT_SETTINGS);
  const jump = { ...NEUTRAL_INPUT, jump: true };
  advance(state, 0.1, jump);
  assert.equal(state.player.jumpCount, 1);
  assert.ok(state.player.position.y > 0.72);
  stepGame(state, NEUTRAL_INPUT, DEFAULT_SETTINGS, dt);
  stepGame(state, jump, DEFAULT_SETTINGS, dt);
  assert.equal(state.player.jumpCount, 2);
  const speed = state.player.velocity.y;
  stepGame(state, NEUTRAL_INPUT, DEFAULT_SETTINGS, dt);
  stepGame(state, jump, DEFAULT_SETTINGS, dt);
  assert.equal(state.player.jumpCount, 2);
  assert.ok(state.player.velocity.y < speed);
  advance(state, 3);
  assert.equal(state.player.grounded, true);
  assert.equal(state.player.position.y, 0.72);
});

test("simulação prolongada permanece finita e determinística com colisões", () => {
  const a = createGame("training", DEFAULT_SETTINGS),
    b = createGame("training", DEFAULT_SETTINGS);
  for (let i = 0; i < 30_000; i++) {
    const input = {
      throttle: 1,
      steer: Math.sin(i / 90),
      boost: i % 300 < 150,
      jump: i % 140 < 3,
      drift: i % 250 < 80,
    };
    stepGame(a, input, DEFAULT_SETTINGS, dt);
    stepGame(b, input, DEFAULT_SETTINGS, dt);
    for (const body of [a.player, a.ball]) {
      assert.ok(Object.values(body.position).every(Number.isFinite));
      assert.ok(Object.values(body.velocity).every(Number.isFinite));
      assert.ok(Math.abs(body.position.x) <= FIELD.halfWidth);
      assert.ok(body.position.y >= 0);
    }
  }
  assert.deepEqual(a, b);
  const bot = createGame("duel", DEFAULT_SETTINGS);
  advance(bot, 40);
  assert.ok(bot.hits > 0, "bot precisa alcançar a bola");
});

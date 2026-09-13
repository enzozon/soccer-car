import { test } from "node:test";
import assert from "node:assert/strict";
import { createGame, stepGame } from "../src/simulation.ts";
import {
  moveCar,
  CAR_PHYSICS,
  steeringCurvature,
  applyCarImpulse,
} from "../src/car-physics.ts";
import { hitBall, collideCars, moveBall } from "../src/collisions.ts";
import {
  DEFAULT_SETTINGS as settings,
  NEUTRAL_INPUT as idle,
  FIELD,
} from "../src/types.ts";
import type { Car, InputFrame } from "../src/types.ts";
import {
  vec,
  rotate,
  axisAngle,
  UP,
  FORWARD,
  length,
  dot,
} from "../src/math.ts";

const dt = 1 / 120;
const car = () => createGame("training", settings).player;
function drive(body: Car, seconds: number, input: InputFrame = idle) {
  for (let i = 0; i < Math.round(seconds / dt); i++)
    moveCar(body, input, settings, dt, true);
}
const close = (actual: number, expected: number, tolerance = 0.01) =>
  assert.ok(Math.abs(actual - expected) < tolerance, `${actual} ≈ ${expected}`);

test("gravidade, velocidade terminal, frenagem e consumo usam escala em metros", () => {
  const flying = car();
  flying.position = vec(0, 12, 0);
  flying.grounded = false;
  drive(flying, 0.5);
  close(flying.velocity.y, -3.25);
  const ground = car();
  for (let i = 0; i < 1200; i++) {
    ground.position.z = 0;
    moveCar(ground, { ...idle, throttle: 1 }, settings, dt);
  }
  close(length(ground.velocity), 14.1);
  drive(ground, 0.2, { ...idle, throttle: -1 });
  close(length(ground.velocity), 7.1, 0.1);
  const boosted = car();
  for (let i = 0; i < 480; i++) {
    boosted.position.z = 0;
    moveCar(boosted, { ...idle, throttle: 1, boost: true }, settings, dt, true);
  }
  close(length(boosted.velocity), 23);
  assert.equal(boosted.supersonic, true);
  boosted.boost = 100;
  for (let i = 0; i < 120; i++) {
    boosted.position.z = 0;
    moveCar(boosted, { ...idle, boost: true }, settings, dt);
  }
  close(boosted.boost, 66.7);
  assert.ok(
    steeringCurvature(5) > steeringCurvature(20),
    "curvas abrem em alta velocidade",
  );
});

test("salto variável, reserva de segundo salto e expiração da janela", () => {
  const peaks = [1, 24].map((hold) => {
    const body = car();
    let peak = 0;
    for (let i = 0; i < 300; i++) {
      moveCar(body, { ...idle, jump: i < hold }, settings, dt);
      peak = Math.max(peak, body.position.y);
    }
    close(body.position.y, CAR_PHYSICS.restHeight);
    return peak;
  });
  assert.ok(peaks[0] > 0.9 && peaks[0] < 1.15);
  assert.ok(peaks[1] > 2.35 && peaks[1] < 2.65);
  const body = car();
  body.position.y = 12;
  body.grounded = false;
  body.jumpCount = 1;
  body.jumpTime = 1.6;
  drive(body, dt, { ...idle, jump: true });
  assert.equal(body.jumpCount, 1, "segundo salto expirado não cria impulso");
  assert.ok(body.velocity.y < 0);
});

test("flip frontal e lateral alteram orientação, impulso e consomem reserva", () => {
  for (const direction of [
    { pitch: -1, yaw: 0 },
    { pitch: 0, yaw: 1 },
  ]) {
    const body = car();
    drive(body, 0.1, { ...idle, jump: true });
    drive(body, dt);
    const before = { ...body.velocity };
    drive(body, dt, { ...idle, ...direction, jump: true });
    assert.equal(body.jumpCount, 2);
    assert.ok(body.dodgeTime > 0);
    if (direction.pitch) assert.ok(body.velocity.z < before.z - 4.8);
    else assert.ok(body.velocity.x > before.x + 4.8);
    drive(body, 0.15, { ...idle, ...direction });
    assert.ok(
      dot(rotate(body.orientation, UP), UP) < 0.8,
      "carro gira no eixo do flip",
    );
    close(Math.hypot(...Object.values(body.orientation)), 1, 1e-9);
  }
});

test("turbo segue o nariz no ar e air roll altera os três eixos", () => {
  const body = car();
  body.position = vec(0, 6, 0);
  body.grounded = false;
  body.orientation = axisAngle(vec(1, 0, 0), Math.PI / 2);
  drive(body, 0.5, { ...idle, boost: true });
  assert.ok(body.velocity.y > 1.9 && body.position.y > 6.4);
  const rolling = car();
  rolling.position = vec(0, 12, 0);
  rolling.grounded = false;
  drive(rolling, 0.3, { ...idle, roll: 1 });
  assert.ok(Math.abs(rotate(rolling.orientation, UP).x) > 0.5);
  const pitching = car();
  pitching.position = vec(0, 12, 0);
  pitching.grounded = false;
  drive(pitching, 0.3, { ...idle, pitch: 1, yaw: 0.5 });
  assert.ok(rotate(pitching.orientation, FORWARD).y > 0.3);
});

test("rampa leva às paredes, salto sai da parede e teto devolve reserva", () => {
  const body = car();
  body.position = vec(34, 0.25, 10);
  body.orientation = axisAngle(UP, -Math.PI / 2);
  body.velocity = vec(14, 0, 0);
  drive(body, 0.8, { ...idle, throttle: 1, boost: true });
  assert.equal(body.grounded, true);
  assert.ok(body.position.y > 7);
  assert.ok(body.surfaceNormal.x < -0.99);
  assert.ok(rotate(body.orientation, FORWARD).y > 0.99);
  const wall = structuredClone(body);
  drive(wall, dt, { ...idle, jump: true });
  assert.equal(wall.grounded, false);
  assert.ok(wall.velocity.x < -2.9);
  drive(body, 1, { ...idle, throttle: 1, boost: true });
  assert.equal(body.grounded, false);
  assert.ok(body.position.y > 19);
  assert.ok(rotate(body.orientation, UP).y < -0.99);
  assert.equal(body.jumpCount, 0);
  drive(body, dt, { ...idle, jump: true, pitch: -1 });
  assert.equal(body.jumpCount, 2, "queda do teto mantém um dodge disponível");
});

test("bola colide com caixa orientada, rebate e ganha giro no contato", () => {
  const state = createGame("training", settings),
    body = state.player;
  body.position = vec(0, 8, 0);
  body.orientation = axisAngle(vec(0, 0, 1), Math.PI / 2);
  state.ball.position = vec(-1, 8, 0);
  state.ball.velocity = vec(10, 2, 0);
  hitBall(state, body);
  assert.equal(state.hits, 1);
  assert.ok(state.ball.velocity.x < 0);
  assert.ok(body.velocity.x > 0);
  assert.ok(length(state.ball.angularVelocity) > 0);
  state.ball.position = vec(0, 8, -2);
  state.ball.velocity = vec(0, 0, 0);
  const before = state.hits;
  hitBall(state, body);
  assert.equal(state.hits, before);
  const other = car();
  other.position = vec(0, 8.2, 0);
  other.velocity = vec(0, -5, 0);
  const oldY = body.position.y;
  collideCars(body, other);
  assert.notEqual(
    body.position.y,
    oldY,
    "colisão entre carros também funciona no eixo vertical",
  );
});

test("bola respeita limite, gravidade, quique e bola alta prolonga o relógio zerado", () => {
  const state = createGame("duel", settings);
  state.phase = "playing";
  state.score = [1, 0];
  state.timeRemaining = dt;
  state.ball.position = vec(0, 6, 0);
  state.ball.velocity = vec();
  stepGame(state, idle, settings, dt);
  assert.equal(state.phase, "playing");
  close(state.ball.velocity.y, -6.5 * dt, 0.0001);
  state.ball.position = vec(0, FIELD.ballRadius + 0.01, 0);
  state.ball.velocity = vec(0, -10, 0);
  moveBall(state, dt);
  assert.ok(state.ball.velocity.y > 5.9 && state.ball.velocity.y < 6.1);
  state.ball.position = vec(0, FIELD.ballRadius, 0);
  state.ball.velocity = vec();
  stepGame(state, idle, settings, dt);
  assert.equal(state.phase, "finished");
  state.ball.position = vec(0, 8, 0);
  state.ball.velocity = vec(200, 0, 0);
  moveBall(state, dt);
  assert.ok(length(state.ball.velocity) <= 60);
});

test("caixa do carro colide com poste antes de seu centro cruzar a linha", () => {
  const body = car();
  body.position = vec(FIELD.goalHalfWidth - 0.05, 0.25, FIELD.halfLength - 0.9);
  body.orientation = axisAngle(UP, Math.PI);
  body.velocity = vec(0, 0, 10);
  drive(body, 0.15, { ...idle, throttle: 1 });
  assert.ok(body.position.z < FIELD.halfLength - 0.5);
  assert.ok(body.velocity.z < 2, "poste para o carro");
});

test("impulso externo lanca o carro sem aderencia apagar velocidade vertical", () => {
  const body = car();
  applyCarImpulse(body, vec(0, 900, 0), vec());
  drive(body, dt);
  assert.equal(body.grounded, false);
  assert.ok(body.position.y > 0.28 && body.velocity.y > 4.9);
});

test("flips completam aterrissagem sem ultrapassar limite angular", () => {
  for (const direction of [
    { pitch: -1, yaw: 0 },
    { pitch: 1, yaw: 0 },
    { pitch: 0, yaw: 1 },
  ]) {
    const body = car();
    drive(body, 0.1, { ...idle, jump: true });
    drive(body, dt);
    drive(body, dt, { ...idle, ...direction, jump: true });
    for (let i = 0; i < 300; i++) {
      moveCar(body, idle, settings, dt);
      assert.ok(length(body.angularVelocity) <= 5.500001);
    }
    assert.equal(body.grounded, true);
    close(body.position.y, CAR_PHYSICS.restHeight);
    assert.ok(dot(rotate(body.orientation, UP), UP) > 0.99);
  }
});

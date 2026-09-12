import { CAR_MODELS, FIELD } from "./types.ts";
import type {
  Car,
  GameMode,
  GameState,
  InputFrame,
  Settings,
  Vec3,
} from "./types.ts";

const CAR_HEIGHT = 0.72;
const GRAVITY = 24;
const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));
const angle = (value: number) => Math.atan2(Math.sin(value), Math.cos(value));
const vector = (x = 0, y = 0, z = 0): Vec3 => ({ x, y, z });

function createCar(z: number, heading: number): Car {
  return {
    position: vector(0, CAR_HEIGHT, z),
    velocity: vector(),
    heading,
    boost: 100,
    grounded: true,
    boosting: false,
    jumpCount: 0,
    jumpHeld: false,
  };
}
export function resetPositions(state: GameState): void {
  state.player = createCar(20, 0);
  state.opponent = createCar(-20, Math.PI);
  state.ball = { position: vector(0, FIELD.ballRadius, 0), velocity: vector() };
  for (const pad of state.pads) pad.cooldown = 0;
}
export function createGame(mode: GameMode, settings: Settings): GameState {
  return {
    player: createCar(20, 0),
    opponent: createCar(-20, Math.PI),
    ball: { position: vector(0, FIELD.ballRadius, 0), velocity: vector() },
    pads: [-24, 0, 24].flatMap((z) =>
      [-16, 16].map((x) => ({ x, z, cooldown: 0 })),
    ),
    mode,
    phase: mode === "training" ? "playing" : "kickoff",
    phaseTime: mode === "training" ? 0 : 3,
    timeRemaining: Number.isFinite(settings.duration)
      ? Math.max(1, settings.duration)
      : 180,
    score: [0, 0],
    elapsed: 0,
    overtime: false,
    lastGoal: null,
    hits: 0,
  };
}
function limitSpeed(velocity: Vec3, maximum: number): void {
  const speed = Math.hypot(velocity.x, velocity.y, velocity.z);
  if (speed > maximum) {
    const scale = maximum / speed;
    velocity.x *= scale;
    velocity.y *= scale;
    velocity.z *= scale;
  }
}
function moveCar(
  car: Car,
  input: InputFrame,
  settings: Settings,
  dt: number,
  unlimited: boolean,
): void {
  const model = CAR_MODELS[settings.model];
  const throttle = Number.isFinite(input.throttle)
    ? clamp(input.throttle, -1, 1)
    : 0;
  const steer = Number.isFinite(input.steer) ? clamp(input.steer, -1, 1) : 0;
  const speed = Math.hypot(car.velocity.x, car.velocity.z);
  const forwardSpeed =
    car.velocity.x * Math.sin(car.heading) -
    car.velocity.z * Math.cos(car.heading);
  const reversing = forwardSpeed < -0.5 ? -1 : 1;
  car.heading = angle(
    car.heading +
      steer *
        model.turnRate *
        reversing *
        clamp(speed / 7, 0.18, 1) *
        (input.drift ? 1.35 : 1) *
        (car.grounded ? 1 : 0.5) *
        dt,
  );
  const fx = Math.sin(car.heading),
    fz = -Math.cos(car.heading);
  const rx = Math.cos(car.heading),
    rz = Math.sin(car.heading);
  const lateralSpeed = car.velocity.x * rx + car.velocity.z * rz;
  const grip =
    1 - Math.exp(-(car.grounded ? (input.drift ? 2.2 : 11) : 0.3) * dt);
  car.velocity.x -= rx * lateralSpeed * grip;
  car.velocity.z -= rz * lateralSpeed * grip;
  car.boosting = input.boost && throttle >= 0 && (unlimited || car.boost > 0);
  const acceleration =
    throttle * model.acceleration * (car.grounded ? 1 : 0.18) +
    (car.boosting ? 37 * (car.grounded ? 1 : 0.7) : 0);
  car.velocity.x += fx * acceleration * dt;
  car.velocity.z += fz * acceleration * dt;
  car.boost = unlimited
    ? 100
    : Math.max(0, car.boost - (car.boosting ? 30 * dt : 0));
  const drag = Math.exp(
    -(car.grounded ? (Math.abs(throttle) < 0.01 ? 1.8 : 0.65) : 0.05) * dt,
  );
  car.velocity.x *= drag;
  car.velocity.z *= drag;
  const maxSpeed = car.boosting ? 40 : model.maxSpeed;
  const horizontalSpeed = Math.hypot(car.velocity.x, car.velocity.z);
  if (horizontalSpeed > maxSpeed) {
    const scale =
      (horizontalSpeed - Math.min(horizontalSpeed - maxSpeed, 18 * dt)) /
      horizontalSpeed;
    car.velocity.x *= scale;
    car.velocity.z *= scale;
  }
  if (input.jump && !car.jumpHeld && car.jumpCount < 2) {
    car.velocity.y =
      car.jumpCount === 0 ? 10.5 : Math.max(0, car.velocity.y) + 7.5;
    if (car.jumpCount === 1) {
      car.velocity.x += fx * throttle * 6;
      car.velocity.z += fz * throttle * 6;
    }
    car.jumpCount++;
    car.grounded = false;
  }
  car.jumpHeld = input.jump;
  car.velocity.y -= GRAVITY * dt;
  limitSpeed(car.velocity, 45);
  car.position.x += car.velocity.x * dt;
  car.position.y += car.velocity.y * dt;
  car.position.z += car.velocity.z * dt;
  if (car.position.y <= CAR_HEIGHT) {
    car.position.y = CAR_HEIGHT;
    car.velocity.y = 0;
    car.grounded = true;
    car.jumpCount = 0;
  }
  if (car.position.y > FIELD.wallHeight - CAR_HEIGHT) {
    car.position.y = FIELD.wallHeight - CAR_HEIGHT;
    car.velocity.y = Math.min(0, car.velocity.y);
  }
  // ponytail: carros ficam no campo; wall riding exige orientação e colisores 3D.
  for (const axis of ["x", "z"] as const) {
    const boundary =
      (axis === "x" ? FIELD.halfWidth : FIELD.halfLength) - FIELD.carRadius;
    if (Math.abs(car.position[axis]) > boundary) {
      car.position[axis] = Math.sign(car.position[axis]) * boundary;
      car.velocity[axis] *= -0.3;
    }
  }
}
function botInput(state: GameState, settings: Settings): InputFrame {
  const bot = state.opponent,
    ball = state.ball.position;
  const goalDx = -ball.x,
    goalDz = FIELD.halfLength - ball.z;
  const goalDistance = Math.max(1, Math.hypot(goalDx, goalDz));
  const ux = goalDx / goalDistance,
    uz = goalDz / goalDistance;
  const behind =
    (bot.position.x - ball.x) * ux + (bot.position.z - ball.z) * uz;
  const distance = Math.hypot(ball.x - bot.position.x, ball.z - bot.position.z);
  const approaching = behind < -1 && distance < 8;
  const tx = ball.x + ux * (approaching ? 2 : -5),
    tz = ball.z + uz * (approaching ? 2 : -5);
  const desired = Math.atan2(tx - bot.position.x, -(tz - bot.position.z));
  const error = angle(desired - bot.heading);
  const skill =
    settings.difficulty === "easy"
      ? 0.65
      : settings.difficulty === "hard"
        ? 1
        : 0.85;
  return {
    throttle: skill * (Math.abs(error) > 1.4 ? 0.42 : 1),
    steer: clamp(error * 1.8, -1, 1),
    boost:
      settings.difficulty !== "easy" &&
      Math.abs(error) < 0.3 &&
      distance > (settings.difficulty === "hard" ? 8 : 15),
    jump:
      settings.difficulty !== "easy" &&
      ball.y > 2.4 &&
      ball.y < 7 &&
      distance < 4.5 &&
      bot.grounded,
    drift: Math.abs(error) > 1.6,
  };
}
function hitBall(state: GameState, car: Car): void {
  const ball = state.ball;
  const dx = ball.position.x - car.position.x,
    dy = ball.position.y - car.position.y,
    dz = ball.position.z - car.position.z;
  const distance = Math.hypot(dx, dy, dz),
    radius = FIELD.ballRadius + FIELD.carRadius;
  if (distance >= radius) return;
  const nx = distance > 0.001 ? dx / distance : Math.sin(car.heading);
  const ny = distance > 0.001 ? dy / distance : 0.2;
  const nz = distance > 0.001 ? dz / distance : -Math.cos(car.heading);
  const penetration = radius - distance;
  ball.position.x += nx * penetration;
  ball.position.y += ny * penetration;
  ball.position.z += nz * penetration;
  const relative =
    (ball.velocity.x - car.velocity.x) * nx +
    (ball.velocity.y - car.velocity.y) * ny +
    (ball.velocity.z - car.velocity.z) * nz;
  if (relative < 0) {
    const impulse = -relative * 1.75;
    ball.velocity.x += nx * impulse;
    ball.velocity.y += ny * impulse;
    ball.velocity.z += nz * impulse;
    car.velocity.x -= nx * impulse * 0.12;
    car.velocity.z -= nz * impulse * 0.12;
    if (relative < -0.3) state.hits++;
  }
}
function collideCars(a: Car, b: Car): void {
  if (Math.abs(a.position.y - b.position.y) > 1.5) return;
  const dx = b.position.x - a.position.x,
    dz = b.position.z - a.position.z;
  const distance = Math.hypot(dx, dz);
  if (distance >= FIELD.carRadius * 2) return;
  const nx = distance > 0.001 ? dx / distance : 1,
    nz = distance > 0.001 ? dz / distance : 0;
  const correction = (FIELD.carRadius * 2 - distance) / 2;
  a.position.x -= nx * correction;
  a.position.z -= nz * correction;
  b.position.x += nx * correction;
  b.position.z += nz * correction;
  const relative =
    (b.velocity.x - a.velocity.x) * nx + (b.velocity.z - a.velocity.z) * nz;
  if (relative < 0) {
    a.velocity.x += nx * relative * 0.65;
    a.velocity.z += nz * relative * 0.65;
    b.velocity.x -= nx * relative * 0.65;
    b.velocity.z -= nz * relative * 0.65;
  }
}
function moveBall(state: GameState, dt: number): void {
  const { ball } = state;
  ball.velocity.y -= 18 * dt;
  const friction = Math.exp(
    -(ball.position.y <= FIELD.ballRadius + 0.03 ? 0.22 : 0.035) * dt,
  );
  ball.velocity.x *= friction;
  ball.velocity.z *= friction;
  limitSpeed(ball.velocity, 48);
  ball.position.x += ball.velocity.x * dt;
  ball.position.y += ball.velocity.y * dt;
  ball.position.z += ball.velocity.z * dt;
  hitBall(state, state.player);
  if (state.mode === "duel") hitBall(state, state.opponent);
  limitSpeed(ball.velocity, 48);
  const radius = FIELD.ballRadius;
  if (ball.position.y < radius) {
    ball.position.y = radius;
    ball.velocity.y = Math.abs(ball.velocity.y) * 0.7;
    if (ball.velocity.y < 0.6) ball.velocity.y = 0;
  }
  if (ball.position.y > FIELD.wallHeight - radius) {
    ball.position.y = FIELD.wallHeight - radius;
    ball.velocity.y = -Math.abs(ball.velocity.y) * 0.75;
  }
  if (Math.abs(ball.position.x) > FIELD.halfWidth - radius) {
    const side = Math.sign(ball.position.x);
    ball.position.x = side * (FIELD.halfWidth - radius);
    ball.velocity.x = -side * Math.abs(ball.velocity.x) * 0.8;
  }
  const fitsGoal =
    Math.abs(ball.position.x) <= FIELD.goalHalfWidth - radius &&
    ball.position.y <= FIELD.goalHeight - radius;
  if (Math.abs(ball.position.z) > FIELD.halfLength - radius && !fitsGoal) {
    const side = Math.sign(ball.position.z);
    ball.position.z = side * (FIELD.halfLength - radius);
    ball.velocity.z = -side * Math.abs(ball.velocity.z) * 0.8;
  }
  if (fitsGoal && Math.abs(ball.position.z) >= FIELD.halfLength + radius) {
    const scorer = ball.position.z < 0 ? 0 : 1;
    state.score[scorer]++;
    state.lastGoal = scorer;
    state.phase = "goal";
    state.phaseTime = 2;
    state.player.boosting = false;
    state.opponent.boosting = false;
  }
}
export function stepGame(
  state: GameState,
  input: InputFrame,
  settings: Settings,
  dt: number,
): void {
  if (!Number.isFinite(dt) || dt <= 0 || state.phase === "finished") return;
  dt = Math.min(dt, 1 / 30);
  state.elapsed += dt;
  if (state.phase !== "playing") {
    state.phaseTime = Math.max(0, state.phaseTime - dt);
    if (state.phaseTime > 0.000001) return;
    if (state.phase === "goal") {
      if (
        state.mode === "duel" &&
        (state.overtime ||
          (state.timeRemaining <= 0 && state.score[0] !== state.score[1]))
      ) {
        state.phase = "finished";
        return;
      }
      resetPositions(state);
      state.phase = state.mode === "training" ? "playing" : "kickoff";
      state.phaseTime = state.mode === "training" ? 0 : 3;
      return;
    }
    state.phase = "playing";
    state.phaseTime = 0;
    return;
  }
  moveCar(state.player, input, settings, dt, state.mode === "training");
  if (state.mode === "duel") {
    moveCar(
      state.opponent,
      botInput(state, settings),
      { ...settings, model: "pulse" },
      dt,
      false,
    );
    collideCars(state.player, state.opponent);
  }
  for (const pad of state.pads) {
    pad.cooldown = Math.max(0, pad.cooldown - dt);
    if (pad.cooldown > 0) continue;
    for (const car of state.mode === "duel"
      ? [state.player, state.opponent]
      : [state.player]) {
      if (
        car.boost < 100 &&
        car.position.y < 2 &&
        Math.hypot(car.position.x - pad.x, car.position.z - pad.z) < 2.3
      ) {
        car.boost = Math.min(100, car.boost + 30);
        pad.cooldown = 6;
        break;
      }
    }
  }
  if (state.mode === "duel")
    state.timeRemaining = Math.max(0, state.timeRemaining - dt);
  moveBall(state, dt);
  if (state.mode === "duel" && state.timeRemaining <= 0.000001) {
    state.timeRemaining = 0;
    if (state.score[0] === state.score[1]) state.overtime = true;
    else if (state.phase === "playing") state.phase = "finished";
  }
}

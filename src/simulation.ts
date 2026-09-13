import { FIELD } from "./types.ts";
import type {
  Car,
  GameMode,
  GameState,
  InputFrame,
  Settings,
  Vec3,
} from "./types.ts";

import { moveCar, CAR_PHYSICS } from "./car-physics.ts";
import { moveBall, collideCars } from "./collisions.ts";
import { axisAngle, UP } from "./math.ts";
const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));
const angle = (value: number) => Math.atan2(Math.sin(value), Math.cos(value));
const vector = (x = 0, y = 0, z = 0): Vec3 => ({ x, y, z });

function createCar(z: number, heading: number): Car {
  return {
    position: vector(0, CAR_PHYSICS.restHeight, z),
    velocity: vector(),
    heading,
    boost: 100,
    grounded: true,
    boosting: false,
    jumpCount: 0,
    jumpHeld: false,
    orientation: axisAngle(UP, -heading),
    angularVelocity: vector(),
    surfaceNormal: { ...UP },
    jumpTime: -1,
    jumpHoldTime: 0,
    dodgeTime: 0,
    dodgeAxis: vector(),
    contactLock: 0,
    supersonic: false,
  };
}
export function resetPositions(state: GameState): void {
  state.player = createCar(38.4, 0);
  state.opponent = createCar(-38.4, Math.PI);
  state.ball = {
    position: vector(0, FIELD.ballRadius, 0),
    velocity: vector(),
    angularVelocity: vector(),
  };
  for (const pad of state.pads) pad.cooldown = 0;
}
export function createGame(mode: GameMode, settings: Settings): GameState {
  return {
    player: createCar(38.4, 0),
    opponent: createCar(-38.4, Math.PI),
    ball: {
      position: vector(0, FIELD.ballRadius, 0),
      velocity: vector(),
      angularVelocity: vector(),
    },
    pads: [
      ...[-42, -28, -14, 0, 14, 28, 42].flatMap((z) =>
        [-12, 12].map((x) => ({ x, z, cooldown: 0, large: false })),
      ),
      ...[-30, -10, 10, 30].flatMap((z) =>
        [-24, 0, 24].map((x) => ({ x, z, cooldown: 0, large: false })),
      ),
      ...[-36, 36].map((z) => ({ x: 0, z, cooldown: 0, large: false })),
      ...[-42.4, 0, 42.4].flatMap((z) =>
        [-30.72, 30.72].map((x) => ({ x, z, cooldown: 0, large: true })),
      ),
    ],
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
      ball.y > 1.6 &&
      ball.y < 4 &&
      distance < 4.5 &&
      (bot.grounded || (bot.jumpHeld && bot.jumpTime < 0.2)),
    pitch: bot.grounded ? 0 : -Math.sin(bot.orientation.x * 2) * 0.7,
    yaw: 0,
    roll: 0,
    drift: Math.abs(error) > 1.6,
  };
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
        state.timeRemaining <= 0 &&
        state.score[0] !== state.score[1]
      ) {
        state.phase = "finished";
        return;
      }
      if (state.mode === "duel" && state.timeRemaining <= 0)
        state.overtime = true;
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
        car.position.y < (pad.large ? 1.68 : 0.95) &&
        Math.hypot(car.position.x - pad.x, car.position.z - pad.z) <
          (pad.large ? 2.08 : 1.44)
      ) {
        car.boost = Math.min(100, car.boost + (pad.large ? 100 : 12));
        pad.cooldown = pad.large ? 10 : 4;
        break;
      }
    }
  }
  if (state.mode === "duel")
    state.timeRemaining = Math.max(0, state.timeRemaining - dt);
  moveBall(state, dt);
  if (
    state.mode === "duel" &&
    !state.overtime &&
    state.phase === "playing" &&
    state.timeRemaining <= 0.000001 &&
    state.ball.position.y <= FIELD.ballRadius + 0.01
  ) {
    state.timeRemaining = 0;
    if (state.score[0] === state.score[1]) {
      state.overtime = true;
      resetPositions(state);
      state.phase = "kickoff";
      state.phaseTime = 3;
    } else state.phase = "finished";
  }
}

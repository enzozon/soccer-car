import { FIELD } from "./types.ts";
import type { Ball, Car, GameState, Vec3 } from "./types.ts";
import {
  add,
  sub,
  scale,
  dot,
  cross,
  unit,
  length,
  clamp,
  limit,
  vec,
  rotate,
  inverseRotate,
  UP,
  RIGHT,
  FORWARD,
} from "./math.ts";
import { arenaSurfaces, GOAL_FRAME } from "./arena-physics.ts";
import {
  CAR_PHYSICS,
  applyCarImpulse,
  carPointVelocity,
  carSupport,
} from "./car-physics.ts";

export const BALL_PHYSICS = {
  mass: 30,
  restitution: 0.6,
  drag: 0.030562,
  maxSpeed: 60,
  maxSpin: 6,
} as const;

function closestBox(point: Vec3, half: Vec3): Vec3 {
  return vec(
    clamp(point.x, -half.x, half.x),
    clamp(point.y, -half.y, half.y),
    clamp(point.z, -half.z, half.z),
  );
}

export function hitBall(state: GameState, car: Car): void {
  const ball = state.ball,
    radius = FIELD.ballRadius;
  const local = inverseRotate(
    car.orientation,
    sub(ball.position, car.position),
  );
  const closest = closestBox(local, CAR_PHYSICS.halfSize);
  const delta = sub(local, closest),
    distance = length(delta);
  if (distance >= radius) return;
  const normal = rotate(car.orientation, unit(delta, unit(local, FORWARD)));
  const offset = rotate(car.orientation, closest);
  ball.position = add(ball.position, scale(normal, radius - distance));
  const relative = sub(ball.velocity, carPointVelocity(car, offset));
  const speed = dot(relative, normal);
  if (speed >= 0) return;
  const impulse = scale(
    normal,
    (-(1 + BALL_PHYSICS.restitution) * speed) /
      (1 / BALL_PHYSICS.mass + 1 / CAR_PHYSICS.mass),
  );
  ball.velocity = add(ball.velocity, scale(impulse, 1 / BALL_PHYSICS.mass));
  applyCarImpulse(car, scale(impulse, -1), offset);
  ball.angularVelocity = limit(
    add(ball.angularVelocity, scale(cross(normal, relative), 0.15 / radius)),
    BALL_PHYSICS.maxSpin,
  );
  if (speed < -0.3) state.hits++;
}

/** SAT: testa faces e arestas de duas caixas orientadas, inclusive no ar. */
export function collideCars(a: Car, b: Car): void {
  if (length(sub(b.position, a.position)) > 1.7) return;
  const axesA = [RIGHT, UP, FORWARD].map((v) => rotate(a.orientation, v));
  const axesB = [RIGHT, UP, FORWARD].map((v) => rotate(b.orientation, v));
  const axes = [
    ...axesA,
    ...axesB,
    ...axesA.flatMap((x) => axesB.map((y) => cross(x, y))),
  ];
  const delta = sub(b.position, a.position);
  let penetration = Infinity,
    normal = RIGHT;
  for (const axis of axes) {
    if (length(axis) < 1e-6) continue;
    const n = unit(axis),
      distance = dot(delta, n);
    const overlap = carSupport(a, n) + carSupport(b, n) - Math.abs(distance);
    if (overlap <= 0) return;
    if (overlap < penetration) {
      penetration = overlap;
      normal = scale(n, distance < 0 ? -1 : 1);
    }
  }
  a.position = sub(a.position, scale(normal, penetration / 2));
  b.position = add(b.position, scale(normal, penetration / 2));
  const relative = dot(sub(b.velocity, a.velocity), normal);
  if (relative >= 0) return;
  const impulse = scale(normal, -relative * 0.6 * CAR_PHYSICS.mass);
  applyCarImpulse(a, scale(impulse, -1), scale(delta, 0.5));
  applyCarImpulse(b, impulse, scale(delta, -0.5));
}

function bounce(ball: Ball, normal: Vec3, penetration: number): void {
  ball.position = add(ball.position, scale(normal, penetration));
  const incoming = dot(ball.velocity, normal);
  if (incoming >= 0) return;
  const rebound = incoming < -0.2 ? BALL_PHYSICS.restitution : 0;
  const normalDelta = -incoming * (1 + rebound);
  ball.velocity = add(ball.velocity, scale(normal, normalDelta));
  const offset = scale(normal, -FIELD.ballRadius);
  const contactSpeed = add(ball.velocity, cross(ball.angularVelocity, offset));
  const slip = sub(contactSpeed, scale(normal, dot(contactSpeed, normal)));
  const frictionDelta = scale(
    unit(slip),
    -Math.min(length(slip) / 3.5, normalDelta * 0.2),
  );
  ball.velocity = add(ball.velocity, frictionDelta);
  ball.angularVelocity = limit(
    add(
      ball.angularVelocity,
      scale(cross(offset, frictionDelta), 2.5 / FIELD.ballRadius ** 2),
    ),
    BALL_PHYSICS.maxSpin,
  );
}

export function moveBall(state: GameState, dt: number): void {
  const { ball } = state,
    radius = FIELD.ballRadius;
  ball.velocity = limit(
    scale(
      add(ball.velocity, vec(0, -CAR_PHYSICS.gravity * dt, 0)),
      Math.exp(-BALL_PHYSICS.drag * dt),
    ),
    BALL_PHYSICS.maxSpeed,
  );
  ball.position = add(ball.position, scale(ball.velocity, dt));
  hitBall(state, state.player);
  if (state.mode === "duel") hitBall(state, state.opponent);
  for (let pass = 0; pass < 3; pass++) {
    for (const surface of arenaSurfaces(ball.position)) {
      if (surface.distance < radius)
        bounce(ball, surface.normal, radius - surface.distance);
    }
    // As bordas da abertura precisam de volume mesmo quando o centro entrou no gol.
    for (const post of GOAL_FRAME) {
      if (Math.abs(ball.position.z - post.center.z) > radius + 0.12) continue;
      const local = sub(ball.position, post.center),
        delta = sub(local, closestBox(local, post.half));
      const distance = length(delta);
      if (distance < radius)
        bounce(
          ball,
          unit(delta, vec(0, 0, -Math.sign(post.center.z))),
          radius - distance,
        );
    }
  }

  ball.velocity = limit(ball.velocity, BALL_PHYSICS.maxSpeed);
  if (
    Math.abs(ball.position.x) < FIELD.goalHalfWidth - radius &&
    ball.position.y < FIELD.goalHeight - radius &&
    Math.abs(ball.position.z) >= FIELD.halfLength + radius
  ) {
    const scorer = ball.position.z < 0 ? 0 : 1;
    state.score[scorer]++;
    state.lastGoal = scorer;
    state.phase = "goal";
    state.phaseTime = 2;
    state.player.boosting = false;
    state.opponent.boosting = false;
  }
}

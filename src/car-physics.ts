import type { Car, InputFrame, Settings, Vec3 } from "./types.ts";
import {
  add,
  sub,
  scale,
  dot,
  cross,
  unit,
  length,
  tangent,
  clamp,
  limit,
  vec,
  rotate,
  inverseRotate,
  axisAngle,
  multiplyQ,
  fromTo,
  UP,
  FORWARD,
  RIGHT,
} from "./math.ts";
import { arenaSurfaces, GOAL_FRAME } from "./arena-physics.ts";

/** Unidades: metros/s. Fontes e diferenças do solver em docs/FISICA.md. */
export const CAR_PHYSICS = {
  gravity: 6.5,
  maxSpeed: 23,
  throttleSpeed: 14.1,
  supersonic: 22,
  boostGround: 9.91666,
  boostAir: 10.58333,
  boostConsumption: 33.3,
  jumpImpulse: 2.91667,
  jumpHoldAcceleration: 14.6,
  jumpHoldDuration: 0.2,
  dodgeWindow: 1.25,
  dodgeDuration: 0.65,
  dodgeImpulse: 5,
  restHeight: 0.25,
  halfSize: { x: 0.421, y: 0.181, z: 0.59 },
  mass: 180,
} as const;

export function throttleAcceleration(speed: number): number {
  const v = Math.abs(speed);
  return v < 14
    ? 16 - (14.4 * v) / 14
    : v < 14.1
      ? (1.6 * (14.1 - v)) / 0.1
      : 0;
}
export function steeringCurvature(speed: number): number {
  const v = Math.abs(speed) * 100;
  if (v < 500) return (0.0069 - 0.00000584 * v) * 100;
  if (v < 1000) return (0.00561 - 0.00000326 * v) * 100;
  if (v < 1500) return (0.0043 - 0.00000195 * v) * 100;
  if (v < 1750) return (0.003025 - 0.0000011 * v) * 100;
  return Math.max(0.00088, 0.0018 - 0.0000004 * v) * 100;
}
export function carSupport(car: Car, normal: Vec3): number {
  const n = inverseRotate(car.orientation, normal),
    h = CAR_PHYSICS.halfSize;
  return Math.abs(n.x) * h.x + Math.abs(n.y) * h.y + Math.abs(n.z) * h.z;
}
export function carPointVelocity(car: Car, offset: Vec3): Vec3 {
  return add(
    car.velocity,
    cross(rotate(car.orientation, car.angularVelocity), offset),
  );
}
export function applyCarImpulse(car: Car, impulse: Vec3, offset: Vec3): void {
  car.velocity = limit(
    add(car.velocity, scale(impulse, 1 / CAR_PHYSICS.mass)),
    CAR_PHYSICS.maxSpeed,
  );
  if (car.grounded && dot(car.velocity, car.surfaceNormal) > 0.15) {
    car.grounded = false;
    car.contactLock = 0.04;
  }
  const torque = inverseRotate(car.orientation, cross(offset, impulse));
  car.angularVelocity = limit(
    add(
      car.angularVelocity,
      vec(torque.x / 22.8, torque.y / 31.5, torque.z / 12.6),
    ),
    5.5,
  );
}

function goalContacts(car: Car) {
  const contacts: { normal: Vec3; gap: number; wheels: boolean }[] = [];
  for (const post of GOAL_FRAME) {
    const delta = sub(car.position, post.center);
    if (
      Math.abs(delta.z) > 0.95 ||
      Math.abs(delta.x) > post.half.x + 0.85 ||
      Math.abs(delta.y) > post.half.y + 0.85
    )
      continue;
    const carAxes = [RIGHT, UP, FORWARD].map((v) => rotate(car.orientation, v));
    const worldAxes = [RIGHT, UP, FORWARD];
    const axes = [
      ...carAxes,
      ...worldAxes,
      ...carAxes.flatMap((a) => worldAxes.map((b) => cross(a, b))),
    ];
    let depth = Infinity,
      normal = UP;
    for (const axis of axes) {
      if (length(axis) < 1e-6) continue;
      const n = unit(axis),
        distance = dot(delta, n);
      const support =
        Math.abs(n.x) * post.half.x +
        Math.abs(n.y) * post.half.y +
        Math.abs(n.z) * post.half.z;
      const overlap = carSupport(car, n) + support - Math.abs(distance);
      if (overlap <= 0) {
        depth = 0;
        break;
      }
      if (overlap < depth) {
        depth = overlap;
        normal = scale(n, distance < 0 ? -1 : 1);
      }
    }
    if (depth > 0) contacts.push({ normal, gap: -depth, wheels: false });
  }
  return contacts;
}

function resolveArena(car: Car, wasGrounded: boolean): void {
  car.grounded = false;
  for (let pass = 0; pass < 4; pass++) {
    const up = rotate(car.orientation, UP);
    const candidates = arenaSurfaces(car.position).map((surface) => {
      const wheels = dot(up, surface.normal) > 0.45 && car.contactLock <= 0;
      const extent = wheels
        ? CAR_PHYSICS.restHeight
        : carSupport(car, surface.normal);
      return { normal: surface.normal, wheels, gap: surface.distance - extent };
    });
    candidates.push(...goalContacts(car));
    const contact = candidates.reduce((best, next) =>
      next.gap < best.gap ? next : best,
    );
    const tolerance = contact.wheels && wasGrounded ? 0.09 : 0.012;
    if (contact.gap > tolerance) break;
    if (contact.gap < 0 || contact.wheels)
      car.position = sub(car.position, scale(contact.normal, contact.gap));
    if (contact.wheels) {
      const change = fromTo(up, contact.normal);
      if (wasGrounded) car.velocity = rotate(change, car.velocity);
      car.orientation = multiplyQ(change, car.orientation);
      car.surfaceNormal = contact.normal;
      car.jumpCount = 0;
      car.jumpTime = -1;
      car.jumpHoldTime = 0;
      car.dodgeTime = 0;
      car.angularVelocity = vec();
      car.grounded = contact.normal.y > -0.8;
    }
    if (contact.wheels) {
      const speed = dot(car.velocity, contact.normal);
      if (speed < 0 || wasGrounded)
        car.velocity = sub(car.velocity, scale(contact.normal, speed));
    } else {
      // O impulso no ponto de apoio impede equilibrio artificial sobre uma quina.
      const n = inverseRotate(car.orientation, contact.normal),
        h = CAR_PHYSICS.halfSize;
      const offset = rotate(
        car.orientation,
        vec(
          -Math.sign(n.x) * h.x,
          -Math.sign(n.y) * h.y,
          -Math.sign(n.z) * h.z,
        ),
      );
      const speed = dot(carPointVelocity(car, offset), contact.normal);
      if (speed < 0) {
        const torque = inverseRotate(
          car.orientation,
          cross(offset, contact.normal),
        );
        const inverseInertia = vec(
          torque.x / 22.8,
          torque.y / 31.5,
          torque.z / 12.6,
        );
        const response =
          1 / CAR_PHYSICS.mass +
          dot(
            contact.normal,
            cross(rotate(car.orientation, inverseInertia), offset),
          );
        applyCarImpulse(
          car,
          scale(contact.normal, (-speed * 1.05) / response),
          offset,
        );
      }
      car.velocity = scale(car.velocity, 0.995);
    }
    if (Math.abs(contact.gap) < 1e-6) break;
  }
}

export function moveCar(
  car: Car,
  input: InputFrame,
  settings: Settings,
  dt: number,
  unlimited = false,
): void {
  const safe = (value: number | undefined) =>
    Number.isFinite(value) ? clamp(value!, -1, 1) : 0;
  const throttle = safe(input.throttle),
    steer = safe(input.steer);
  const pitch = safe(input.pitch ?? -throttle),
    yaw = safe(input.yaw ?? steer),
    roll = safe(input.roll);
  car.contactLock = Math.max(0, car.contactLock - dt);
  const wasGrounded = car.grounded;
  const pressed = input.jump && !car.jumpHeld;
  let forward = rotate(car.orientation, FORWARD),
    up = rotate(car.orientation, UP);
  if (pressed && car.grounded) {
    car.velocity = add(car.velocity, scale(up, CAR_PHYSICS.jumpImpulse));
    car.grounded = false;
    car.jumpCount = 1;
    car.jumpTime = 0;
    car.jumpHoldTime = 0;
    car.contactLock = 0.08;
  } else if (
    pressed &&
    !car.grounded &&
    car.jumpCount < 2 &&
    (car.jumpTime < 0 ||
      car.jumpTime < CAR_PHYSICS.dodgeWindow + car.jumpHoldTime)
  ) {
    const direction = vec(yaw, 0, pitch);
    car.jumpCount = 2;
    car.contactLock = 0.08;
    if (length(direction) > 0.5) {
      const local = unit(direction);
      const speed = dot(car.velocity, forward),
        fraction = Math.abs(speed) / CAR_PHYSICS.maxSpeed;
      const backward = Math.abs(speed) < 1 ? local.z > 0 : local.z * speed > 0;
      const impulse = vec(
        local.x * (1 + 0.9 * fraction),
        0,
        local.z * (backward ? (16 / 15) * (1 + 1.5 * fraction) : 1),
      );
      const world = rotate(axisAngle(UP, -car.heading), impulse);
      car.velocity = add(car.velocity, scale(world, CAR_PHYSICS.dodgeImpulse));
      car.dodgeAxis = unit(cross(UP, local));
      car.dodgeTime = CAR_PHYSICS.dodgeDuration;
    } else car.velocity = add(car.velocity, scale(up, CAR_PHYSICS.jumpImpulse));
  }
  car.jumpHeld = input.jump;
  if (car.jumpTime >= 0 && !car.grounded) {
    const holding =
      car.jumpTime < 0.025 ||
      (input.jump &&
        car.jumpCount === 1 &&
        car.jumpTime < CAR_PHYSICS.jumpHoldDuration &&
        car.jumpHoldTime < CAR_PHYSICS.jumpHoldDuration);
    if (holding) {
      const holdStep = Math.min(
        dt,
        CAR_PHYSICS.jumpHoldDuration - car.jumpHoldTime,
      );
      if (holdStep > 0)
        car.velocity = add(
          car.velocity,
          scale(up, CAR_PHYSICS.jumpHoldAcceleration * holdStep),
        );
      car.jumpHoldTime += Math.max(0, holdStep);
    }
    if (car.jumpTime < 0.025)
      car.velocity = sub(car.velocity, scale(up, 3.25 * dt));
    car.jumpTime += dt;
  }
  car.boosting = input.boost && (unlimited || car.boost > 0);
  car.boost = unlimited
    ? 100
    : Math.max(
        0,
        car.boost - (car.boosting ? CAR_PHYSICS.boostConsumption * dt : 0),
      );
  if (car.grounded) {
    const normal = car.surfaceNormal;
    forward = unit(tangent(forward, normal), FORWARD);
    const longitudinal = dot(car.velocity, forward);
    const turn =
      -steer *
      settings.sensitivity *
      longitudinal *
      steeringCurvature(longitudinal) *
      (input.drift ? 1.75 : 1) *
      dt;
    car.orientation = multiplyQ(axisAngle(normal, turn), car.orientation);
    forward = unit(tangent(rotate(car.orientation, FORWARD), normal), forward);
    const right = unit(cross(forward, normal), RIGHT);
    const slip = dot(car.velocity, right);
    car.velocity = sub(
      car.velocity,
      scale(right, slip * (1 - Math.exp(-(input.drift ? 1.6 : 28) * dt))),
    );
    let acceleration = 0;
    if (throttle !== 0)
      acceleration =
        throttle *
        (longitudinal * throttle < -0.1
          ? 35
          : throttleAcceleration(longitudinal));
    else
      acceleration =
        -Math.sign(longitudinal) * Math.min(5.25, Math.abs(longitudinal) / dt);
    if (car.boosting) acceleration += CAR_PHYSICS.boostGround;
    car.velocity = add(car.velocity, scale(forward, acceleration * dt));
    car.velocity = add(
      car.velocity,
      scale(tangent(vec(0, -CAR_PHYSICS.gravity, 0), normal), dt),
    );
    car.angularVelocity = vec();
  } else {
    if (car.dodgeTime > 0) {
      car.dodgeTime = Math.max(0, car.dodgeTime - dt);
      const elapsed = CAR_PHYSICS.dodgeDuration - car.dodgeTime;
      const cancel = pitch * car.dodgeAxis.x < -0.1;
      car.angularVelocity = limit(
        add(
          car.angularVelocity,
          vec(
            cancel ? 0 : car.dodgeAxis.x * 224 * dt,
            0,
            car.dodgeAxis.z * 260 * dt,
          ),
        ),
        5.5,
      );
      if (cancel) car.angularVelocity.x *= Math.exp(-12 * dt);
      if (elapsed >= 0.15 && (car.velocity.y < 0 || elapsed < 0.21))
        car.velocity.y *= Math.pow(0.65, dt * 120);
    } else {
      // ponytail: amortecimento de recuperação calibrado; substituir com replays de referência.
      const recoveringDodge =
        car.jumpCount === 2 &&
        length(car.dodgeAxis) > 0 &&
        car.dodgeTime > -0.4;
      if (recoveringDodge) car.dodgeTime -= dt;
      const angular = car.angularVelocity;
      car.angularVelocity = limit(
        vec(
          angular.x +
            (pitch * 12.46 -
              angular.x *
                (recoveringDodge ? 0.3 : 2.8) *
                (1 - Math.abs(pitch) * 0.6)) *
              dt,
          angular.y +
            (-yaw * 9.11 - angular.y * 2.6 * (1 - Math.abs(yaw) * 0.5)) * dt,
          angular.z +
            (-roll * 38.34 - angular.z * (recoveringDodge ? 0.3 : 4.3)) * dt,
        ),
        5.5,
      );
    }
    const angularSpeed = length(car.angularVelocity);
    if (angularSpeed > 1e-8)
      car.orientation = multiplyQ(
        car.orientation,
        axisAngle(car.angularVelocity, angularSpeed * dt),
      );
    forward = rotate(car.orientation, FORWARD);
    const acceleration =
      throttle * (throttle < 0 ? 0.33334 : 0.66667) +
      (car.boosting ? CAR_PHYSICS.boostAir : 0);
    car.velocity = add(
      car.velocity,
      add(
        scale(forward, acceleration * dt),
        vec(0, -CAR_PHYSICS.gravity * dt, 0),
      ),
    );
  }
  car.velocity = limit(car.velocity, CAR_PHYSICS.maxSpeed);
  car.position = add(car.position, scale(car.velocity, dt));
  resolveArena(car, wasGrounded && car.contactLock === 0);
  forward = rotate(car.orientation, FORWARD);
  if (Math.hypot(forward.x, forward.z) > 0.01)
    car.heading = Math.atan2(forward.x, -forward.z);
  car.supersonic =
    length(car.velocity) >= (car.supersonic ? 21 : CAR_PHYSICS.supersonic);
}

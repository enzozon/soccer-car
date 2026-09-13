import { FIELD } from "./types.ts";
import type { Vec3 } from "./types.ts";
import { vec, scale, add, length, unit } from "./math.ts";

export interface Surface {
  normal: Vec3;
  distance: number;
}

export const GOAL_FRAME = [-1, 1].flatMap((side) => [
  {
    center: vec(
      -FIELD.goalHalfWidth,
      FIELD.goalHeight / 2,
      side * FIELD.halfLength,
    ),
    half: vec(0.12, FIELD.goalHeight / 2, 0.12),
  },
  {
    center: vec(
      FIELD.goalHalfWidth,
      FIELD.goalHeight / 2,
      side * FIELD.halfLength,
    ),
    half: vec(0.12, FIELD.goalHeight / 2, 0.12),
  },
  {
    center: vec(0, FIELD.goalHeight, side * FIELD.halfLength),
    half: vec(FIELD.goalHalfWidth, 0.12, 0.12),
  },
]);

/** Distâncias positivas ficam no espaço jogável; rampas compartilham o raio do visual. */
export function arenaSurfaces(p: Vec3): Surface[] {
  const surfaces: Surface[] = [
    { normal: vec(0, 1, 0), distance: p.y },
    { normal: vec(0, -1, 0), distance: FIELD.wallHeight - p.y },
  ];
  const walls: Surface[] = [
    { normal: vec(-1, 0, 0), distance: FIELD.halfWidth - p.x },
    { normal: vec(1, 0, 0), distance: FIELD.halfWidth + p.x },
  ];
  const mouth = Math.abs(p.x) < FIELD.goalHalfWidth && p.y < FIELD.goalHeight;
  for (const side of [-1, 1]) {
    if (!mouth || p.z * side < 0)
      walls.push({
        normal: vec(0, 0, -side),
        distance: FIELD.halfLength - p.z * side,
      });
    for (const sx of [-1, 1])
      walls.push({
        normal: vec(-sx / Math.SQRT2, 0, -side / Math.SQRT2),
        distance: (FIELD.cornerLimit - sx * p.x - side * p.z) / Math.SQRT2,
      });
  }
  if (Math.abs(p.z) > FIELD.halfLength) {
    surfaces.push(
      { normal: vec(-1, 0, 0), distance: FIELD.goalHalfWidth - p.x },
      { normal: vec(1, 0, 0), distance: FIELD.goalHalfWidth + p.x },
      { normal: vec(0, -1, 0), distance: FIELD.goalHeight - p.y },
      {
        normal: vec(0, 0, -Math.sign(p.z)),
        distance: FIELD.halfLength + FIELD.goalDepth - Math.abs(p.z),
      },
    );
  }
  const radius = FIELD.rampRadius;
  for (const wall of walls) {
    surfaces.push(wall);
    if (wall.distance >= radius) continue;
    for (const top of [false, true]) {
      const vertical = top ? FIELD.wallHeight - p.y : p.y;
      if (vertical >= radius) continue;
      const towardCenter = add(
        scale(wall.normal, radius - wall.distance),
        vec(0, (top ? -1 : 1) * (radius - vertical), 0),
      );
      surfaces.push({
        normal: unit(towardCenter),
        distance: radius - length(towardCenter),
      });
    }
  }
  return surfaces;
}

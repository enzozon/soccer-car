import type { Quaternion, Vec3 } from "./types.ts";

export const vec = (x = 0, y = 0, z = 0): Vec3 => ({ x, y, z });
export const add = (a: Vec3, b: Vec3): Vec3 =>
  vec(a.x + b.x, a.y + b.y, a.z + b.z);
export const sub = (a: Vec3, b: Vec3): Vec3 =>
  vec(a.x - b.x, a.y - b.y, a.z - b.z);
export const scale = (v: Vec3, s: number): Vec3 =>
  vec(v.x * s, v.y * s, v.z * s);
export const dot = (a: Vec3, b: Vec3) => a.x * b.x + a.y * b.y + a.z * b.z;
export const cross = (a: Vec3, b: Vec3): Vec3 =>
  vec(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x);
export const length = (v: Vec3) => Math.hypot(v.x, v.y, v.z);
export const unit = (v: Vec3, fallback = vec(0, 1, 0)): Vec3 =>
  length(v) > 1e-8 ? scale(v, 1 / length(v)) : { ...fallback };
export const tangent = (v: Vec3, normal: Vec3) =>
  sub(v, scale(normal, dot(v, normal)));
export const clamp = (v: number, low: number, high: number) =>
  Math.min(high, Math.max(low, v));
export const limit = (v: Vec3, max: number) =>
  length(v) > max ? scale(v, max / length(v)) : v;
export const identity = (): Quaternion => ({ x: 0, y: 0, z: 0, w: 1 });
export const normalizeQ = (q: Quaternion): Quaternion => {
  const n = Math.hypot(q.x, q.y, q.z, q.w);
  return n > 1e-8
    ? { x: q.x / n, y: q.y / n, z: q.z / n, w: q.w / n }
    : identity();
};
export const multiplyQ = (a: Quaternion, b: Quaternion): Quaternion =>
  normalizeQ({
    x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
    y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
    z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
    w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
  });
export const axisAngle = (axis: Vec3, angle: number): Quaternion => {
  const a = unit(axis),
    s = Math.sin(angle / 2);
  return { x: a.x * s, y: a.y * s, z: a.z * s, w: Math.cos(angle / 2) };
};
export const rotate = (q: Quaternion, v: Vec3): Vec3 => {
  const qv = vec(q.x, q.y, q.z),
    t = scale(cross(qv, v), 2);
  return add(v, add(scale(t, q.w), cross(qv, t)));
};
export const inverseRotate = (q: Quaternion, v: Vec3) =>
  rotate({ x: -q.x, y: -q.y, z: -q.z, w: q.w }, v);
export const fromTo = (a: Vec3, b: Vec3): Quaternion => {
  const d = dot(a, b);
  if (d < -0.99999)
    return axisAngle(
      unit(cross(a, Math.abs(a.x) < 0.9 ? vec(1, 0, 0) : vec(0, 0, 1))),
      Math.PI,
    );
  const c = cross(a, b);
  return normalizeQ({ ...c, w: 1 + d });
};
export const UP = vec(0, 1, 0);
export const FORWARD = vec(0, 0, -1);
export const RIGHT = vec(1, 0, 0);

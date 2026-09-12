import { DEFAULT_SETTINGS } from "./types.ts";
import type { Settings } from "./types.ts";

export const STORAGE_KEY = "soccer-car.settings.v1";
export function validateSettings(value: unknown): Settings {
  const result = { ...DEFAULT_SETTINGS };
  if (!value || typeof value !== "object") return result;
  const raw = value as Record<string, unknown>;
  const pick = <K extends keyof Settings>(
    key: K,
    choices: readonly Settings[K][],
  ) => {
    if (choices.includes(raw[key] as Settings[K]))
      result[key] = raw[key] as Settings[K];
  };
  pick("model", ["pulse", "rally", "vector"]);
  pick("quality", ["auto", "low", "high", "2d"]);
  pick("camera", ["chase", "ball", "overview"]);
  pick("difficulty", ["easy", "normal", "hard"]);
  pick("duration", [60, 180, 300]);
  if (typeof raw.color === "string" && /^#[0-9a-f]{6}$/i.test(raw.color))
    result.color = raw.color;
  for (const [key, min, max] of [
    ["volume", 0, 1],
    ["deadzone", 0.05, 0.4],
    ["sensitivity", 0.5, 2],
  ] as const) {
    if (typeof raw[key] === "number" && Number.isFinite(raw[key]))
      result[key] = Math.min(max, Math.max(min, raw[key]));
  }
  if (typeof raw.reducedMotion === "boolean")
    result.reducedMotion = raw.reducedMotion;
  return result;
}
export function loadSettings(): Settings {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return validateSettings(JSON.parse(saved));
  } catch {
    /* Navegação privada ou preferências antigas não impedem a partida. */
  }
  return {
    ...DEFAULT_SETTINGS,
    reducedMotion:
      typeof matchMedia === "function" &&
      matchMedia("(prefers-reduced-motion: reduce)").matches,
  };
}
export function saveSettings(settings: Settings): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    return true;
  } catch {
    return false;
  }
}

import { test } from "node:test";
import assert from "node:assert/strict";
import { validateSettings } from "../src/settings.ts";
import { DEFAULT_SETTINGS } from "../src/types.ts";

test("preferências corrompidas retornam padrões seguros", () => {
  assert.deepEqual(validateSettings(null), DEFAULT_SETTINGS);
  const value = validateSettings({
    model: "invasor",
    color: "<script>",
    quality: 42,
    volume: NaN,
    duration: -20,
  });
  assert.deepEqual(value, DEFAULT_SETTINGS);
});
test("preferências válidas preservadas e valores numéricos limitados", () => {
  const value = validateSettings({
    model: "rally",
    color: "#123ABC",
    quality: "2d",
    deadzone: 0,
    sensitivity: 8,
    volume: -1,
    duration: 60,
  });
  assert.equal(value.model, "rally");
  assert.equal(value.color, "#123ABC");
  assert.equal(
    value.quality,
    "auto",
    "perfil 2D antigo migra para 3D automatico",
  );
  assert.equal(value.deadzone, 0.05);
  assert.equal(value.sensitivity, 2);
  assert.equal(value.volume, 0);
  assert.equal(value.duration, 60);
});

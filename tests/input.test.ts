import assert from "node:assert/strict";
import { test } from "node:test";
import { readGamepad } from "../src/input.ts";
import { DEFAULT_SETTINGS } from "../src/types.ts";

test("controle aplica deadzone, gatilhos, botões e limites seguros", () => {
  const buttons = Array.from({ length: 10 }, () => ({
    pressed: false,
    touched: false,
    value: 0,
  }));
  const gamepad = { axes: [0.1, -1], buttons };
  assert.deepEqual(readGamepad(gamepad, DEFAULT_SETTINGS), {
    throttle: 0,
    steer: 0,
    jump: false,
    boost: false,
    drift: false,
    pitch: -1,
    yaw: 0,
    roll: 0,
  });

  gamepad.axes[0] = 0.575;
  assert.ok(
    Math.abs(readGamepad(gamepad, DEFAULT_SETTINGS).steer - 0.5) < 1e-10,
  );
  buttons[7].value = 1;
  buttons[6].value = 0.575;
  buttons[6].pressed = true;
  assert.ok(
    Math.abs(readGamepad(gamepad, DEFAULT_SETTINGS).throttle - 0.5) < 1e-10,
  );
  buttons[7].value = 0;
  buttons[6].value = 1;
  assert.equal(readGamepad(gamepad, DEFAULT_SETTINGS).throttle, -1);

  buttons[0].pressed = true;
  buttons[1].value = 1;
  buttons[2].value = 0.9;
  const active = readGamepad(gamepad, DEFAULT_SETTINGS);
  assert.equal(active.jump, true);
  assert.equal(active.boost, true);
  assert.equal(active.drift, true);

  assert.equal(
    readGamepad({ axes: [0, -1], buttons: [] }, DEFAULT_SETTINGS).throttle,
    1,
  );
  assert.equal(
    readGamepad(
      { axes: [-0.9], buttons: [] },
      { ...DEFAULT_SETTINGS, sensitivity: 2 },
    ).steer,
    (-0.9 + 0.15) / 0.85,
  );
  const invalid = readGamepad(
    {
      axes: [Infinity, NaN],
      buttons: [{ pressed: false, touched: false, value: NaN }],
    },
    { ...DEFAULT_SETTINGS, deadzone: 1, sensitivity: NaN },
  );
  assert.equal(invalid.steer, 0);
  assert.equal(invalid.throttle, 0);
  assert.equal(invalid.jump, false);
  assert.equal(
    readGamepad({ axes: [5, -8], buttons: [] }, DEFAULT_SETTINGS).steer,
    1,
  );
  assert.equal(
    readGamepad({ axes: [5, -8], buttons: [] }, DEFAULT_SETTINGS).throttle,
    1,
  );
});

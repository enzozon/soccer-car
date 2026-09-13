import { NEUTRAL_INPUT } from "./types.ts";
import type { InputFrame, Settings } from "./types.ts";

type Action = "pause" | "camera" | "reset";
type TouchControl =
  | "forward"
  | "back"
  | "left"
  | "right"
  | "jump"
  | "boost"
  | "drift"
  | "rollLeft"
  | "rollRight";
const keyActions: Record<string, Action> = {
  Escape: "pause",
  KeyP: "pause",
  KeyC: "camera",
  KeyR: "reset",
};
const movementKeys = new Set([
  "KeyQ",
  "KeyE",
  "KeyW",
  "KeyS",
  "KeyA",
  "KeyD",
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "Space",
  "ShiftLeft",
  "ShiftRight",
  "ControlLeft",
  "ControlRight",
]);
const touchControls = new Set<TouchControl>([
  "rollLeft",
  "rollRight",
  "forward",
  "back",
  "left",
  "right",
  "jump",
  "boost",
  "drift",
]);
const gamepadActions = [
  [9, "pause"],
  [3, "camera"],
  [8, "reset"],
] as const;
const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));
const finite = (value: number | undefined, fallback = 0) =>
  Number.isFinite(value) ? value! : fallback;

function buttonValue(button: GamepadButton | undefined): number {
  return clamp(finite(button?.value, button?.pressed ? 1 : 0), 0, 1);
}

function pressed(gamepad: Pick<Gamepad, "buttons">, index: number): boolean {
  return (
    Boolean(gamepad.buttons[index]?.pressed) ||
    buttonValue(gamepad.buttons[index]) > 0.5
  );
}

export function readGamepad(
  gamepad: Pick<Gamepad, "axes" | "buttons">,
  settings: Settings,
): InputFrame {
  const deadzone = clamp(finite(settings.deadzone, 0.15), 0, 0.95);
  const axis = (value: number | undefined) => {
    const bounded = clamp(finite(value), -1, 1);
    return (
      Math.sign(bounded) *
      Math.max(0, (Math.abs(bounded) - deadzone) / (1 - deadzone))
    );
  };
  const hasTriggers =
    gamepad.buttons[6] !== undefined && gamepad.buttons[7] !== undefined;
  return {
    throttle: hasTriggers
      ? axis(buttonValue(gamepad.buttons[7])) -
        axis(buttonValue(gamepad.buttons[6]))
      : -axis(gamepad.axes[1]) || 0,
    steer: axis(gamepad.axes[0]),
    pitch: axis(gamepad.axes[1]),
    yaw: pressed(gamepad, 2) || pressed(gamepad, 4) ? 0 : axis(gamepad.axes[0]),
    roll:
      pressed(gamepad, 2) || pressed(gamepad, 4)
        ? axis(gamepad.axes[0])
        : pressed(gamepad, 5)
          ? 1
          : 0,
    jump: pressed(gamepad, 0),
    boost: pressed(gamepad, 1),
    drift: pressed(gamepad, 2),
  };
}

export class InputController {
  private keys = new Set<string>();
  private pointers = new Map<number, TouchControl>();
  private enabled = true;
  private connected = false;
  private label = "Teclado";
  private previousPadActions = new Set<Action>();
  private padIdentity = "";
  private touchCleanup: (() => void) | undefined;
  private readonly onAction: (action: Action) => void;

  constructor(onAction: (action: Action) => void) {
    this.onAction = onAction;
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("blur", this.clearHeld);
  }

  get deviceLabel(): string {
    return this.label;
  }
  get gamepadConnected(): boolean {
    return this.connected;
  }

  setEnabled(enabled: boolean): void {
    if (this.enabled !== enabled) this.clearHeld();
    this.enabled = enabled;
  }

  private clearHeld = (): void => {
    this.keys.clear();
    this.pointers.clear();
  };

  private onKeyDown = (event: KeyboardEvent): void => {
    const target = event.target;
    if (
      target instanceof Element &&
      target.closest(
        'input, select, textarea, button, a[href], [contenteditable]:not([contenteditable="false"]), [role="button"]',
      )
    )
      return;
    const action = keyActions[event.code];
    if (!action && !movementKeys.has(event.code)) return;
    if (event.metaKey || event.altKey || (event.ctrlKey && action)) return;
    event.preventDefault();
    this.label = "Teclado";
    if (action) {
      if (!event.repeat && (this.enabled || action === "pause"))
        this.onAction(action);
    } else if (this.enabled) this.keys.add(event.code);
  };

  private onKeyUp = (event: KeyboardEvent): void => {
    this.keys.delete(event.code);
  };

  poll(settings: Settings): InputFrame {
    let pad: Gamepad | undefined;
    try {
      if (
        typeof navigator !== "undefined" &&
        typeof navigator.getGamepads === "function"
      ) {
        pad = Array.from(navigator.getGamepads()).find(
          (candidate): candidate is Gamepad =>
            candidate != null && candidate.connected,
        );
      }
    } catch {
      /* Alguns navegadores bloqueiam Gamepad API por política de segurança. */
    }
    this.connected = pad !== undefined;
    const identity = pad ? `${pad.index}:${pad.id}` : "";
    if (identity !== this.padIdentity) {
      this.previousPadActions.clear();
      this.padIdentity = identity;
      this.label = pad ? pad.id || "Controle" : "Teclado";
    }
    if (pad) {
      const currentActions = new Set<Action>();
      for (const [index, action] of gamepadActions) {
        if (!pressed(pad, index)) continue;
        currentActions.add(action);
        if (
          !this.previousPadActions.has(action) &&
          (this.enabled || action === "pause")
        )
          this.onAction(action);
      }
      this.previousPadActions = currentActions;
    }
    if (!this.enabled) return { ...NEUTRAL_INPUT };
    const touch = new Set(this.pointers.values());
    const key = (...codes: string[]) =>
      codes.some((code) => this.keys.has(code));
    const local: InputFrame = {
      throttle:
        Number(key("KeyW", "ArrowUp") || touch.has("forward")) -
        Number(key("KeyS", "ArrowDown") || touch.has("back")),
      steer:
        Number(key("KeyD", "ArrowRight") || touch.has("right")) -
        Number(key("KeyA", "ArrowLeft") || touch.has("left")),
      jump: key("Space") || touch.has("jump"),
      boost: key("ShiftLeft", "ShiftRight") || touch.has("boost"),
      drift: key("ControlLeft", "ControlRight") || touch.has("drift"),
    };
    local.pitch = -local.throttle;
    local.yaw = local.drift ? 0 : local.steer;
    local.roll =
      Number(key("KeyE") || touch.has("rollRight")) -
        Number(key("KeyQ") || touch.has("rollLeft")) ||
      (local.drift ? local.steer : 0);
    const controller = pad ? readGamepad(pad, settings) : NEUTRAL_INPUT;
    if (
      pad &&
      (controller.throttle ||
        controller.steer ||
        controller.jump ||
        controller.boost ||
        controller.drift ||
        controller.pitch ||
        controller.roll)
    )
      this.label = pad.id || "Controle";
    return {
      throttle: local.throttle || controller.throttle,
      steer: local.steer || controller.steer,
      jump: local.jump || controller.jump,
      boost: local.boost || controller.boost,
      drift: local.drift || controller.drift,
      pitch: local.pitch || controller.pitch || 0,
      yaw: local.yaw || controller.yaw || 0,
      roll: local.roll || controller.roll || 0,
    };
  }

  bindTouch(root: HTMLElement): void {
    this.touchCleanup?.();
    const originalTouchAction = root.style.touchAction;
    root.style.touchAction = "none";
    const release = (event: PointerEvent) => {
      this.pointers.delete(event.pointerId);
    };
    const down = (event: PointerEvent) => {
      if (!this.enabled || !(event.target instanceof Element)) return;
      const button = event.target.closest<HTMLElement>("[data-control]");
      const control = button?.dataset.control as TouchControl | undefined;
      if (
        !button ||
        !root.contains(button) ||
        !control ||
        !touchControls.has(control)
      )
        return;
      event.preventDefault();
      this.pointers.set(event.pointerId, control);
      this.label = "Toque";
      try {
        button.setPointerCapture(event.pointerId);
      } catch {
        /* Pointerup global também libera o toque sem captura. */
      }
    };
    root.addEventListener("pointerdown", down);
    root.addEventListener("lostpointercapture", release);
    window.addEventListener("pointerup", release);
    window.addEventListener("pointercancel", release);
    this.touchCleanup = () => {
      root.style.touchAction = originalTouchAction;
      root.removeEventListener("pointerdown", down);
      root.removeEventListener("lostpointercapture", release);
      window.removeEventListener("pointerup", release);
      window.removeEventListener("pointercancel", release);
      this.pointers.clear();
    };
  }

  dispose(): void {
    this.touchCleanup?.();
    this.touchCleanup = undefined;
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("blur", this.clearHeld);
    this.clearHeld();
  }
}

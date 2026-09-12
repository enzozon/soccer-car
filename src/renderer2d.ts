import { FIELD } from "./types.ts";
import type { Car, GameState, Settings } from "./types.ts";
import type { GameRenderer } from "./renderer.ts";

/** Visão superior independente da GPU, com toda a arena visível. */
export function createCanvasRenderer(canvas: HTMLCanvasElement): GameRenderer {
  const context = canvas.getContext("2d", { alpha: false });
  if (!context)
    throw new Error("O navegador não disponibilizou um contexto Canvas 2D.");
  const ctx = context;
  let width = 1,
    height = 1,
    ratio = 1;
  function resize() {
    width = Math.max(1, canvas.clientWidth || window.innerWidth);
    height = Math.max(1, canvas.clientHeight || window.innerHeight);
    ratio = Math.min(window.devicePixelRatio || 1, 1.5);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
  }
  resize();
  function render(
    state: GameState,
    settings: Settings,
    _dt: number,
    showroom = false,
  ) {
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    const sky = ctx.createLinearGradient(0, 0, width, height);
    sky.addColorStop(0, "#334844");
    sky.addColorStop(1, "#172b31");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, width, height);
    const landscape = width > height * 1.12;
    const fw = landscape ? FIELD.halfLength * 2 : FIELD.halfWidth * 2;
    const fh = landscape ? FIELD.halfWidth * 2 : FIELD.halfLength * 2;
    const top = showroom ? 28 : 88,
      bottom = width < 760 ? 170 : 50;
    const scale = Math.max(
      0.5,
      Math.min((width - 64) / (fw + 12), (height - top - bottom) / (fh + 12)),
    );
    ctx.translate(
      width * (showroom && width > 1000 ? 0.66 : 0.5),
      top + (height - top - bottom) / 2,
    );
    ctx.scale(scale, scale);
    if (landscape) ctx.rotate(-Math.PI / 2);
    const { halfWidth: w, halfLength: l, goalHalfWidth: g } = FIELD;
    ctx.fillStyle = "#101f27";
    ctx.fillRect(-w - 5, -l - 7, w * 2 + 10, l * 2 + 14);
    ctx.fillStyle = "#284e41";
    ctx.fillRect(-w, -l, w * 2, l * 2);
    for (let stripe = 0; stripe < 12; stripe += 2) {
      ctx.fillStyle = "#2c5445";
      ctx.fillRect(-w, -l + stripe * 6, w * 2, 6);
    }
    ctx.lineWidth = 0.15;
    ctx.strokeStyle = "#adc4ad";
    ctx.strokeRect(-w + 0.8, -l + 0.8, w * 2 - 1.6, l * 2 - 1.6);
    ctx.beginPath();
    ctx.moveTo(-w + 0.8, 0);
    ctx.lineTo(w - 0.8, 0);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, 7.8, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = "#d8e6c1";
    ctx.beginPath();
    ctx.arc(0, 0, 0.24, 0, Math.PI * 2);
    ctx.fill();
    for (const side of [-1, 1]) {
      const color = side < 0 ? "#fc927c" : "#d7fb55";
      ctx.strokeStyle = "#9ebaa4";
      ctx.lineWidth = 0.15;
      ctx.strokeRect(-g - 5, side < 0 ? -l : l - 10, g * 2 + 10, 10);
      ctx.fillStyle = side < 0 ? "#683f3a" : "#576335";
      ctx.fillRect(-g, side < 0 ? -l - 4 : l, g * 2, 4);
      ctx.strokeStyle = color;
      ctx.lineWidth = 0.48;
      ctx.strokeRect(-g, side < 0 ? -l - 4 : l, g * 2, 4);
      ctx.lineWidth = 0.12;
      ctx.globalAlpha = 0.38;
      for (let x = -g + 1; x < g; x += 1) {
        ctx.beginPath();
        ctx.moveTo(x, side * l);
        ctx.lineTo(x, side * (l + 4));
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      ctx.fillStyle = "#5c6b66";
      ctx.fillRect(-w - 4, side * (l + 5), w * 2 + 8, 0.8);
    }
    for (const side of [-1, 1]) {
      ctx.fillStyle = "#687b6b";
      ctx.fillRect(side < 0 ? -w - 3.6 : w + 1.5, -l + 2, 2, l * 2 - 4);
      ctx.fillStyle = "#fc927c";
      ctx.fillRect(side < 0 ? -w - 1 : w + 0.7, -l, 0.3, l);
      ctx.fillStyle = "#d7fb55";
      ctx.fillRect(side < 0 ? -w - 1 : w + 0.7, 0, 0.3, l);
    }
    for (const pad of state.pads) {
      ctx.strokeStyle = pad.cooldown > 0 ? "#526253" : "#ffc76b";
      ctx.fillStyle = pad.cooldown > 0 ? "#45513b" : "#c48f39";
      ctx.lineWidth = 0.2;
      ctx.beginPath();
      ctx.arc(pad.x, pad.z, 0.9, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      if (pad.cooldown <= 0) {
        ctx.fillStyle = "#ffe5a0";
        ctx.fillRect(pad.x - 0.24, pad.z - 0.24, 0.48, 0.48);
      }
    }
    function drawCar(car: Car, color: string, player: boolean) {
      const lift = Math.max(0, car.position.y - 0.72);
      ctx.save();
      ctx.translate(car.position.x, car.position.z);
      ctx.fillStyle = "#071a1a80";
      ctx.beginPath();
      ctx.ellipse(0.25, 0.55, 1.25 + lift * 0.035, 2.1, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.translate(0, -Math.min(lift * 0.18, 2));
      ctx.rotate(car.heading);
      if (car.boosting) {
        ctx.fillStyle = "#ffbe62";
        ctx.beginPath();
        ctx.moveTo(-0.7, 1.6);
        ctx.lineTo(
          0,
          settings.reducedMotion
            ? 4.4
            : 4.4 + Math.sin(state.elapsed * 40) * 0.5,
        );
        ctx.lineTo(0.7, 1.6);
        ctx.fill();
      }
      const model = player ? settings.model : "rally";
      ctx.fillStyle = "#101d24";
      for (const x of [-1.2, 0.75])
        for (const z of [-1.3, 0.7]) ctx.fillRect(x, z, 0.5, 0.95);
      const nose = model === "vector" ? 0.6 : 0.92;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(-nose, -1.85);
      ctx.lineTo(nose, -1.85);
      ctx.lineTo(1.02, model === "rally" ? -1.1 : 0.2);
      ctx.lineTo(1.02, 1.8);
      ctx.lineTo(-1.02, 1.8);
      ctx.lineTo(-1.02, model === "rally" ? -1.1 : 0.2);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#19323e";
      ctx.fillRect(-0.76, -0.72, 1.52, model === "rally" ? 1.6 : 1.15);
      ctx.fillStyle = "#edeee1";
      ctx.fillRect(-0.72, -1.8, 0.48, 0.18);
      ctx.fillRect(0.24, -1.8, 0.48, 0.18);
      ctx.fillStyle = "#24303a";
      ctx.fillRect(-1.17, 1.48, 2.34, 0.3);
      if (player) {
        ctx.strokeStyle = "#f4f6dc";
        ctx.lineWidth = 0.15;
        ctx.beginPath();
        ctx.moveTo(-0.48, -2.7);
        ctx.lineTo(0, -3.2);
        ctx.lineTo(0.48, -2.7);
        ctx.stroke();
      }
      ctx.restore();
    }
    if (state.mode === "duel") drawCar(state.opponent, "#fc927c", false);
    drawCar(state.player, settings.color, true);
    const ball = state.ball.position,
      lift = Math.max(0, ball.y - FIELD.ballRadius);
    ctx.fillStyle = "#091c2270";
    ctx.beginPath();
    ctx.ellipse(
      ball.x + 0.3,
      ball.z + 0.45,
      FIELD.ballRadius,
      FIELD.ballRadius * 0.75,
      0,
      0,
      Math.PI * 2,
    );
    ctx.fill();
    const radius = FIELD.ballRadius + Math.min(lift * 0.025, 0.5),
      ballY = ball.z - Math.min(lift * 0.2, 2.2);
    ctx.fillStyle = "#f6f1d7";
    ctx.strokeStyle = "#385255";
    ctx.lineWidth = 0.2;
    ctx.beginPath();
    ctx.arc(ball.x, ballY, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#3c5457";
    ctx.beginPath();
    ctx.arc(ball.x, ballY, radius * 0.38, 0, Math.PI * 2);
    ctx.fill();
  }
  return {
    kind: "2d",
    render,
    resize,
    dispose() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    },
  };
}

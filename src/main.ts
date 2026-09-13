import "./style.css";
import { CAR_MODELS, DEFAULT_SETTINGS } from "./types.ts";
import type { GameMode, Settings } from "./types.ts";
import { loadSettings, saveSettings } from "./settings.ts";
import { createGame, resetPositions, stepGame } from "./simulation.ts";
import { createRenderer } from "./renderer.ts";
import type { GameRenderer } from "./renderer.ts";
import { InputController } from "./input.ts";
import { GameAudio } from "./audio.ts";

const app = document.querySelector<HTMLDivElement>("#app")!;
app.innerHTML = `
  <main class="shell">
    <canvas id="arena" aria-label="Arena de futebol com carros" tabindex="-1"></canvas>
    <div class="vignette" aria-hidden="true"></div>
    <header class="topbar">
      <a class="brand" href="#" id="home" aria-label="Soccer Car, início"><span class="brand-mark">SC<span>//</span></span><span class="brand-name">SOCCER<br>CAR</span></a>
      <nav aria-label="Menu principal" id="navigation"><button class="nav-button active" id="nav-play">JOGAR</button><button class="nav-button" data-open="garage">GARAGEM</button><button class="nav-button" data-open="help">COMO JOGAR</button></nav>
      <div class="header-actions"><span class="connection"><i></i><span id="device">Teclado pronto</span></span><button class="icon-button" data-open="settings" aria-label="Configurações" title="Configurações">⚙</button><button class="icon-button" id="fullscreen" aria-label="Tela cheia" title="Tela cheia">⛶</button></div>
    </header>

    <section class="lobby" id="lobby" aria-label="Escolher partida">
      <div class="hero"><p class="eyebrow"><span class="live-dot"></span> FUTEBOL. MOTORES. VOCÊ.</p><h1>O campo<br>é <em>seu.</em></h1><p class="hero-copy">Acelere. Voe. Faça o gol.<br>Seu próximo grande lance começa aqui.</p>
        <div class="play-actions"><button class="primary play-button" id="start-duel" disabled><span>ENTRAR NA ARENA</span><span aria-hidden="true">↗</span></button><button class="secondary" id="start-training" disabled>TREINO LIVRE <span aria-hidden="true">→</span></button></div>
        <p class="play-note">1 JOGADOR <span>·</span> CONTRA BOT <span>·</span> SEM CADASTRO</p>
      </div>
      <aside class="match-card"><p class="eyebrow">SEU PRÓXIMO JOGO</p><div class="match-title"><span class="arena-number">01</span><div><h2>Terminal Arena</h2><p>Duelo • 1 × 1</p></div><span class="arena-symbol" aria-hidden="true">⌁</span></div>
        <div class="match-selects"><label>Tempo<select id="duration" data-setting="duration"><option value="60">1 min</option><option value="180">3 min</option><option value="300">5 min</option></select></label><label>Adversário<select id="difficulty" data-setting="difficulty"><option value="easy">Fácil</option><option value="normal">Normal</option><option value="hard">Difícil</option></select></label></div>
        <div class="current-car"><span class="car-silhouette" aria-hidden="true">▰</span><div><small>NA SUA GARAGEM</small><strong id="selected-car">Pulse</strong></div><button class="text-button" data-open="garage">TROCAR ↗</button></div>
      </aside>
      <div class="arena-caption"><span class="coordinate">SC / 001</span><span>TERMINAL ARENA<br><small>O JOGO COMEÇA NO SEU NAVEGADOR</small></span></div>
    </section>

    <section id="hud" class="hud" hidden aria-label="Informações da partida">
      <div class="scoreboard"><div class="team player-team"><span>VOCÊ</span><strong id="player-score">0</strong></div><div class="clock"><small id="mode-label">DUELO</small><strong id="clock">3:00</strong></div><div class="team bot-team"><strong id="bot-score">0</strong><span>BOT</span></div></div>
      <div class="game-buttons"><button class="small-button" id="camera-button">Câmera: carro [C]</button><button class="small-button" id="pause-button">Pausar [Esc]</button></div>
      <div class="announcement" id="announcement" role="status" aria-live="polite"></div>
      <div class="driving-info"><div class="speed"><strong id="speed">0</strong><span>KM/H</span></div><span class="driving-state" id="driving-state">NO CHÃO</span><div class="boost-meter"><div><span>TURBO</span><strong id="boost-value">100</strong></div><meter id="boost" min="0" max="100" value="100" aria-label="Carga do turbo"></meter></div></div>
      <p class="game-tip">WASD dirigir <span>·</span> SHIFT turbo <span>·</span> ESPAÇO salto <span>·</span> CTRL derrapar <span>·</span> Q/E air roll</p>
      <div class="touch-controls" id="touch-controls" aria-label="Controles de toque"><div class="touch-steering"><button data-control="left" aria-label="Virar à esquerda">←</button><div><button data-control="forward" aria-label="Acelerar">↑</button><button data-control="back" aria-label="Ré">↓</button></div><button data-control="right" aria-label="Virar à direita">→</button></div><div class="touch-actions"><button data-control="rollLeft" aria-label="Air roll esquerdo">↶</button><button data-control="rollRight" aria-label="Air roll direito">↷</button><button data-control="drift">DRIFT</button><button data-control="jump">PULAR</button><button data-control="boost" class="touch-boost">TURBO</button></div></div>
    </section>

    <footer class="bottom-bar"><span class="edition">SOCCER CAR <span>VOL. 02</span></span><span id="status" role="status">PREPARANDO A ARENA…</span><span class="performance"><span id="renderer-label">3D</span><span id="fps">— FPS</span></span></footer>
    <section id="graphics-error" class="graphics-error" hidden role="alert"><h2>A arena precisa de 3D.</h2><p>WebGL 2 está indisponível ou a conexão com a GPU foi perdida. Ative a aceleração gráfica nas configurações do navegador e tente novamente.</p><button id="retry-graphics" class="primary">TENTAR NOVAMENTE</button></section>
    <div class="toast" id="toast" role="status" hidden></div>
  </main>

  <dialog id="garage" aria-labelledby="garage-title"><div class="dialog-heading"><div><p class="eyebrow">ESCOLHA SUA ASSINATURA</p><h2 id="garage-title">Sua garagem<span>.</span></h2></div><button class="close-button" data-close aria-label="Fechar garagem">×</button></div><p class="dialog-description">Três carrocerias, cinco pinturas. A mesma física para todas.</p><div class="car-grid">${Object.entries(
    CAR_MODELS,
  )
    .map(
      ([id, model], index) =>
        `<button class="car-card" data-model="${id}" aria-pressed="false"><span class="car-index">0${index + 1}</span><svg viewBox="0 0 240 110" aria-hidden="true" class="car-drawing ${id}"><path class="car-body" d="${id === "rally" ? "M36 69 49 41 83 35 101 21 150 21 171 46 205 53 215 81 29 81Z" : id === "vector" ? "M20 69 69 53 110 27 152 32 169 54 214 64 223 81 18 81Z" : "M29 61 68 49 88 26 145 26 173 51 208 61 214 81 26 81Z"}"/><path class="car-glass" d="M87 48 105 31 143 33 157 50Z"/><path class="car-stripe" d="M35 64H204V69H35Z"/><circle cx="66" cy="79" r="18"/><circle cx="179" cy="79" r="18"/><circle class="hub" cx="66" cy="79" r="8"/><circle class="hub" cx="179" cy="79" r="8"/></svg><h3>${model.name}</h3><p>${model.label}</p><div class="car-stats"><span>VELOCIDADE <b>${Math.round(model.maxSpeed * 3.6)}</b></span><span>AGILIDADE <b>${Math.round(model.turnRate * 25)}</b></span></div></button>`,
    )
    .join(
      "",
    )}</div><div class="paint-row"><span>PINTURA</span><div class="swatches">${["#d7fb55", "#55d9e9", "#fa785b", "#f4f1e7", "#a596ee"].map((color, i) => `<button class="swatch" style="--paint:${color}" data-color="${color}" aria-label="${["Lima", "Ciano", "Coral", "Marfim", "Lilás"][i]}" aria-pressed="false"></button>`).join("")}</div><button class="primary compact" data-close>PRONTO PARA JOGAR ↗</button></div></dialog>

  <dialog id="settings" aria-labelledby="settings-title"><div class="dialog-heading"><div><p class="eyebrow">DO SEU JEITO</p><h2 id="settings-title">Configurações<span>.</span></h2></div><button class="close-button" data-close aria-label="Fechar configurações">×</button></div><div class="settings-grid"><label>Gráficos<select data-setting="quality"><option value="auto">Automático</option><option value="low">Econômico 3D</option><option value="high">Alta qualidade</option></select><small>Automático ajusta a resolução ao desempenho.</small></label><label>Câmera<select data-setting="camera"><option value="chase">Atrás do carro</option><option value="ball">Seguir a bola</option><option value="overview">Visão da arena</option></select></label><label>Volume<input type="range" data-setting="volume" min="0" max="1" step="0.05"/><small>Sons de contato, saída e gol.</small></label><label>Sensibilidade da direção<input type="range" data-setting="sensitivity" min="0.5" max="2" step="0.05"/></label><label>Zona morta do controle<input type="range" data-setting="deadzone" min="0.05" max="0.4" step="0.01"/><small>Aumente se o carro virar sozinho.</small></label><label class="checkbox-label"><input type="checkbox" data-setting="reducedMotion"/> Reduzir movimento da câmera</label></div><p class="settings-note" id="storage-note">Suas preferências ficam salvas neste navegador.</p><div class="dialog-footer"><button class="text-button" id="restore-settings">RESTAURAR PADRÕES</button><button class="primary compact" data-close>CONCLUÍDO ✓</button></div></dialog>

  <dialog id="help" aria-labelledby="help-title"><div class="dialog-heading"><div><p class="eyebrow">DOMINE O CAMPO</p><h2 id="help-title">Menos regras.<br>Mais jogo<span>.</span></h2></div><button class="close-button" data-close aria-label="Fechar instruções">×</button></div><p class="dialog-description">Leve a bola até o gol coral. Use o turbo para ganhar velocidade e pule para alcançar bolas altas. Segure o salto para subir mais. No segundo toque, indique uma direção para executar um flip. Incline o carro e use turbo para voar; acelere nas rampas para subir pelas paredes. Os pontos pequenos repõem 12 de turbo e os grandes completam a reserva.</p><div class="controls-table"><div><strong>AÇÃO</strong><strong>TECLADO</strong><strong>CONTROLE</strong></div><div><span>Acelerar / ré</span><kbd>W / S ou ↑ / ↓</kbd><span>RT / LT</span></div><div><span>Dirigir</span><kbd>A / D ou ← / →</kbd><span>Analógico esquerdo</span></div><div><span>Turbo</span><kbd>Shift</kbd><span>B / ○</span></div><div><span>Salto / flip direcional</span><kbd>Espaço</kbd><span>A / ×</span></div><div><span>Derrapar</span><kbd>Ctrl</kbd><span>X / □</span></div><div><span>Inclinar / girar no ar</span><kbd>WASD</kbd><span>Analógico esquerdo</span></div><div><span>Air roll</span><kbd>Q / E ou Ctrl + A/D</kbd><span>X ou LB + analógico</span></div><div><span>Trocar câmera</span><kbd>C</kbd><span>Y / △</span></div><div><span>Pausar</span><kbd>Esc / P</kbd><span>Start / Options</span></div><div><span>Reposicionar no treino</span><kbd>R</kbd><span>Back / Share</span></div></div><p class="settings-note">Conecte o controle e pressione um botão. O reconhecimento depende do navegador e do mapeamento padrão do dispositivo. Em telas de toque, use os botões na arena.</p><button class="primary compact" data-close>ENTENDI, VAMOS JOGAR ↗</button></dialog>

  <dialog id="pause" class="small-dialog" aria-labelledby="pause-title"><p class="eyebrow">UMA PARADA NOS BOXES</p><h2 id="pause-title">Jogo pausado<span>.</span></h2><p>A arena espera por você.</p><div class="stack-actions"><button class="primary" id="resume">VOLTAR AO JOGO →</button><button class="secondary" id="pause-settings">CONFIGURAÇÕES</button><button class="text-button" id="quit">SAIR PARA O MENU</button></div></dialog>
  <dialog id="result" class="small-dialog" aria-labelledby="result-title"><p class="eyebrow">APITO FINAL</p><h2 id="result-title">Boa partida<span>.</span></h2><p class="result-score" id="result-score">0 — 0</p><p id="result-copy"></p><div class="stack-actions"><button class="primary" id="rematch">JOGAR NOVAMENTE ↗</button><button class="text-button" id="result-home">VOLTAR AO MENU</button></div></dialog>
`;

const $ = <T extends HTMLElement = HTMLElement>(selector: string) =>
  document.querySelector<T>(selector)!;
let settings = loadSettings();
let state = createGame("training", settings);
let renderer: GameRenderer | null = null;
let canvas = $<HTMLCanvasElement>("#arena");
let running = false;
let paused = false;
let loading = true;
let accumulator = 0;
let toastTimer = 0;
let rendererGeneration = 0;
let returnToPause = false;
let lastAnnouncement = "";
const audio = new GameAudio();
const input = new InputController((action) => {
  if (action === "pause") {
    if (running) togglePause();
  } else if (action === "camera" && running && !paused) cycleCamera();
  else if (
    action === "reset" &&
    running &&
    !paused &&
    state.mode === "training"
  ) {
    resetPositions(state);
    toast("Bola e carro reposicionados.");
  }
});
input.setEnabled(false);
input.bindTouch($("#touch-controls"));

function toast(message: string) {
  $("#toast").textContent = message;
  $("#toast").hidden = false;
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    $("#toast").hidden = true;
  }, 3500);
}
function focusArena() {
  canvas.focus();
}
function persist() {
  const saved = saveSettings(settings);
  $("#storage-note").textContent = saved
    ? "Suas preferências ficam salvas neste navegador."
    : "O navegador bloqueou o armazenamento. Preferências valem nesta sessão.";
  syncSettings();
}
function syncSettings() {
  document
    .querySelectorAll<HTMLInputElement | HTMLSelectElement>("[data-setting]")
    .forEach((element) => {
      const value = settings[element.dataset.setting as keyof Settings];
      if (element instanceof HTMLInputElement && element.type === "checkbox")
        element.checked = Boolean(value);
      else element.value = String(value);
    });
  document
    .querySelectorAll<HTMLElement>("[data-model]")
    .forEach((button) =>
      button.setAttribute(
        "aria-pressed",
        String(button.dataset.model === settings.model),
      ),
    );
  document
    .querySelectorAll<HTMLElement>("[data-color]")
    .forEach((button) =>
      button.setAttribute(
        "aria-pressed",
        String(button.dataset.color === settings.color),
      ),
    );
  $("#selected-car").textContent = CAR_MODELS[settings.model].name;
  document.documentElement.style.setProperty("--car-paint", settings.color);
  document.documentElement.classList.toggle(
    "reduced-motion",
    settings.reducedMotion,
  );
  updateCameraLabel();
}
async function rebuildRenderer() {
  const generation = ++rendererGeneration;
  loading = true;
  $("#graphics-error").hidden = true;
  $<HTMLButtonElement>("#start-duel").disabled = true;
  $<HTMLButtonElement>("#start-training").disabled = true;
  canvas.removeEventListener("webglcontextlost", graphicsLost);
  renderer?.dispose();
  renderer = null;
  const replacement = canvas.cloneNode(false) as HTMLCanvasElement;
  canvas.replaceWith(replacement);
  canvas = replacement;
  canvas.addEventListener("webglcontextlost", graphicsLost);
  try {
    const created = await createRenderer(canvas, settings);
    if (generation !== rendererGeneration) {
      created.dispose();
      return;
    }
    renderer = created;
    renderer.resize();
    loading = false;
    $<HTMLButtonElement>("#start-duel").disabled = false;
    $<HTMLButtonElement>("#start-training").disabled = false;
    $("#status").textContent = "PRONTO PARA A PRÓXIMA JOGADA";
  } catch {
    loading = false;
    $("#status").textContent = "NÃO FOI POSSÍVEL ABRIR A ARENA";
    showGraphicsError();
  }
}
function showGraphicsError() {
  input.setEnabled(false);
  $("#graphics-error").hidden = false;
  $("#retry-graphics").focus();
}
function graphicsLost(event: Event) {
  event.preventDefault();
  pauseGame();
  returnToPause = false;
  closeDialogs();
  loading = true;
  showGraphicsError();
}
$("#retry-graphics").addEventListener("click", async () => {
  await rebuildRenderer();
  if (renderer && running) $<HTMLDialogElement>("#pause").showModal();
});
function openDialog(id: string) {
  if (running && !paused) pauseGame();
  const pauseDialog = $<HTMLDialogElement>("#pause");
  if (pauseDialog.open) {
    returnToPause = true;
    pauseDialog.close();
  }
  $<HTMLDialogElement>(`#${id}`).showModal();
}
function closeDialogs() {
  document
    .querySelectorAll<HTMLDialogElement>("dialog[open]")
    .forEach((dialog) => dialog.close());
}
function start(mode: GameMode) {
  if (loading || !renderer) return;
  returnToPause = false;
  closeDialogs();
  audio.unlock();
  state = createGame(mode, settings);
  running = true;
  paused = false;
  accumulator = 0;
  $("#lobby").hidden = true;
  $("#hud").hidden = false;
  $("#navigation").hidden = true;
  document.body.classList.add("in-game");
  input.setEnabled(true);
  focusArena();
  updateHud();
}
function goHome() {
  returnToPause = false;
  closeDialogs();
  running = false;
  paused = false;
  input.setEnabled(false);
  state = createGame("training", settings);
  $("#lobby").hidden = false;
  $("#hud").hidden = true;
  $("#navigation").hidden = false;
  document.body.classList.remove("in-game");
  $("#start-duel").focus();
}
function pauseGame() {
  if (!running || paused || state.phase === "finished") return;
  paused = true;
  accumulator = 0;
  input.setEnabled(false);
  $<HTMLDialogElement>("#pause").showModal();
}
function resume() {
  if (loading || !renderer) return;
  returnToPause = false;
  closeDialogs();
  paused = false;
  accumulator = 0;
  input.setEnabled(true);
  focusArena();
  audio.unlock();
}
function togglePause() {
  if (paused && $<HTMLDialogElement>("#pause").open) resume();
  else if (!paused) pauseGame();
}
function cycleCamera() {
  const modes = ["chase", "ball", "overview"] as const;
  settings.camera = modes[(modes.indexOf(settings.camera) + 1) % modes.length];
  persist();
  if (running && !paused) focusArena();
}
function updateCameraLabel() {
  $("#camera-button").textContent =
    `Câmera: ${{ chase: "carro", ball: "bola", overview: "arena" }[settings.camera]} [C]`;
}
function updateHud() {
  $("#device").textContent = input.deviceLabel;
  $(".connection").classList.toggle("connected", input.gamepadConnected);
  $("#renderer-label").textContent = renderer
    ? "3D / WEBGL 2"
    : "3D INDISPONÍVEL";
  if (!running) return;
  $("#player-score").textContent = String(state.score[0]);
  $("#bot-score").textContent =
    state.mode === "training" ? "—" : String(state.score[1]);
  const seconds = Math.ceil(Math.max(0, state.timeRemaining));
  $("#clock").textContent =
    state.mode === "training"
      ? "∞"
      : state.overtime
        ? "+OT"
        : `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
  $("#mode-label").textContent =
    state.mode === "training"
      ? "TREINO LIVRE"
      : state.overtime
        ? "GOL DE OURO"
        : "DUELO";
  const message =
    state.phase === "kickoff"
      ? String(Math.max(1, Math.ceil(state.phaseTime)))
      : state.phase === "goal"
        ? state.lastGoal === 0
          ? "GOLAÇO!"
          : "GOL DO BOT"
        : "";
  if (message !== lastAnnouncement) {
    $("#announcement").textContent = message;
    lastAnnouncement = message;
  }
  $("#speed").textContent = String(
    Math.round(
      Math.hypot(
        state.player.velocity.x,
        state.player.velocity.y,
        state.player.velocity.z,
      ) * 3.6,
    ),
  );
  $("#driving-state").textContent = !state.player.grounded
    ? `NO AR · ${state.player.position.y.toFixed(1)} m`
    : state.player.surfaceNormal.y < 0.7
      ? "NA PAREDE"
      : state.player.supersonic
        ? "SUPERSÔNICO"
        : "NO CHÃO";
  $("#boost-value").textContent =
    state.mode === "training" ? "∞" : String(Math.ceil(state.player.boost));
  $<HTMLMeterElement>("#boost").value = state.player.boost;
  $("#status").textContent = paused
    ? "PARTIDA PAUSADA"
    : state.mode === "training"
      ? "TREINO LIVRE · R PARA REPOSICIONAR"
      : "TERMINAL ARENA · DUELO LOCAL";
}

document
  .querySelectorAll<HTMLElement>("[data-open]")
  .forEach((button) =>
    button.addEventListener("click", () => openDialog(button.dataset.open!)),
  );
document
  .querySelectorAll<HTMLElement>("[data-close]")
  .forEach((button) =>
    button.addEventListener("click", () => button.closest("dialog")?.close()),
  );
for (const id of ["garage", "settings", "help"]) {
  $<HTMLDialogElement>(`#${id}`).addEventListener("close", () => {
    if (returnToPause && running && paused) {
      returnToPause = false;
      $<HTMLDialogElement>("#pause").showModal();
    }
  });
}
$<HTMLDialogElement>("#pause").addEventListener("cancel", (event) => {
  event.preventDefault();
  resume();
});
$<HTMLDialogElement>("#result").addEventListener("cancel", (event) => {
  event.preventDefault();
  goHome();
});
document
  .querySelectorAll<HTMLInputElement | HTMLSelectElement>("[data-setting]")
  .forEach((element) =>
    element.addEventListener("change", () => {
      const key = element.dataset.setting as keyof Settings;
      const value =
        element instanceof HTMLInputElement && element.type === "checkbox"
          ? element.checked
          : ["duration", "volume", "deadzone", "sensitivity"].includes(key)
            ? Number(element.value)
            : element.value;
      settings = { ...settings, [key]: value };
      persist();
      if (key === "quality") void rebuildRenderer();
    }),
  );
document.querySelectorAll<HTMLElement>("[data-model]").forEach((button) =>
  button.addEventListener("click", () => {
    settings.model = button.dataset.model as Settings["model"];
    persist();
  }),
);
document.querySelectorAll<HTMLElement>("[data-color]").forEach((button) =>
  button.addEventListener("click", () => {
    settings.color = button.dataset.color!;
    persist();
  }),
);
$("#start-duel").addEventListener("click", () => start("duel"));
$("#start-training").addEventListener("click", () => start("training"));
$("#home").addEventListener("click", (event) => {
  event.preventDefault();
  if (running) pauseGame();
  else goHome();
});
$("#nav-play").addEventListener("click", () => $("#start-duel").focus());
$("#pause-button").addEventListener("click", pauseGame);
$("#resume").addEventListener("click", resume);
$("#quit").addEventListener("click", goHome);
$("#camera-button").addEventListener("click", cycleCamera);
$("#pause-settings").addEventListener("click", () => openDialog("settings"));
$("#rematch").addEventListener("click", () => start(state.mode));
$("#result-home").addEventListener("click", goHome);
$("#restore-settings").addEventListener("click", () => {
  settings = { ...DEFAULT_SETTINGS };
  persist();
  void rebuildRenderer();
});
$("#fullscreen").addEventListener("click", async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else if (document.documentElement.requestFullscreen)
      await document.documentElement.requestFullscreen();
    else toast("Tela cheia não está disponível neste navegador.");
  } catch {
    toast("O navegador não permitiu entrar em tela cheia.");
  }
  if (running && !paused) focusArena();
});
window.addEventListener("blur", pauseGame);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) pauseGame();
});
window.addEventListener("resize", () => renderer?.resize());

let previous = performance.now();
let hudTimer = 0;
let fpsTime = 0;
let frames = 0;
let frameHandle = 0;
function frame(now: number) {
  const realDelta = Math.max(0, (now - previous) / 1000);
  const dt = Math.min(realDelta, 0.1);
  previous = now;
  const controls = input.poll(settings);
  if (running && !paused && !loading && state.phase !== "finished") {
    accumulator = Math.min(accumulator + dt, 8 / 120);
    const oldHits = state.hits;
    const oldPhase = state.phase;
    for (let steps = 0; accumulator >= 1 / 120 && steps < 8; steps++) {
      stepGame(state, controls, settings, 1 / 120);
      accumulator -= 1 / 120;
    }
    if (state.hits > oldHits) audio.play("hit", settings.volume);
    if (state.phase === "goal" && oldPhase !== "goal")
      audio.play("goal", settings.volume);
    if (state.phase === "playing" && oldPhase === "kickoff")
      audio.play("kickoff", settings.volume);
    if ((state.phase as string) === "finished") {
      input.setEnabled(false);
      $("#result-title").textContent =
        state.score[0] > state.score[1] ? "A arena é sua." : "A próxima é sua.";
      $("#result-score").textContent = `${state.score[0]} — ${state.score[1]}`;
      $("#result-copy").textContent =
        state.score[0] > state.score[1]
          ? "Vitória! Belo trabalho ao volante."
          : "Ajuste sua estratégia e volte para o campo.";
      $<HTMLDialogElement>("#result").showModal();
    }
  } else accumulator = 0;
  if (!document.hidden && !loading)
    renderer?.render(state, settings, paused ? 0 : dt, !running);
  hudTimer += dt;
  fpsTime += realDelta;
  frames++;
  if (hudTimer >= 0.1) {
    updateHud();
    hudTimer = 0;
  }
  if (fpsTime >= 1) {
    $("#fps").textContent = `${Math.round(frames / fpsTime)} FPS`;
    frames = 0;
    fpsTime = 0;
  }
  frameHandle = requestAnimationFrame(frame);
}
syncSettings();
void rebuildRenderer();
frameHandle = requestAnimationFrame(frame);
window.addEventListener("pagehide", (event) => {
  if (event.persisted) {
    pauseGame();
    return;
  }
  cancelAnimationFrame(frameHandle);
  renderer?.dispose();
  input.dispose();
  audio.dispose();
});

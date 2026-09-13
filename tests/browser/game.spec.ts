import { test, expect } from "@playwright/test";

test("sem WebGL mostra erro recuperavel e impede iniciar arena invisivel", async ({
  page,
}, info) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
      ...args: Parameters<typeof original>
    ) {
      if (String(args[0]).startsWith("webgl")) return null;
      return original.apply(this, args);
    } as typeof original;
  });
  await page.goto("./");
  await expect(page.locator("#graphics-error")).toBeVisible();
  await expect(page.locator("#start-training")).toBeDisabled();
  await page.locator("#retry-graphics").click();
  await expect(page.locator("#graphics-error")).toBeVisible();
  await expect(page.locator("canvas")).toHaveCount(1);
});

// Um motor sem GPU deve validar o erro, sem fingir uma partida renderizada.
async function ready(page: import("@playwright/test").Page, engine: string) {
  await expect
    .poll(
      async () =>
        (await page.locator("#start-training").isEnabled()) ||
        (await page.locator("#graphics-error").isVisible()),
    )
    .toBe(true);
  if (await page.locator("#graphics-error").isVisible()) {
    test.skip(
      engine !== "chromium",
      "WebGL 2 indisponivel neste ambiente; erro validado em teste dedicado",
    );
  }
  await expect(page.locator("#start-training")).toBeEnabled();
  await expect(page.locator("#renderer-label")).toHaveText("3D / WEBGL 2");
}

test("garagem, treino, movimento, pausa e preferências persistidas", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("./");
  await ready(page, info.project.name);
  await expect(
    page.getByRole("button", { name: "ENTRAR NA ARENA" }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "GARAGEM", exact: true }).click();
  await page.locator('[data-model="rally"]').click();
  await page.getByRole("button", { name: "Coral", exact: true }).click();
  await expect(page.locator('[data-model="rally"]')).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.getByRole("button", { name: "PRONTO PARA JOGAR" }).click();
  await expect(page.locator("#selected-car")).toHaveText("Rally");
  if (info.project.name === "chromium") {
    await page.screenshot({ path: info.outputPath("menu.png") });
  }
  await page.getByRole("button", { name: "TREINO LIVRE", exact: true }).click();
  await expect(page.locator("#hud")).toBeVisible();
  await expect(page.locator("#mode-label")).toHaveText("TREINO LIVRE");
  await page.keyboard.down("w");
  await expect
    .poll(async () => Number(await page.locator("#speed").textContent()))
    .toBeGreaterThan(10);
  await page.keyboard.up("w");
  await page.keyboard.down("Space");
  await expect(page.locator("#driving-state")).toContainText("NO AR");
  await page.keyboard.up("Space");
  await page.keyboard.press("c");
  await expect(page.locator("#camera-button")).toContainText("bola");
  if (info.project.name === "chromium")
    await page.screenshot({ path: info.outputPath("partida.png") });
  await page.keyboard.press("Escape");
  await expect(page.locator("#pause")).toBeVisible();
  await page
    .getByRole("button", { name: "CONFIGURAÇÕES", exact: true })
    .click();
  await page.locator('[data-setting="quality"]').selectOption("low");
  await page.getByRole("button", { name: "CONCLUÍDO" }).click();
  await expect(page.locator("#pause")).toBeVisible();
  await page.getByRole("button", { name: "VOLTAR AO JOGO" }).click();
  await expect(page.locator("#renderer-label")).toHaveText("3D / WEBGL 2");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "SAIR PARA O MENU" }).click();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "ENTRAR NA ARENA" }),
  ).toBeEnabled();
  await expect(page.locator("#selected-car")).toHaveText("Rally");
  await expect(page.locator("#renderer-label")).toHaveText("3D / WEBGL 2");
  expect(errors).toEqual([]);
});

test("duelo tem contagem, cronômetro e pausa ao perder foco", async ({
  page,
}, info) => {
  await page.addInitScript(() =>
    localStorage.setItem(
      "soccer-car.settings.v1",
      JSON.stringify({ quality: "low", duration: 60 }),
    ),
  );
  await page.goto("./");
  await ready(page, info.project.name);
  await page.getByRole("button", { name: "ENTRAR NA ARENA" }).click();
  await expect(page.locator("#announcement")).toHaveText("3");
  await expect(page.locator("#announcement")).toHaveText("", {
    timeout: 10_000,
  });
  await expect(page.locator("#clock")).toHaveText("0:59", { timeout: 5000 });
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  await expect(page.locator("#pause")).toBeVisible();
  const time = await page.locator("#clock").textContent();
  await page.waitForTimeout(1200);
  await expect(page.locator("#clock")).toHaveText(time!);
});

test("controle virtual é detectado e acelera pelo gatilho", async ({
  page,
}, info) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      "soccer-car.settings.v1",
      JSON.stringify({ quality: "low" }),
    );
    const buttons = Array.from({ length: 17 }, () => ({
      pressed: false,
      touched: false,
      value: 0,
    }));
    const pad = {
      id: "Controle de teste padrão",
      index: 0,
      connected: true,
      mapping: "standard",
      axes: [0, 0, 0, 0],
      buttons,
      timestamp: 0,
    };
    Object.defineProperty(navigator, "getGamepads", { value: () => [pad] });
    Object.assign(window, { testPad: pad });
  });
  await page.goto("./");
  await ready(page, info.project.name);
  await page.getByRole("button", { name: "TREINO LIVRE", exact: true }).click();
  await expect(page.locator(".connection")).toHaveClass(/connected/);
  await page.evaluate(() => {
    const pad = (
      window as unknown as {
        testPad: { buttons: { pressed: boolean; value: number }[] };
      }
    ).testPad;
    pad.buttons[7] = { pressed: true, value: 1 };
  });
  await expect
    .poll(async () => Number(await page.locator("#speed").textContent()))
    .toBeGreaterThan(10);
});

test("layout de celular e controles de toque funcionam em 3D", async ({
  browser,
}, info) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
  });
  const page = await context.newPage();
  await page.addInitScript(() =>
    localStorage.setItem(
      "soccer-car.settings.v1",
      JSON.stringify({ quality: "low" }),
    ),
  );
  await page.goto("./");
  await ready(page, info.project.name);
  await expect(
    page.getByRole("button", { name: "ENTRAR NA ARENA" }),
  ).toBeEnabled();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  if (info.project.name === "chromium")
    await page.screenshot({
      path: info.outputPath("celular.png"),
      fullPage: true,
    });
  await page.getByRole("button", { name: "TREINO LIVRE", exact: true }).tap();
  const forward = page.getByRole("button", { name: "Acelerar", exact: true });
  await expect(forward).toBeVisible();
  const bounds = await forward.boundingBox();
  await page.mouse.move(
    bounds!.x + bounds!.width / 2,
    bounds!.y + bounds!.height / 2,
  );
  await page.mouse.down();
  await expect
    .poll(async () => Number(await page.locator("#speed").textContent()))
    .toBeGreaterThan(10);
  await page.mouse.up();
  await page.getByRole("button", { name: "Pausar [Esc]" }).tap();
  await expect(page.locator("#pause")).toBeVisible();
  await context.close();
});

test("perda de contexto pausa e permite reconstruir a arena 3D", async ({
  page,
}, info) => {
  await page.goto("./");
  await ready(page, info.project.name);
  await page.locator("#start-training").click();
  await page.evaluate(() => {
    const canvas = document.querySelector<HTMLCanvasElement>("#arena")!;
    const extension = canvas
      .getContext("webgl2")!
      .getExtension("WEBGL_lose_context");
    if (!extension)
      throw new Error("Extensao de perda de contexto indisponivel");
    extension.loseContext();
  });
  await expect(page.locator("#graphics-error")).toBeVisible();
  await page.locator("#retry-graphics").click();
  await expect(page.locator("#graphics-error")).toBeHidden();
  await expect(page.locator("#pause")).toBeVisible();
  await page.locator("#resume").click();
  await page.keyboard.down("w");
  await expect
    .poll(async () => Number(await page.locator("#speed").textContent()))
    .toBeGreaterThan(10);
  await page.keyboard.up("w");
  await expect(page.locator("canvas")).toHaveCount(1);
});

test("preferencia 2D antiga migra para 3D e armazenamento bloqueado permite jogar", async ({
  page,
}, info) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      "soccer-car.settings.v1",
      JSON.stringify({ quality: "2d" }),
    );
    Storage.prototype.setItem = () => {
      throw new DOMException("Bloqueado", "SecurityError");
    };
  });
  await page.goto("./");
  await ready(page, info.project.name);
  await page
    .getByRole("button", { name: "Configura\u00e7\u00f5es", exact: true })
    .click();
  await expect(page.locator('[data-setting="quality"]')).toHaveValue("auto");
  await page.locator('[data-setting="quality"]').selectOption("low");
  await expect(page.locator("#storage-note")).toContainText("bloqueou");
  await page.locator("#settings [data-close]").first().click();
  await ready(page, info.project.name);
  await page.locator("#start-training").click();
  await expect(page.locator("#hud")).toBeVisible();
});

test("carro sobe a parede e salta de volta na arena 3D", async ({
  page,
}, info) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 960, height: 600 });
  await page.addInitScript(() =>
    localStorage.setItem(
      "soccer-car.settings.v1",
      JSON.stringify({ quality: "low" }),
    ),
  );
  await page.goto("./");
  await ready(page, info.project.name);
  await page.locator("#start-training").click();
  await page.clock.install({ time: new Date("2026-01-01T00:00:00Z") });
  await page.clock.pauseAt(new Date("2026-01-01T00:00:01Z"));
  await page.keyboard.down("w");
  await page.clock.runFor(1000);
  await page.keyboard.down("d");
  await page.clock.runFor(700);
  await page.keyboard.up("d");
  let wall = false;
  for (let i = 0; i < 24; i++) {
    await page.clock.runFor(250);
    if (
      (await page.locator("#driving-state").textContent())?.includes(
        "NA PAREDE",
      )
    ) {
      wall = true;
      break;
    }
  }
  expect(wall, "carro precisa entrar em contato com a parede").toBe(true);
  if (info.project.name === "chromium")
    await page.screenshot({ path: info.outputPath("parede.png") });
  await page.keyboard.up("w");
  await page.keyboard.down("Space");
  await page.clock.runFor(150);
  await page.keyboard.up("Space");
  await expect(page.locator("#driving-state")).toContainText("NO AR");
  await page.keyboard.down("e");
  await page.clock.runFor(200);
  await page.keyboard.up("e");
  if (info.project.name === "chromium")
    await page.screenshot({ path: info.outputPath("aereo.png") });
});

import { test, expect } from "@playwright/test";

test("sem WebGL e sem armazenamento o treino continua jogável", async ({
  page,
}) => {
  const resources: string[] = [];
  page.on("request", (request) => resources.push(request.url()));
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
      ...args: Parameters<typeof original>
    ) {
      if (String(args[0]).startsWith("webgl")) return null;
      return original.apply(this, args);
    } as typeof original;
    Storage.prototype.setItem = () => {
      throw new DOMException("Armazenamento bloqueado", "SecurityError");
    };
  });
  await page.goto("./");
  await page.getByRole("button", { name: "TREINO LIVRE", exact: true }).click();
  await expect(page.locator("#renderer-label")).toHaveText("MODO 2D");
  await page.keyboard.down("w");
  await expect
    .poll(async () => Number(await page.locator("#speed").textContent()))
    .toBeGreaterThan(10);
  await page.keyboard.up("w");
  await page.keyboard.press("c");
  await expect(page.locator("#camera-button")).toContainText("bola");
  expect(resources.some((url) => /three-api-.*\.js/.test(url))).toBe(false);
});

test("garagem, treino, movimento, pausa e preferências persistidas", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("./");
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
  await page.keyboard.press("Space");
  await page.keyboard.press("c");
  await expect(page.locator("#camera-button")).toContainText("bola");
  if (info.project.name === "chromium")
    await page.screenshot({ path: info.outputPath("partida.png") });
  await page.keyboard.press("Escape");
  await expect(page.locator("#pause")).toBeVisible();
  await page
    .getByRole("button", { name: "CONFIGURAÇÕES", exact: true })
    .click();
  await page.locator('[data-setting="quality"]').selectOption("2d");
  await page.getByRole("button", { name: "CONCLUÍDO" }).click();
  await expect(page.locator("#pause")).toBeVisible();
  await page.getByRole("button", { name: "VOLTAR AO JOGO" }).click();
  await expect(page.locator("#renderer-label")).toHaveText("MODO 2D");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "SAIR PARA O MENU" }).click();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "ENTRAR NA ARENA" }),
  ).toBeEnabled();
  await expect(page.locator("#selected-car")).toHaveText("Rally");
  await expect(page.locator("#renderer-label")).toHaveText("MODO 2D");
  expect(errors).toEqual([]);
});

test("duelo tem contagem, cronômetro e pausa ao perder foco", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem(
      "soccer-car.settings.v1",
      JSON.stringify({ quality: "2d", duration: 60 }),
    ),
  );
  await page.goto("./");
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
}) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      "soccer-car.settings.v1",
      JSON.stringify({ quality: "2d" }),
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

test("layout de celular e controles de toque funcionam em 2D", async ({
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
      JSON.stringify({ quality: "2d" }),
    ),
  );
  await page.goto("./");
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

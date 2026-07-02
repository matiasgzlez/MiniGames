#!/usr/bin/env node
/**
 * QA interactivo de Turbo Arena: juega de verdad (arranca partido, maneja,
 * boostea, hace dodge, alterna cámara) y captura screenshots + diagnósticos
 * del renderer en cada paso. Basado en el flujo del skill threejs-qa-release.
 *
 * Uso: node scripts/qa-rocket-arena.mjs [--url URL] [--out DIR] [--mobile]
 */
import { chromium, devices } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { writeFile } from "node:fs/promises";
import path from "node:path";

const args = { url: "http://localhost:5177/games/rocket-arena/?debug", out: "artifacts/qa-rocket-arena", mobile: false };
for (let i = 2; i < process.argv.length; i++) {
  const v = process.argv[i];
  if (v === "--url") args.url = process.argv[++i];
  else if (v === "--out") args.out = process.argv[++i];
  else if (v === "--mobile") args.mobile = true;
}

await mkdir(args.out, { recursive: true });
const browser = await chromium.launch();
const context = args.mobile
  ? await browser.newContext({ ...devices["iPhone 13"] })
  : await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await context.newPage();

const consoleErrors = [];
const pageErrors = [];
page.on("console", (msg) => {
  if (msg.type() === "error") consoleErrors.push(msg.text());
});
page.on("pageerror", (err) => pageErrors.push(String(err)));

const shot = (name) => page.screenshot({ path: path.join(args.out, `${name}.png`) });
const gameState = () => page.evaluate(() => window.__ta?.state() ?? null);
const rendererInfo = () =>
  page.evaluate(() => ({ render: window.__ta?.info() ?? null, memory: window.__ta?.memory() ?? null }));

await page.goto(args.url, { waitUntil: "networkidle" });
await page.waitForTimeout(2500); // WASM de Rapier + primera escena
await shot("01-start");

const report = { url: args.url, mobile: args.mobile, steps: [] };

if (args.mobile) {
  // Mobile: verificar botones táctiles y arrancar con tap.
  const pad = page.locator(".touch-pad");
  report.touchPadVisible = await pad.isVisible().catch(() => false);
  await page.tap("text=Medio");
  await page.waitForTimeout(4000); // countdown 3s
  await shot("02-play");
  const gas = page.locator(".touch-btn.touch-gas");
  report.gasVisible = await gas.isVisible().catch(() => false);
  if (report.gasVisible) {
    const box = await gas.boundingBox();
    await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
  }
  await page.waitForTimeout(1000);
  await shot("03-touch-gas");
  report.state = await gameState();
} else {
  await page.click("text=Medio");
  await page.waitForTimeout(4000); // countdown 3s + ¡YA!
  report.steps.push({ step: "kickoff", state: await gameState() });
  await shot("02-kickoff");

  // Manejar hacia la pelota con turbo (W + click sostenido sobre el canvas).
  await page.keyboard.down("w");
  await page.mouse.move(640, 360);
  await page.mouse.down();
  await page.waitForTimeout(1400);
  await shot("03-boost-supersonic");
  report.steps.push({ step: "boost", state: await gameState(), renderer: await rendererInfo() });
  await page.mouse.up();

  // Salto + click en el aire = voltereta hacia adelante.
  await page.keyboard.press(" ");
  await page.waitForTimeout(200);
  await page.mouse.down();
  await page.waitForTimeout(180);
  await shot("04-dodge-flip");
  await page.mouse.up();
  report.steps.push({ step: "dodge", state: await gameState() });

  // Derrape con Shift.
  await page.keyboard.down("Shift");
  await page.keyboard.down("d");
  await page.waitForTimeout(700);
  await shot("05-drift");
  await page.keyboard.up("Shift");
  await page.keyboard.up("d");

  // Toggle de cámara clásica.
  await page.keyboard.press("e");
  await page.waitForTimeout(800);
  await shot("06-car-cam");
  await page.keyboard.press("e");

  // Aéreo: salto, S (trompa arriba) + turbo.
  await page.keyboard.press(" ");
  await page.waitForTimeout(150);
  await page.keyboard.down("s");
  await page.mouse.down();
  await page.waitForTimeout(900);
  await shot("07-aerial");
  await page.mouse.up();
  await page.keyboard.up("s");
  await page.keyboard.up("w");
  report.steps.push({ step: "aerial", state: await gameState(), renderer: await rendererInfo() });

  // HUD: leer medidor de boost y reloj.
  report.hud = {
    boost: await page.locator(".boost-meter__num").textContent().catch(() => null),
    time: await page.locator(".score-time").textContent().catch(() => null),
    score: await page.locator(".scoreboard").textContent().catch(() => null),
  };
}

report.consoleErrors = consoleErrors;
report.pageErrors = pageErrors;
await writeFile(path.join(args.out, "report.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
await browser.close();

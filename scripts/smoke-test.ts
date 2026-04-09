import { spawn, type ChildProcess } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { chromium } from "playwright";
import { loadLocalEnv } from "./load-env";

loadLocalEnv();

const PORT = 3005;
const REMOTE_BASE_URL = process.env.SMOKE_BASE_URL?.trim() || null;
const BASE_URL = REMOTE_BASE_URL ?? `http://127.0.0.1:${PORT}`;

function requireEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} is not configured.`);
  }

  return value;
}

async function waitForServer(url: string, attempts = 60): Promise<void> {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
    } catch {
      // ignore while server boots
    }

    await delay(1000);
  }

  throw new Error(`Server did not become ready at ${url}`);
}

async function stopServer(server: ChildProcess) {
  if (server.exitCode !== null || server.killed) {
    return;
  }

  if (process.platform === "win32" && server.pid) {
    const shell = process.env.ComSpec ?? "cmd.exe";
    const killer = spawn(shell, ["/d", "/s", "/c", `taskkill /PID ${server.pid} /T /F`], {
      stdio: "ignore",
    });

    await Promise.race([
      new Promise<void>((resolve) => killer.once("exit", () => resolve())),
      delay(5000).then(() => undefined),
    ]);
    return;
  }

  server.kill();
  await Promise.race([
    new Promise<void>((resolve) => server.once("exit", () => resolve())),
    delay(5000).then(() => undefined),
  ]);
}

async function savePrices(page: import("playwright").Page) {
  const responsePromise = page.waitForResponse(
    (response) =>
      response.url().includes("/api/admin/prices") && response.request().method() === "POST",
    { timeout: 120000 }
  );

  await page.getByRole("button", { name: /Save all/ }).click();
  const response = await responsePromise;

  if (!response.ok()) {
    throw new Error(`[smoke] Price save failed with status ${response.status()}.`);
  }

  await page.getByText(/price update\(s\) saved/i).waitFor({ timeout: 120000 });
}

async function main() {
  const adminEmail = requireEnv("ADMIN_EMAIL");
  const adminPassword = requireEnv("ADMIN_PASSWORD");
  const serverCommand = process.platform === "win32" ? process.env.ComSpec ?? "cmd.exe" : "npm";
  const serverArgs =
    process.platform === "win32"
      ? ["/d", "/s", "/c", `npm start -- -p ${PORT}`]
      : ["start", "--", "-p", String(PORT)];

  const server = REMOTE_BASE_URL
    ? null
    : spawn(serverCommand, serverArgs, {
        stdio: ["ignore", "pipe", "pipe"],
        env: process.env,
      });

  server?.stdout.on("data", (chunk) => process.stdout.write(chunk));
  server?.stderr.on("data", (chunk) => process.stderr.write(chunk));

  const browser = await chromium.launch({ headless: true });

  try {
    await waitForServer(BASE_URL);

    const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });

    await page.goto(BASE_URL, { waitUntil: "networkidle" });
    await page.getByText("Food rankings").waitFor();
    await page.getByRole("button", { name: "Vegetables" }).click();
    await page.waitForURL(/category=vegetables/);
    await page.getByRole("button", { name: "Protein-first" }).click();
    await page.waitForURL(/priority=protein_first/);

    const checkboxes = page.locator('input[type="checkbox"]');
    await checkboxes.nth(0).check();
    await checkboxes.nth(1).check();
    await page.getByRole("button", { name: /Compare \(2\)/ }).click();
    await page.getByRole("dialog", { name: "Compare foods" }).waitFor();
    await page.getByRole("button", { name: "Close comparison" }).click();

    await page.goto(`${BASE_URL}/admin`, { waitUntil: "networkidle" });
    await page.getByText("Eatlee Admin").waitFor();
    await page.locator('input[type="email"]').fill(adminEmail);
    await page.locator('input[type="password"]').fill(adminPassword);
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.getByText("Monthly price entry").waitFor();

    const priceInput = page.locator('tbody input[type="text"]').first();
    const originalValue = (await priceInput.inputValue()).trim();
    const nextValue = String(Number(originalValue) + 0.1);

    await priceInput.fill(nextValue);
    await savePrices(page);

    await priceInput.fill(originalValue);
    await savePrices(page);

    console.log("[smoke] Public browse/filter/compare and admin price update passed.");
  } finally {
    await browser.close();

    if (server) {
      await stopServer(server);
    }
  }
}

main().catch((error) => {
  console.error("[smoke] Fatal error", error);
  process.exit(1);
});

import { After, AfterStep, Before } from "@wdio/cucumber-framework";
import { browser, driver } from "@wdio/globals";

const APP_PKG = "com.urpipro";
const CHROME_PKG = "com.android.chrome";
const TARGET = (process.env.TARGET || "ios").toLowerCase();
const SCREENSHOT_MODE = (process.env.SCREENSHOT_MODE || "always").toLowerCase();

async function keyevent(code: number) {
  await driver.execute("mobile: shell", {
    command: "input",
    args: ["keyevent", String(code)],
  });
}

async function forceStop(pkg: string) {
  await driver.execute("mobile: shell", {
    command: "am",
    args: ["force-stop", pkg],
  });
}

Before(async function () {
  if (TARGET !== "android") return;

  try {
    await forceStop(CHROME_PKG);
  } catch (_) {}

  try {
    await forceStop(APP_PKG);
  } catch (_) {}

  try {
    await driver.pause(500);
  } catch (_) {}

  try {
    await browser.activateApp(APP_PKG);
    await browser.switchContext("NATIVE_APP");
  } catch (_) {}
});

After(async function () {
  if (TARGET !== "android") return;

  try {
    await browser.switchContext("NATIVE_APP");
  } catch (_) {}

  try {
    await driver.back();
    await driver.pause(300);
  } catch (_) {}

  try {
    await keyevent(3);
    await driver.pause(300);
  } catch (_) {}

  try {
    await forceStop(CHROME_PKG);
  } catch (_) {}

  try {
    await forceStop(APP_PKG);
  } catch (_) {}
});

function shouldCaptureStep(result: unknown): boolean {
  if (SCREENSHOT_MODE === "off") return false;
  if (SCREENSHOT_MODE === "always") return true;
  return Boolean(result && (result as any).passed === false);
}

AfterStep(async function ({ result }) {
  if (!shouldCaptureStep(result)) return;

  try {
    const png = await browser.takeScreenshot();
    await this.attach(Buffer.from(png, "base64"), "image/png");
  } catch (e: any) {
    await this.attach(
      `No se pudo capturar screenshot: ${e?.message || e}`,
      "text/plain",
    );
  }
});

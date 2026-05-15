/// <reference types="@wdio/globals/types" />

import * as fs from "fs";
import * as path from "path";
import { execSync } from "node:child_process";

const isCI = process.env.CI === "true";
const cucumberTags = normalizeTagsExpr(process.env.TAGS || "");

// Select target via env var: TARGET=ios | TARGET=android (default: android)
const TARGET = (process.env.TARGET || "android").toLowerCase();
const CHROMEDRIVER_DIR = path.resolve(
  __dirname,
  "node_modules/.cache/appium/chromedrivers",
);

// === Ubicación de features (SIEMPRE preferir generados) ====================
const FEATURES_OUT =
  process.env.FEATURES_OUT || "features/support/.features_gen";
const FEATURES_SRC = process.env.FEATURES_SRC || "features";

// Si existe .features_gen, SOLO corre desde ahí. Si no existe, corre desde features/
const USE_GENERATED = fs.existsSync(FEATURES_OUT);
const FEATURES_DIR = USE_GENERATED ? FEATURES_OUT : FEATURES_SRC;
// ==========================================================================

function normalizeTagsExpr(raw: string): string {
  return (raw || "").trim().replace(/^["']|["']$/g, "");
}

function firstTag(tagsExpr: string): string {
  const t = normalizeTagsExpr(tagsExpr);
  return (t.split(/\s+/)[0] || "").trim();
}

function isGenericTag(tag: string): boolean {
  const generic = new Set(["@urpipro", "@ios", "@android"]);
  return generic.has(tag.toLowerCase());
}

function findFeatureByName(
  rootDir: string,
  featureBaseName: string,
): string | null {
  const target = `${featureBaseName}.feature`.toLowerCase();

  const stack: string[] = [rootDir];
  while (stack.length) {
    const dir = stack.pop()!;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) stack.push(full);
      else if (e.isFile() && e.name.toLowerCase() === target) return full;
    }
  }
  return null;
}

function walkFeatureFiles(rootDir: string): string[] {
  const files: string[] = [];
  const stack: string[] = [rootDir];

  while (stack.length) {
    const dir = stack.pop()!;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) stack.push(full);
      else if (e.isFile() && e.name.toLowerCase().endsWith(".feature")) {
        files.push(full);
      }
    }
  }

  return files;
}

function findFeaturesByTag(rootDir: string, tag: string): string[] {
  const escaped = tag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const tagPattern = new RegExp(`(^|\\s)${escaped}(\\s|$)`, "m");

  return walkFeatureFiles(rootDir).filter((file) => {
    try {
      return tagPattern.test(fs.readFileSync(file, "utf8"));
    } catch {
      return false;
    }
  });
}

/**
 * ✅ Decide los specs ANTES de que WDIO cree workers, usando TAGS.
 */
function computeSpecs(): string[] {
  const tagsExpr = normalizeTagsExpr(process.env.TAGS || "");
  const tag = firstTag(tagsExpr);

  const globSpecs = [path.join(FEATURES_DIR, "**/*.feature")];

  if (!tag || isGenericTag(tag)) return globSpecs;

  const featureName = tag.replace("@", "");
  const picked = findFeatureByName(FEATURES_DIR, featureName);

  if (picked) return [picked]; // fuerza 1 spec => 1 worker práctico
  const tagged = findFeaturesByTag(FEATURES_DIR, tag);
  if (tagged.length) return tagged;

  return globSpecs;
}

function iosCaps(): WebdriverIO.Capabilities {
  return {
    platformName: "iOS",
    "appium:automationName": "XCUITest",
    "appium:deviceName": "iPhone 16 Pro",
    "appium:platformVersion": "18.6",
    "appium:app": "./apps/ios/sample-app.zip",
    "appium:newCommandTimeout": 240,
    "appium:noReset": false,
  };
}

function androidCiCaps(): WebdriverIO.Capabilities {
  return {
    platformName: "Android",
    "appium:automationName": "UiAutomator2",
    "appium:deviceName": "Android Emulator",
    "appium:platformVersion": "15",
    "appium:app": path.resolve(process.cwd(), "apps/android/urpipro.apk"),
    "appium:autoGrantPermissions": true,
    "appium:newCommandTimeout": 120,
    "appium:noReset": false,
    "appium:disableWindowAnimation": true,
  };
}

export function androidCaps(): WebdriverIO.Capabilities {
  if (isCI) return androidCiCaps();

  return {
    platformName: "Android",
    "appium:automationName": "UiAutomator2",
    "appium:deviceName": "emulator-5554",
    "appium:udid": "emulator-5554",
    "appium:platformVersion": "12",
    "appium:app": path.resolve(__dirname, "apps/android/urpipro.apk"),
    "appium:appPackage": "com.urpipro",
    "appium:appActivity": ".MainActivity",
    // ✅ estabilidad UiAutomator2
    "appium:newCommandTimeout": 600,
    "appium:adbExecTimeout": 240000,
    "appium:uiautomator2ServerInstallTimeout": 240000,
    "appium:uiautomator2ServerLaunchTimeout": 240000,
    "appium:uiautomator2ServerReadTimeout": 240000,
    "appium:disableWindowAnimation": true,
    "appium:ignoreHiddenApiPolicyError": true,
    // ✅ permisos
    "appium:autoGrantPermissions": true,
    "appium:nativeWebScreenshot": true,
    // ✅ manejo de estado
    "appium:noReset": true,
    "appium:fullReset": false,
    "appium:dontStopAppOnReset": true,
    // ✅ WEBVIEW / Chromedriver
    "appium:chromedriverExecutableDir": CHROMEDRIVER_DIR,
    "appium:chromedriverDisableBuildCheck": false,
    "appium:enableWebviewDetailsCollection": true,
    "appium:ensureWebviewsHavePages": false,
    "appium:showChromedriverLog": true,
    "appium:autoWebview": false,
    "appium:webviewConnectTimeout": 240000,
    "appium:webviewConnectRetries": 10,
  } as any;
}

const onlyCaps = TARGET === "android" ? [androidCaps()] : [iosCaps()];

const ROOT = __dirname;
const REQUIRE_FILES = [
  path.resolve(ROOT, "features/step-definitions/**/*.ts"),
  path.resolve(ROOT, "features/support/**/*.ts"),
];

// ✅ aquí se decide ANTES de workers
const SPECS = computeSpecs();

function withHardTimeout<T>(
  p: Promise<T>,
  ms: number,
  label: string,
): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, rej) =>
      setTimeout(
        () => rej(new Error(`${label} HARD TIMEOUT after ${ms}ms`)),
        ms,
      ),
    ),
  ]);
}

const config: WebdriverIO.Config = {
  runner: "local",
  logLevel: "warn",
  hostname: "127.0.0.1",
  port: 4723,
  path: "/",

  specs: SPECS,
  exclude: USE_GENERATED
    ? [path.join(FEATURES_SRC, "**/*.feature")]
    : [path.join(FEATURES_OUT, "**/*.feature")],

  maxInstances: 1,
  capabilities: onlyCaps,

  framework: "cucumber",

  cucumberOpts: {
    require: REQUIRE_FILES,
    requireModule: ["ts-node/register/transpile-only"],
    timeout: 180_000,
    strict: true,
    tagsInTitle: true,
    tags: cucumberTags || undefined,
    tagExpression: cucumberTags || undefined,
  } as any,

  reporters: [
    ["spec", {}],
    [
      "allure",
      {
        outputDir: "allure-results",
        useCucumberStepReporter: true,
        disableWebdriverStepsReporting: true,
        disableWebdriverScreenshotsReporting: false,
      },
    ],
  ],

  waitforTimeout: 20_000,
  connectionRetryTimeout: 120_000,
  connectionRetryCount: 2,

  afterStep: async function (_step, _scenario, result) {
    if (TARGET !== "android") return;
    if (!result?.error) return;

    const m = String(result.error || "");
    const uia2Dead =
      m.includes("instrumentation process is not running") ||
      m.includes("cannot be proxied to UiAutomator2 server") ||
      m.includes("socket hang up") ||
      m.includes("ECONNRESET");

    if (!uia2Dead) return;

    console.warn("🛟 [RECOVERY] UiAutomator2 cayó. Reiniciando sesión...");

    try {
      await withHardTimeout(browser.reloadSession(), 60000, "reloadSession");
      await withHardTimeout(
        browser.activateApp("com.urpipro"),
        20000,
        "activateApp(after reload)",
      );
      try {
        await browser.switchContext("NATIVE_APP");
      } catch {}
      console.warn("✅ [RECOVERY] Sesión recuperada. Continuando...");
    } catch (e: any) {
      console.warn("❌ [RECOVERY] Falló la recuperación:", e?.message || e);
    }
  },

  onPrepare: function (wdioConfig, capabilities) {
    (wdioConfig as any).maxInstances = 1;
    (wdioConfig as any).maxInstancesPerCapability = 1;

    if (Array.isArray(capabilities)) {
      for (const cap of capabilities as any[]) {
        cap.maxInstances = 1;
      }
    }

    try {
      if (fs.existsSync("allure-results"))
        fs.rmSync("allure-results", { recursive: true, force: true });
      if (fs.existsSync("allure-report"))
        fs.rmSync("allure-report", { recursive: true, force: true });
    } catch (e: any) {
      console.warn(`[allure] No se pudo limpiar allure: ${e?.message || e}`);
    }
  },

  onComplete: async function () {
    if (TARGET === "ios") {
      try {
        execSync("xcrun simctl shutdown booted", { stdio: "ignore" });
      } catch {}
    }

    if ((process.env.GENERATE_WORD_REPORT || "true").toLowerCase() !== "false") {
      try {
        execSync("node features/support/generate-word-report.js", {
          stdio: "inherit",
        });
      } catch (e: any) {
        console.warn(
          `[word-report] No se pudo generar el reporte Word: ${e?.message || e}`,
        );
      }
    }

    try {
      if (fs.existsSync(FEATURES_OUT)) {
        fs.rmSync(FEATURES_OUT, { recursive: true, force: true });
        console.log(`[cleanup] Eliminado: ${FEATURES_OUT}`);
      }
    } catch (e: any) {
      console.warn(
        `[cleanup] No se pudo eliminar ${FEATURES_OUT}: ${e?.message || e}`,
      );
    }
  },
};

export { config };
export default config;

import { $, browser } from "@wdio/globals";

export type ElLike = string | any;

export function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function isSelector(v: any): v is string {
  return typeof v === "string";
}

async function resolveEl(v: ElLike): Promise<any> {
  if (!v) throw new Error("resolveEl: valor vacío");
  if (isSelector(v)) return await ($(v) as any);
  try {
    return await v;
  } catch {
    return v;
  }
}

async function withRetries<T>(fn: () => Promise<T>, retries = 2, delayMs = 350): Promise<T> {
  let last: any;
  for (let i = 0; i <= retries; i++) {
    try {
      return await fn();
    } catch (e: any) {
      last = e;
      if (i === retries) break;
      await sleep(delayMs);
    }
  }
  throw last;
}

/**
 * ✅ NO BACK.
 * ✅ NO performActions (W3C). Usamos mobile: clickGesture (más estable).
 */
export async function dismissKeyboardAndAutofill(): Promise<void> {
  const driverAny: any = (global as any).driver || browser;

  // hide keyboard best-effort
  try {
    await driverAny.hideKeyboard();
  } catch {}

  // tap afuera best-effort con clickGesture
  try {
    const { width, height } = await driverAny.getWindowSize();
    const x = Math.floor(width * 0.5);
    const y = Math.floor(height * 0.15);

    await browser.execute("mobile: clickGesture", { x, y });
  } catch {}
}

export async function safeFocus(elLike: ElLike, timeout = 20000) {
  const el = await resolveEl(elLike);

  try {
    await el.waitForDisplayed({ timeout });
  } catch {}

  try {
    await el.click();
    return;
  } catch {}

  try {
    const loc = await el.getLocation();
    const size = await el.getSize();
    const x = Math.round(loc.x + size.width / 2);
    const y = Math.round(loc.y + size.height / 2);
    await browser.execute("mobile: clickGesture", { x, y });
  } catch {}
}

export async function clearWebNoClear(elLike: ElLike) {
  const el = await resolveEl(elLike);
  try { await el.click(); } catch {}

  try {
    await browser.keys(["\uE009", "a"]); // CTRL + A
    await browser.keys(["\uE003"]);     // Backspace
    return;
  } catch {}

  try {
    const bs = Array.from({ length: 30 }, () => "\uE003");
    await browser.keys(bs);
  } catch {}
}

export async function setValueNativeStable(elLike: ElLike, value: string) {
  const el = await resolveEl(elLike);
  await safeFocus(el, 20000);
  await dismissKeyboardAndAutofill();

  await withRetries(async () => {
    try {
      await el.setValue(value);
      return;
    } catch {}
    await el.addValue(value);
  }, 1, 250);

  await dismissKeyboardAndAutofill();
}

export async function clickNativeByText(regex: string, timeout = 20000) {
  const sel = `android=new UiSelector().textMatches("${regex}")`;
  await withRetries(async () => {
    const el = await $(sel);
    await (el as any).waitForDisplayed({ timeout });
    await (el as any).click();
  }, 1, 300);
}

/**
 * Compatibilidad: clearAndType
 */
export async function clearAndType(
  elLike: ElLike,
  value: string,
  opts?: { timeout?: number; pressEnter?: boolean },
) {
  const timeout = opts?.timeout ?? 20000;
  const pressEnter = opts?.pressEnter ?? false;

  const el = await resolveEl(elLike);

  try { await el.waitForDisplayed({ timeout }); } catch {}
  await safeFocus(el, timeout);

  let ctx = "";
  try { ctx = String(await browser.getContext()).toUpperCase(); } catch {}

  if (ctx.includes("WEBVIEW") || ctx.includes("CHROMIUM")) {
    await dismissKeyboardAndAutofill();
    try { await clearWebNoClear(el); } catch {}

    try {
      await el.setValue(value);
    } catch {
      try {
        await browser.execute(
          `
          try {
            const el = arguments[0];
            const v  = arguments[1];
            if (el) {
              el.value = v;
              el.dispatchEvent(new Event('input',  { bubbles: true }));
              el.dispatchEvent(new Event('change', { bubbles: true }));
            }
          } catch (e) {}
          `,
          el as any,
          value,
        );
      } catch {
        try { await el.addValue(value); } catch {}
      }
    }

    if (pressEnter) {
      try { await browser.keys(["Enter"]); } catch {}
    }

    await dismissKeyboardAndAutofill();
    return;
  }

  await setValueNativeStable(el, value);

  if (pressEnter) {
    try { await browser.keys(["Enter"]); } catch {}
  }
}

export async function typeNumberNative(elLike: any, value: string, timeout = 20000) {
  await browser.switchContext("NATIVE_APP").catch(() => {});

  const el: any = await Promise.resolve(elLike);
  try { await el.waitForDisplayed({ timeout }); } catch {}

  // Click estable
  try {
    await browser.execute("mobile: clickGesture", { elementId: el.elementId });
  } catch {
    try { await el.click(); } catch {}
  }

  // Limpieza SIN clear(): backspaces
  try {
    // intenta seleccionar todo (a veces funciona)
    await browser.keys(["\uE009", "a"]).catch(() => {});
  } catch {}

  for (let i = 0; i < 12; i++) {
    try { await browser.keys(["\uE003"]); } catch {}
  }

  // Escribir (addValue suele ser más estable en nativo)
  try {
    await el.addValue(String(value));
  } catch {
    await el.setValue(String(value));
  }

  // Cierra teclado si estorba
  await browser.hideKeyboard().catch(() => {});
  await browser.pause(200);

  // Validación: intenta leer text actual
  const txt =
    (await el.getText().catch(() => "")) ||
    (await el.getAttribute("text").catch(() => "")) ||
    "";

  if (!String(txt).includes(String(value))) {
    // retry 1 vez
    try {
      await browser.execute("mobile: clickGesture", { elementId: el.elementId });
    } catch {}
    for (let i = 0; i < 12; i++) {
      try { await browser.keys(["\uE003"]); } catch {}
    }
    try { await el.addValue(String(value)); } catch { await el.setValue(String(value)); }
    await browser.hideKeyboard().catch(() => {});
  }
}


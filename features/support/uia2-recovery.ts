import { browser } from "@wdio/globals";

const isUia2Dead = (e: any) => {
  const msg = String((e && (e.message || e.stack)) || e || "");
  return (
    msg.includes("instrumentation process is not running") ||
    msg.includes("cannot be proxied to UiAutomator2 server") ||
    msg.includes("socket hang up") ||
    msg.includes("Could not proxy command to the remote server")
  );
};

async function recoverByReloadSession() {
  console.warn("🛟 [RECOVERY] UiAutomator2 cayó -> reloadSession + reabrir app");

  // 1) Lo único realmente confiable cuando muere instrumentation
  await browser.reloadSession();

  // 2) Reactivar app
  try {
    await browser.activateApp("com.urpipro");
  } catch {}

  // 3) Volver a NATIVE
  try {
    await browser.switchContext("NATIVE_APP");
  } catch {}

  // 4) Pequeña pausa para estabilizar el árbol UIA2
  await browser.pause(800);
}

export async function recoverSessionIfNeeded(e: any) {
  if (!isUia2Dead(e)) throw e;
  await recoverByReloadSession();
}

export async function safe<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e: any) {
    await recoverSessionIfNeeded(e);

    // reintento 1 vez (controlado)
    return await fn();
  }
}

import { $ } from "@wdio/globals";
import { safe } from "../../support/uia2-recovery";

class LoginPage {
  // ===== Selectores originales (NO CAMBIADOS) =====
  get loginText() {
    return $('android=new UiSelector().resourceIdMatches(".*login-text")');
  }

  get loginTextEs() {
    return $('android=new UiSelector().textContains("Iniciar sesión")');
  }

  get loginTextEn() {
    return $('android=new UiSelector().textContains("Sign in")');
  }

  private get btnIniciarSesion() {
    // usa texto visible (estable) y fallback por class/button
    return $('android=new UiSelector().textContains("Iniciar sesión")');
  }

  // ===== Helper interno para detectar crash de UiAutomator2 =====
  private isUia2Dead(e: any) {
    const msg = String(e?.message || e || "").toLowerCase();
    return (
      msg.includes("instrumentation process is not running") ||
      msg.includes("cannot be proxied to uiautomator2 server") ||
      msg.includes("socket hang up")
    );
  }

  // ===== Helper seguro para no tragar crash =====
  private async displayedOrThrow(el: ReturnType<typeof $>): Promise<boolean> {
    try {
      return await el.isDisplayed();
    } catch (e: any) {
      if (this.isUia2Dead(e)) throw e;
      return false;
    }
  }

  // ===== Espera robusta de pantalla login =====
  async waitForLoginScreen(timeout = 30000) {
    await browser.waitUntil(
      async () =>
        (await this.displayedOrThrow(this.loginText)) ||
        (await this.displayedOrThrow(this.loginTextEs)) ||
        (await this.displayedOrThrow(this.loginTextEn)),
      {
        timeout,
        interval: 500,
        timeoutMsg: "Login no apareció",
      },
    );
  }

  // ===== Tap robusto =====
  async tapLogin() {
    await safe(async () => {
      await browser.switchContext("NATIVE_APP");
      const btn = this.btnIniciarSesion;
      await btn.waitForDisplayed({ timeout: 30000 });

      // click normal
      try {
        await btn.click();
        return;
      } catch {}

      // fallback: click por coordenadas (cuando click falla por overlay)
      const loc = await btn.getLocation();
      const size = await btn.getSize();
      const x = Math.round(loc.x + size.width / 2);
      const y = Math.round(loc.y + size.height / 2);
      await browser.execute("mobile: clickGesture", { x, y });
    });
  }
}

export default new LoginPage();

import { $, browser } from "@wdio/globals";

class AuthMicrosoftPage {
  // ===============================
  // Selectores Microsoft (Android)
  // ===============================

  // Input de correo (Microsoft)
  private get emailInput() {
    return $('android=new UiSelector().resourceIdMatches(".*i0116")');
  }

  // Botón Next / Sign in (Microsoft reutiliza este id)
  private get nextButton() {
    return $('android=new UiSelector().resourceIdMatches(".*idSIButton9")');
  }

  // Input de password (Microsoft)
  private get passInput() {
    return $('android=new UiSelector().resourceIdMatches(".*i0118")');
  }

  private get emailInputWeb() {
    return $("#i0116");
  }

  private get nextButtonWeb() {
    return $("#idSIButton9");
  }

  private get passInputWeb() {
    return $("#i0118");
  }

  // ===============================
  // Account picker (relogin)
  // ===============================

  private get useAnotherAccountBtn() {
    return $('android=new UiSelector().resourceId("otherTile")');
  }

  private get useAnotherAccountTextEs() {
    return $('android=new UiSelector().textContains("Usar otra cuenta")');
  }

  private get useAnotherAccountTextEn() {
    return $('android=new UiSelector().textContains("Use another account")');
  }

  private get pickAccountTitleEs() {
    return $('android=new UiSelector().textContains("Elegir una cuenta")');
  }

  private get pickAccountTitleEn() {
    return $('android=new UiSelector().textContains("Pick an account")');
  }

  // ===============================
  // Utils ultra simples
  // ===============================

  private async sleep(ms: number) {
    await browser.pause(ms);
  }

  private async clickByElementId(el: any) {
    // ClickGesture por elementId es lo más estable en Uia2
    const real = await el;
    await browser.execute("mobile: clickGesture", {
      elementId: real.elementId,
    });
  }

  private async retry<T>(
    fn: () => Promise<T>,
    retries = 2,
    pauseMs = 350,
  ): Promise<T> {
    let last: any;
    for (let i = 0; i <= retries; i++) {
      try {
        return await fn();
      } catch (e) {
        last = e;
        if (i === retries) break;
        await this.sleep(pauseMs);
      }
    }
    throw last;
  }

  private async switchToMicrosoftContext(timeout = 30000) {
    const deadline = Date.now() + timeout;
    let lastContexts: string[] = [];

    while (Date.now() < deadline) {
      const contexts = ((await browser.getContexts().catch(() => [])) ||
        []) as string[];
      lastContexts = contexts;

      for (const context of contexts) {
        if (context === "NATIVE_APP") continue;

        try {
          await browser.switchContext(context);
          const emailVisible = await this.emailInputWeb
            .isDisplayed()
            .catch(() => false);
          const passwordVisible = await this.passInputWeb
            .isDisplayed()
            .catch(() => false);
          const buttonVisible = await this.nextButtonWeb
            .isDisplayed()
            .catch(() => false);

          if (emailVisible || passwordVisible || buttonVisible) {
            return "WEBVIEW";
          }
        } catch {}
      }

      await browser.switchContext("NATIVE_APP").catch(() => {});
      const nativeEmail = await this.emailInput.isDisplayed().catch(() => false);
      const nativePass = await this.passInput.isDisplayed().catch(() => false);
      const nativeButton = await this.nextButton.isDisplayed().catch(() => false);

      if (nativeEmail || nativePass || nativeButton) {
        return "NATIVE_APP";
      }

      await this.sleep(500);
    }

    throw new Error(
      `No apareció la pantalla Microsoft. Contextos disponibles: ${lastContexts.join(
        ", ",
      )}`,
    );
  }

  /**
   * Maneja el caso relogin:
   * - Si ya está el input de email → ok
   * - Si aparece el account picker → toca "Use another account"
   */
  private async ensureFreshAccount() {
    const context = await this.switchToMicrosoftContext(30000);
    if (context !== "NATIVE_APP") return;

    const emailVisible = await this.emailInput.isDisplayed().catch(() => false);
    if (emailVisible) return;

    const deadline = Date.now() + 10000;

    while (Date.now() < deadline) {
      const otherTile = await this.useAnotherAccountBtn
        .isDisplayed()
        .catch(() => false);
      const otherEs = await this.useAnotherAccountTextEs
        .isDisplayed()
        .catch(() => false);
      const otherEn = await this.useAnotherAccountTextEn
        .isDisplayed()
        .catch(() => false);

      if (otherTile || otherEs || otherEn) {
        const btn = otherTile
          ? this.useAnotherAccountBtn
          : otherEs
            ? this.useAnotherAccountTextEs
            : this.useAnotherAccountTextEn;

        await btn.waitForDisplayed({ timeout: 5000 });
        await this.clickByElementId(btn);

        await this.emailInput.waitForDisplayed({ timeout: 15000 });
        return;
      }

      const pickEs = await this.pickAccountTitleEs
        .isDisplayed()
        .catch(() => false);
      const pickEn = await this.pickAccountTitleEn
        .isDisplayed()
        .catch(() => false);
      if (pickEs || pickEn) {
        await this.sleep(400);
        continue;
      }

      await this.sleep(400);
    }

    // Último intento
    await this.emailInput.waitForDisplayed({ timeout: 15000 });
  }

  // ===============================
  // Acciones públicas
  // ===============================

  async enterEmail(email: string) {
    await this.ensureFreshAccount();

    const currentContext = await browser.getContext();
    if (currentContext !== "NATIVE_APP") {
      await this.emailInputWeb.waitForDisplayed({ timeout: 30000 });
      await this.emailInputWeb.click();
      await this.emailInputWeb.setValue(email);
      await this.sleep(400);
      return;
    }

    await this.emailInput.waitForDisplayed({ timeout: 30000 });

    await this.retry(
      async () => {
        const el = await this.emailInput;
        await this.clickByElementId(el);

        // Si clearValue rompe, igual seguimos con setValue (como tu versión)
        await (el as any).clearValue().catch(() => {});
        await (el as any).setValue(email);
      },
      2,
      400,
    );

    await this.sleep(400);
  }

  /**
   * ✅ FIX CLAVE:
   * Antes solo usabas Enter.
   * Ahora: intenta click REAL al botón idSIButton9 (Next) y si no está, Enter.
   */

  async tapNext() {
    await this.switchToMicrosoftContext(30000);

    const currentContext = await browser.getContext();
    if (currentContext !== "NATIVE_APP") {
      await this.nextButtonWeb.waitForClickable({ timeout: 30000 });
      await this.nextButtonWeb.click();
      await this.sleep(700);
      return;
    }

    await this.closeSuggestionsIfAny();

    // 1) Intento serio: click al botón Next (idSIButton9)
    const btnVisible = await this.nextButton.isDisplayed().catch(() => false);
    if (btnVisible) {
      await this.retry(
        async () => {
          await this.nextButton.waitForDisplayed({ timeout: 15000 });
          await this.clickByElementId(this.nextButton);
        },
        2,
        300,
      );

      await this.sleep(700);
      return;
    }

    // 2) Fallback: Enter
    await browser.keys(["Enter"]).catch(() => {});
    await this.sleep(700);
  }

  async enterPassword(password: string) {
    await this.switchToMicrosoftContext(60000);

    const currentContext = await browser.getContext();
    if (currentContext !== "NATIVE_APP") {
      await this.passInputWeb.waitForDisplayed({ timeout: 60000 });
      await this.passInputWeb.click();
      await this.passInputWeb.setValue(password);
      await this.sleep(400);
      return;
    }

    await browser.hideKeyboard().catch(() => {});
    await this.sleep(300);

    // Espera a que aparezca el campo password
    await this.passInput.waitForDisplayed({ timeout: 60000 });

    await this.retry(
      async () => {
        const pass = await this.passInput;

        // Click robusto
        try {
          await (pass as any).click();
        } catch {
          const loc = await (pass as any).getLocation();
          const size = await (pass as any).getSize();
          await browser.execute("mobile: clickGesture", {
            x: Math.floor(loc.x + size.width / 2),
            y: Math.floor(loc.y + size.height / 2),
          });
        }

        await (pass as any).clearValue().catch(() => {});
        await (pass as any).setValue(password);
      },
      2,
      400,
    );

    await this.sleep(400);
    await browser.switchContext("NATIVE_APP");
  }

  async clickSignIn() {
    await this.switchToMicrosoftContext(30000);

    const currentContext = await browser.getContext();
    if (currentContext !== "NATIVE_APP") {
      await this.nextButtonWeb.waitForClickable({ timeout: 30000 });
      await this.nextButtonWeb.click();
      await this.sleep(700);
      await browser.switchContext("NATIVE_APP").catch(() => {});
      return;
    }

    await this.retry(
      async () => {
        await browser.switchContext("NATIVE_APP");
        // re-resolve SIEMPRE antes de click (anti stale)
        const btn = await this.nextButton;
        await (btn as any).waitForDisplayed({ timeout: 30000 });
        await browser.execute("mobile: clickGesture", {
          elementId: btn.elementId,
        });
      },
      2,
      400,
    );
  }

  // ===============================
  // Aliases para tus steps (por si llaman otros nombres)
  // ===============================
  async clickSignInOrContinue() {
    return this.clickSignIn();
  }
  async clickYes() {
    return this.clickSignIn();
  }
  async clickStaySignedIn() {
    return this.clickSignIn();
  }
  async confirmStaySignedInIfAny() {
    return this.clickSignIn();
  }

  // Flujo completo (opcional)
  async loginMicrosoft(email: string, password: string) {
    await this.enterEmail(email);
    await this.tapNext();
    await this.enterPassword(password);
    await this.clickSignIn();
  }

  private async closeSuggestionsIfAny() {
    await browser.switchContext("NATIVE_APP").catch(() => {});

    // 1) ESC suele cerrar dropdown
    try {
      await browser.keys(["Escape"]);
    } catch {}
    await this.sleep(250);

    // 2) Tap en un área en blanco arriba (cierra suggestions)
    try {
      const { width, height } = await browser.getWindowSize();
      await browser.execute("mobile: clickGesture", {
        x: Math.floor(width * 0.5),
        y: Math.floor(height * 0.2),
      });
    } catch {}
    await this.sleep(250);

    // 3) Hide keyboard por si está levantado
    await browser.hideKeyboard().catch(() => {});
    await this.sleep(200);
  }
}

export default new AuthMicrosoftPage();

import { $, browser } from "@wdio/globals";

class PerfilPage {
  private get menuButton() {
    return $('android=new UiSelector().resourceIdMatches(".*menu-icon-button")');
  }

  private get titlePerfil() {
    return $('android=new UiSelector().textContains("Perfil")');
  }

  private get btnLogout() {
    return $('android=new UiSelector().descriptionContains("Salir de la cuenta")');
  }

  private get btnModalSalir() {
    return $('android=new UiSelector().resourceId("modal-button")');
  }

  private get loginButton() {
    return $('android=new UiSelector().textContains("Iniciar sesión")');
  }

  private async clickElement(el: any) {
    const real = await el;
    try {
      await browser.execute("mobile: clickGesture", {
        elementId: real.elementId,
      });
    } catch {
      await real.click();
    }
  }

  private async tapMenuByCoordinates() {
    const { width, height } = await browser.getWindowSize();
    await browser.execute("mobile: shell", {
      command: "input",
      args: [
        "tap",
        String(Math.floor(width * 0.89)),
        String(Math.floor(height * 0.12)),
      ],
    });
  }

  async clicBtnPerfil() {
    await browser.switchContext("NATIVE_APP");

    if (await this.menuButton.isDisplayed().catch(() => false)) {
      await this.clickElement(this.menuButton);
    } else {
      await this.tapMenuByCoordinates();
    }

    await this.waitForPerfil();
  }

  async waitForPerfil(timeout = 15000) {
    await browser.switchContext("NATIVE_APP");
    await browser.waitUntil(
      async () =>
        (await this.titlePerfil.isDisplayed().catch(() => false)) ||
        (await this.btnLogout.isDisplayed().catch(() => false)),
      {
        timeout,
        interval: 500,
        timeoutMsg: "No apareció la pantalla Perfil",
      },
    );
  }

  async clicBtnLogout() {
    await browser.switchContext("NATIVE_APP");
    const btnSalir = await this.btnLogout;
    await btnSalir.waitForDisplayed({ timeout: 30000 });
    await this.clickElement(btnSalir);

    await browser.pause(800);

    const btnModal = this.btnModalSalir;
    await btnModal.waitForDisplayed({ timeout: 30000 });
    await this.clickElement(btnModal);

    await this.waitForLoggedOut();
  }

  async logout() {
    await this.clicBtnPerfil();
    await this.clicBtnLogout();
  }

  async waitForLoggedOut(timeout = 30000) {
    await browser.waitUntil(
      async () => await this.loginButton.isDisplayed().catch(() => false),
      {
        timeout,
        interval: 500,
        timeoutMsg: "No volvió a la pantalla de login después del logout",
      },
    );
  }
}

export default new PerfilPage();

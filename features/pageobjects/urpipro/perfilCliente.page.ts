import { $, browser } from "@wdio/globals";
import { safe } from "../../support/uia2-recovery";

class perfilClientePage {
  private async native() {
    await browser.switchContext("NATIVE_APP");
  }

  async waitDniLoaded(dni: string) {
    await this.native();
    const dniLbl = await $(
      `android=new UiSelector().textContains("DNI:").textContains("${dni}")`,
    );
    await dniLbl.waitForDisplayed({ timeout: 30000 });
    await browser.pause(1000);
  }

  // swipe "seguro" (no pull-to-refresh)
  private async swipeUpSafe() {
    await this.native();
    const { width, height } = await browser.getWindowRect();
    const left = Math.floor(width * 0.1);
    const top = Math.floor(height * 0.35);
    const areaWidth = Math.floor(width * 0.8);
    const areaHeight = Math.floor(height * 0.45);
    await browser.execute("mobile: swipeGesture", {
      left,
      top,
      width: areaWidth,
      height: areaHeight,
      direction: "up",
      percent: 0.7,
    });
    await browser.pause(900);
  }

  // intenta encontrar el botón por distintos caminos
  private async findSimularBtn() {
    await this.native();
    const candidates = [
      // 1) resource-id del botón (según inspector)
      $(
        'android=new UiSelector().resourceId("com.urpipro:id/simulate-credit")',
      ),
      // 2) content-desc del botón (en tu inspector aparece content-desc=simulate-credit)
      $('//android.widget.Button[@content-desc="simulate-credit"]'),
      // 3) text view interno (antes viste simulate-credit-text)
      $(
        'android=new UiSelector().resourceId("com.urpipro:id/simulate-credit-text")',
      ),
      // 4) fallback por texto (tu caso comprobado)
      $('android=new UiSelector().textContains("Simular")'),
    ];
    for (const el of candidates) {
      if (await el.isExisting().catch(() => false)) return el;
    }
    return null;
  }

  async clickSimularCredito(dni: string) {
    await safe(async () => {
      await this.waitDniLoaded(dni);
      // intenta sin scroll primero
      let btn = await this.findSimularBtn();
      if (btn && (await btn.isDisplayed().catch(() => false))) {
        await btn.click();
        return;
      }
      // scroll incremental + búsqueda
      for (let i = 0; i < 12; i++) {
        await this.swipeUpSafe();
        btn = await this.findSimularBtn();
        if (btn && (await btn.isDisplayed().catch(() => false))) {
          await btn.click();
          return;
        }
        // si existe pero no se marca displayed, forzamos tap nativo
        if (btn && (await btn.isExisting().catch(() => false))) {
          await browser.execute("mobile: clickGesture", {
            elementId: btn.elementId,
          });
          return;
        }
      }
      throw new Error(
        'No se encontró/clickó el botón "Simular crédito" después de 12 swipes.',
      );
    });
  }


}

export default new perfilClientePage();

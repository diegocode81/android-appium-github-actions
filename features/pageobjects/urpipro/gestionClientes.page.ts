import { $, browser } from "@wdio/globals";
import { safe } from "../../support/uia2-recovery";

class GestionClientesPage {
  // =========================
  // Selectores (NATIVE_APP)
  // =========================
  private get inputSearchByAcc() {
    return $("~search");
  }

  private get inputSearchByRes() {
    return $('android=new UiSelector().resourceIdMatches(".*:id/search")');
  }

  private get inputSearchByText() {
    return $('android=new UiSelector().textContains("Buscar por DNI")');
  }

  private get titleGestionClientes() {
    return $('android=new UiSelector().textContains("Gestión de clientes")');
  }

  private dniResultLocator(dni: string) {
    return $(`android=new UiSelector().textContains("DNI: ${dni}")`);
  }

  // ===============================
  // Helpers internos
  // ===============================
  private async resolveSearchInput(timeout = 30000) {
    await browser.switchContext("NATIVE_APP").catch(() => {});

    const byAcc = this.inputSearchByAcc;
    const byRes = this.inputSearchByRes;
    const byText = this.inputSearchByText;

    await browser.waitUntil(
      async () =>
        (await byAcc.isDisplayed().catch(() => false)) ||
        (await byRes.isDisplayed().catch(() => false)) ||
        (await byText.isDisplayed().catch(() => false)),
      {
        timeout,
        interval: 500,
        timeoutMsg: "No apareció el input de búsqueda (accId/resourceId/text)",
      },
    );

    if (await byAcc.isDisplayed().catch(() => false)) return byAcc;
    if (await byRes.isDisplayed().catch(() => false)) return byRes;
    return byText;
  }

  // ===============================
  // Acciones públicas
  // ===============================
  async waitForHome(timeout = 60000) {
    await browser.switchContext("NATIVE_APP").catch(() => {});

    await browser.waitUntil(
      async () =>
        (await this.titleGestionClientes.isDisplayed().catch(() => false)) ||
        (await this.inputSearchByAcc.isDisplayed().catch(() => false)) ||
        (await this.inputSearchByRes.isDisplayed().catch(() => false)) ||
        (await this.inputSearchByText.isDisplayed().catch(() => false)),
      {
        timeout,
        interval: 1000,
        timeoutMsg: "No apareció la pantalla home de Gestión de clientes",
      },
    );
  }

  async buscarClienteDNI(dni: string) {
    await safe(async () => {
      await browser.switchContext("NATIVE_APP").catch(() => {});

      const input = await this.resolveSearchInput(15000).catch(async () => {
        try {
          await driver.back();
        } catch {}
        try {
          await browser.activateApp("com.urpipro");
        } catch {}
        return await this.resolveSearchInput(30000);
      });

      // Click estable
      try {
        await browser.execute("mobile: clickGesture", {
          elementId: (await input).elementId,
        });
      } catch {
        await input.click();
      }

      // Limpieza SIN clear() agresivo
      try {
        // CTRL+A y DEL
        await driver.pressKeyCode(29, 4096);
        await driver.pressKeyCode(67);
      } catch {}
      try {
        await input.clearValue();
      } catch {}

      await input.setValue(dni);

      // ENTER
      try {
        await driver.pressKeyCode(66);
      } catch {
        await browser.keys(["Enter"]).catch(() => {});
      }
    });
  }

  // ✅ Envuelto en safe(): aquí se te caía UiA2 al buscar el elemento "DNI: xxx"
  async clickClientePorDNI(dni: string) {
    await safe(async () => {
      await browser.switchContext("NATIVE_APP").catch(() => {});
      const dniEl = await this.dniResultLocator(dni);
      await dniEl.waitForDisplayed({ timeout: 20000 });
      // Click más estable que .click()
      try {
        await browser.execute("mobile: clickGesture", {
          elementId: dniEl.elementId,
        });
      } catch {
        await dniEl.click();
      }
    });
  }
  // ✅ También envuelto en safe(): si cae UiA2 en el wait, se recupera y reintenta
  async validarExistenciaClientePorDNI(dni: string, timeout = 20000) {
    await safe(async () => {
      await browser.switchContext("NATIVE_APP").catch(() => {});
      const dniEl = await this.dniResultLocator(dni);
      await dniEl.waitForDisplayed({ timeout });
    });
  }
}

export default new GestionClientesPage();

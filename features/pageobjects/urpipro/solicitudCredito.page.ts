import { $, browser } from "@wdio/globals";
import { typeNumberNative } from "../../support/mobile-input";

class solicitudCreditoPage {
  // LOCALIZADORES
  private async native() {
    await browser.switchContext("NATIVE_APP");
  }

  private get txtMonto() {
    return $("~requestedAmount");
  }

  private get lblErrorCarga() {
    return $(`android=new UiSelector().textContains("Error al cargar")`);
  }

  private get lbControlValor() {
    return $(
      'android=new UiSelector().className("android.widget.TextView").textMatches("(?i).*(máximo|maximo|mínimo|minimo).*")',
    );
  }

  private get btnBackPerfil() {
    return $('android=new UiSelector().resourceId("undefined-icon")');
  }

  private get mdlBackPerfil() {
    return $("~modal-back-button");
  }

  private get txtPaymentDay() {
    return $("~paymentDay");
  }

  async tapBackAutoTopLeft() {
    await browser.switchContext("NATIVE_APP").catch(() => {});
    await browser.hideKeyboard().catch(() => {});
    await browser.pause(100);
    // Botón back suele ser el primer clickable del header
    const sel =
      '(//android.view.ViewGroup[@clickable="true" and @enabled="true"])[1]';
    const parseBounds = (b: string) => {
      // formato: "[x1,y1][x2,y2]"
      const m = String(b).match(/\[(\d+),(\d+)\]\[(\d+),(\d+)\]/);
      if (!m) return null;
      const x1 = Number(m[1]),
        y1 = Number(m[2]),
        x2 = Number(m[3]),
        y2 = Number(m[4]);
      return {
        x1,
        y1,
        x2,
        y2,
        cx: Math.floor((x1 + x2) / 2),
        cy: Math.floor((y1 + y2) / 2),
      };
    };
    const isStale = (e: any) =>
      String(e || "")
        .toLowerCase()
        .includes("stale");
    // Intentamos varias veces porque la UI puede estar animando
    for (let i = 1; i <= 6; i++) {
      try {
        // Re-resolve SIEMPRE (anti stale)
        const el: any = await $(sel);
        const ok = await el.isDisplayed().catch(() => false);
        if (!ok) {
          await browser.pause(250);
          continue;
        }
        // Leer bounds y tap por coordenadas (NO elementId)
        const bounds = await el.getAttribute("bounds");
        const b = parseBounds(bounds);
        if (!b) {
          await browser.pause(250);
          continue;
        }
        await browser.execute("mobile: clickGesture", { x: b.cx, y: b.cy });
        return;
      } catch (e: any) {
        if (isStale(e)) {
          await browser.pause(200);
          continue;
        }
        // cualquier otro error, reintenta rápido
        await browser.pause(250);
        continue;
      }
    }
    throw new Error(
      "No se pudo clicar BACK por bounds-tap tras varios intentos",
    );
  }

  // TAREAS
  async setMonto(monto: string) {
    await this.native(); // asegúrate que realmente hace switchContext NATIVE_APP
    await browser.waitUntil(
      async () => {
        try {
          await browser.switchContext("NATIVE_APP");
          const visible = await this.txtMonto.isDisplayed().catch(() => false);
          const enabled = await this.txtMonto.isEnabled().catch(() => false);
          if (!visible || !enabled) return false;
          await this.txtMonto.click();
          await this.txtMonto.clearValue();
          await this.txtMonto.setValue(monto);
          return true;
        } catch (e: any) {
          const msg = String(e?.message || e).toLowerCase();
          const retryable =
            msg.includes("stale") ||
            msg.includes("not interactable") ||
            msg.includes("element wasn't found") ||
            msg.includes("terminating request");
          if (!retryable) throw e;
          return false;
        }
      },
      {
        timeout: 15000,
        interval: 500,
        timeoutMsg: "setMonto no logró estabilizar requestedAmount",
      },
    );
  }

  async LimiteMaximo() {
    await this.native();
    const texto = await this.lbControlValor.getText();
    const normalizado = texto
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
    expect(normalizado.toLowerCase()).toContain("maximo");
    await this.salirMiCartera();
  }

  async LimiteADN() {
    await this.native();
    const tieneControl = await this.lbControlValor
      .waitForDisplayed({ timeout: 6000 })
      .then(() => true)
      .catch(() => false);
    if (tieneControl) {
      const texto = await this.lbControlValor.getText();
      const normalizado = texto
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
      expect(normalizado).toContain("maximo");
    } else {
      try {
        await driver.hideKeyboard();
      } catch {}
      await this.txtPaymentDay.waitForDisplayed({ timeout: 10000 });
      await typeNumberNative(this.txtPaymentDay, "5");
      const btnRecalcular = await $("~Recalcular tasas");
      await btnRecalcular.waitForDisplayed({ timeout: 10000 });
      await btnRecalcular.waitForEnabled({ timeout: 10000 });
      await browser.waitUntil(
        async () => {
          try {
            await btnRecalcular.click();
            return true;
          } catch (e: any) {
            const msg = String(e?.message || e).toLowerCase();
            const retryable =
              msg.includes("stale") ||
              msg.includes("element wasn't found") ||
              msg.includes("no such element") ||
              msg.includes("not interactable") ||
              msg.includes("terminating request");
            if (!retryable) throw e;
            return false;
          }
        },
        {
          timeout: 10000,
          interval: 400,
          timeoutMsg: "No se pudo clickear 'Recalcular tasas'",
        },
      );
      const msgExcede = await $(
        'android=new UiSelector().className("android.widget.TextView").textContains("excede tu autonomía")',
      );
      const apareceExcede = await msgExcede
        .waitForDisplayed({ timeout: 4000 })
        .then(() => true)
        .catch(() => false);
      if (apareceExcede) {
        const txtAuto = await msgExcede.getText();
        expect(txtAuto.toLowerCase()).toContain("excede");
      } else {
        console.log(
          "ℹ️ LimiteADN: no apareció 'excede tu autonomía' después de recalcular (continúo)",
        );
      }
    }
    await this.salirMiCartera();
  }

  async LimiteMinimo() {
    await this.native();
    const texto = await this.lbControlValor.getText();
    const normalizado = texto
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
    expect(normalizado.toLowerCase()).toContain("minimo");
    await this.salirMiCartera();
  }

  async validarErrorSimulacion(): Promise<boolean> {
    const existe = await this.lblErrorCarga.isDisplayed().catch(() => false);
    if (existe) {
      await this.salirMiCartera();
      console.log("⚠ BUSINESS ERROR: Cliente sin datos para simulación");
      return false; // 🔴 indica que hay error
    }
    return true; // 🟢 simulación OK
  }

  async salirMiCartera() {
    console.log("----SALIR A MI CARTERA UNO----");
    await this.native();
    const btn = await this.btnBackPerfil;
    await btn.waitForExist({ timeout: 10000 });
    await browser.execute("mobile: clickGesture", { elementId: btn.elementId });
    //await this.btnBackPerfil.waitForDisplayed({ timeout: 10000 });
    //await this.btnBackPerfil.click();
    await this.mdlBackPerfil.waitForDisplayed({ timeout: 10000 });
    await this.mdlBackPerfil.click();
    await this.tapBackAutoTopLeft();
  }
}

export default new solicitudCreditoPage();

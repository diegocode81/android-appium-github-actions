import { When, Then } from "@wdio/cucumber-framework";
import gestionClientesPage from "../../pageobjects/urpipro/gestionClientes.page";
import perfilClientePage from "../../pageobjects/urpipro/perfilCliente.page";
import solicitudCreditoPage from "../../pageobjects/urpipro/solicitudCredito.page";
import { getCreditosByUserKey } from "../../support/data/urpipro/simularCredito";
import perfilPage from "features/pageobjects/urpipro/perfil.page";

When("ingreso a la bandeja de clientes", async () => {});

When(
  "buscar y dar credito a los clientes del ADN {string}",
  async (userKey: string) => {
    const clientes = getCreditosByUserKey(userKey);
    for (const c of clientes) {
      await gestionClientesPage.buscarClienteDNI(c.dni);
      await gestionClientesPage.clickClientePorDNI(c.dni);
      console.log("DNI: " + c.dni);
      await perfilClientePage.clickSimularCredito(c.dni);
      const simulacionValida =
        await solicitudCreditoPage.validarErrorSimulacion();
      if (!simulacionValida) {
        break;
      }
      await solicitudCreditoPage.setMonto(c.monto);
      const monto = Number(String(c.monto).replace(/,/g, "").trim());
      if (monto > 149999) {
        await solicitudCreditoPage.LimiteMaximo();
      }
      if (monto < 300) {
        await solicitudCreditoPage.LimiteMinimo();
      }
      if (monto > 300 && monto < 149999) {
        await solicitudCreditoPage.LimiteADN();
      }
    }
    await browser.pause(700);
    await perfilPage.clicBtnPerfil();
    await perfilPage.clicBtnLogout();
  },
);

Then("clientes con credito simulado", async () => {});

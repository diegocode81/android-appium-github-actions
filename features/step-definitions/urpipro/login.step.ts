import { Given, When, Then } from "@wdio/cucumber-framework";
import { browser } from "@wdio/globals";
import LoginPage from "../../pageobjects/urpipro/login.page";
import AuthMicrosoftPage from "../../pageobjects/urpipro/AuthMicrosoftPage";
import gestionClientesPage from "../../pageobjects/urpipro/gestionClientes.page";
import perfilPage from "../../pageobjects/urpipro/perfil.page";
import { getUserByKey } from "../../support/data/urpipro/users.data";
import { safe } from "../../support/uia2-recovery";

Given("ingreso al login de urpipro", async () => {
  await safe(async () => {
    try {
      await LoginPage.tapLogin();
    } catch (e) {
      const alreadyHome = await gestionClientesPage
        .waitForHome(5000)
        .then(() => true)
        .catch(() => false);

      if (!alreadyHome) throw e;

      await perfilPage.logout();
      await LoginPage.tapLogin();
    }
  });
});

When("inicio sesion con el usuario {string}", async (userKey: string) => {
  const user = getUserByKey(userKey);
  await safe(async () => {
    await AuthMicrosoftPage.enterEmail(user.username);
    await AuthMicrosoftPage.tapNext();
    await AuthMicrosoftPage.enterPassword(user.password);
    await AuthMicrosoftPage.clickSignIn();
  });
});

Then("el sistema me debe llevar a la pantalla de gestion de clientes", async () => {
  await safe(async () => {
    await gestionClientesPage.waitForHome();
    await browser.pause(Number(process.env.HOME_PAUSE_MS || 5000));
  });
});

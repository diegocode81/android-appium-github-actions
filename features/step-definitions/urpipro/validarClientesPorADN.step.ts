import { When, Then } from "@wdio/cucumber-framework";
import gestionClientesPage from "../../pageobjects/urpipro/gestionClientes.page";
import { getClientesByUserKey } from "../../support/data/urpipro/clientes.data";
import perfilPage from "features/pageobjects/urpipro/perfil.page";
import { appendToCsv } from "../../support/utils/csv-writer";
import * as path from "path";
import * as fs from "fs";

When("busco y valido los clientes del usuario {string}", async (userKey: string) => {
  const clientes = getClientesByUserKey(userKey);
  const title = "clientes_no_encontrados";
  const baseDir = path.resolve(process.cwd(), "reports", "csv");
  const filePath = path.join(baseDir, `${title}.csv`);
  if (!fs.existsSync(baseDir)) {
    fs.mkdirSync(baseDir, { recursive: true });
    console.log(`[csv] carpeta creada: ${baseDir}`);
  }
  for (const c of clientes) {
    console.log(`[clientes] buscando DNI=${c.dni}`);
    await gestionClientesPage.buscarClienteDNI(c.dni);
    await browser.pause(700);
    const existe = await gestionClientesPage
      .validarExistenciaClientePorDNI(c.dni, 8000)
      .then(() => true)
      .catch(() => false);

    if (!existe) {
      await appendToCsv({
        title,
        filePath,
        headers: ["adn", "dni"],
        data: {
          adn: userKey,
          dni: c.dni,
        },
      });
    } else {
      console.log(`[csv] cliente encontrado → DNI=${c.dni}`);
    }
  }
  await browser.pause(700);
  await perfilPage.clicBtnPerfil();
  await perfilPage.clicBtnLogout();
});

Then("debo ver resultados de clientes", async () => {});

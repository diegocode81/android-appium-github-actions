# Mobile QA Archetype - Appium + WebdriverIO + Cucumber + Allure

Arquetipo para automatizar pruebas E2E móviles de URPI Pro con Gherkin. El proyecto permite ejecutar escenarios por tag, cargar datos desde CSV, automatizar Android/iOS con Appium y generar reportes en Allure y Word.

## Stack

- Appium 3.x
- WebdriverIO 9
- Cucumber / Gherkin
- TypeScript
- Allure Report
- UiAutomator2 para Android
- XCUITest para iOS
- Appium Inspector para identificar selectores

## Prerrequisitos

- Node.js 20 o superior
- npm
- Android Studio, Android SDK y un emulador AVD
- Xcode y simulador iOS si se van a ejecutar pruebas iOS
- Appium Inspector instalado

Validaciones útiles:

```bash
node -v
npm -v
adb devices
```

## Instalación

Clonar el repositorio e instalar dependencias:

```bash
npm install
```

Los drivers de Appium están declarados como dependencias del proyecto:

- `appium-uiautomator2-driver`

Si se usa Appium global para Android en CI, instalar el driver compatible con Appium 2:

```bash
appium driver install uiautomator2@4.2.9
```

## Librerías principales

```text
appium                         Servidor de automatización móvil.
appium-uiautomator2-driver     Driver Android para Appium.
@wdio/cli                      CLI de WebdriverIO.
@wdio/local-runner             Runner local de WebdriverIO.
@wdio/cucumber-framework       Integración Cucumber/Gherkin con WDIO.
@wdio/appium-service           Servicio para trabajar con Appium desde WDIO.
@wdio/spec-reporter            Reporte en consola.
@wdio/allure-reporter          Adaptador de resultados Allure.
@cucumber/cucumber             Motor BDD para ejecutar escenarios Gherkin.
typescript                     Tipado y compilación TypeScript.
ts-node                        Ejecución de archivos TypeScript en runtime.
cross-env                      Variables de entorno compatibles entre sistemas.
csv-parse                      Lectura de datos CSV para Examples.
glob                           Búsqueda de archivos feature.
allure-commandline             Generación y apertura de reportes Allure.
chromedriver                   Soporte local para automatización WebView.
jszip                          Generación del documento Word de evidencias.
```

El proyecto usa estas librerías desde `package.json`. Para instalar todo, solo se necesita:

```bash
npm install
```

## Estructura

```text
apps/
  android/urpipro.apk
  ios/sample-app.zip

features/
  urpipro/
    login.feature
    validarClientesPorADN.feature
    simularCreditoControles.feature

  step-definitions/urpipro/
    login.step.ts
    validarClientesPorADN.step.ts
    simularCredito.step.ts

  pageobjects/urpipro/
    login.page.ts
    AuthMicrosoftPage.ts
    gestionClientes.page.ts
    perfil.page.ts
    perfilCliente.page.ts
    solicitudCredito.page.ts

  resources/data/urpipro/
    users.csv
    clientes.csv
    simularCredito.csv
    Auxiliar.csv

  support/
    hooks.ts
    uia2-recovery.ts
    generate-word-report.js
    expand-csv-examples.js
    utils/csv-writer.ts

templates/
  CASO-XXXXX Documento de Evidencias V1.01.docx

reporte-mibanco/
  CASO-XXXXX-Evidencias-*.docx

reports/
  csv/clientes_no_encontrados.csv

wdio.conf.ts
package.json
tsconfig.json
```

## Datos de prueba

Los escenarios usan `Examples: CSV` para leer datos desde archivos CSV.

Ejemplo:

```gherkin
Examples: CSV "resources/data/urpipro/users.csv"
```

El script `bdd:gen` expande esos CSV a features temporales en:

```text
features/support/.features_gen
```

Esa carpeta se limpia automáticamente al terminar la ejecución.

Archivos principales:

- `users.csv`: credenciales por `userKey`.
- `clientes.csv`: DNIs asociados a usuarios/ADN.
- `simularCredito.csv`: DNIs y montos para simulación de crédito.
- `Auxiliar.csv`: data auxiliar.

Para ejecutar solo un ADN, dejar una sola fila de datos en `users.csv`.

## Configuración Android

Las capabilities Android están en `wdio.conf.ts`.

Valores locales importantes:

```ts
"appium:deviceName": "emulator-5554"
"appium:udid": "emulator-5554"
"appium:platformVersion": "12"
"appium:app": "apps/android/urpipro.apk"
"appium:appPackage": "com.urpipro"
"appium:appActivity": ".MainActivity"
```

Si el emulador tiene otro `udid` o versión Android, actualizar `wdio.conf.ts`.

En GitHub Actions, la configuración detecta `CI=true` y usa el emulador Android 15 del workflow con:

```ts
"appium:deviceName": "Android Emulator"
"appium:platformVersion": "15"
"appium:app": "apps/android/urpipro.apk"
"appium:noReset": false
```

Para CI, colocar la APK en:

```text
apps/android/urpipro.apk
```

Consultar dispositivo conectado:

```bash
adb devices
adb shell getprop ro.build.version.release
```

## Levantar Appium

En una terminal independiente:

```bash
npm run appium:android
```

Este comando levanta Appium con los permisos necesarios para el arquetipo:

```bash
appium --address 127.0.0.1 --allow-insecure uiautomator2:chromedriver_autodownload,uiautomator2:adb_shell
```

Importante: en Appium 3, los insecure features deben llevar el prefijo del driver, por ejemplo `uiautomator2:adb_shell`.

## Ejecutar pruebas

Antes de ejecutar pruebas Android, levantar Appium en una terminal independiente:

```bash
npm run appium:android
```

Android completo:

```bash
npm run test:android
```

Android por tag:

```bash
TAGS="@urpiproLogin" npm run test:android
TAGS="@validarClientesPorADN" npm run test:android
TAGS="@simularCredito" npm run test:android
```

Cuando el tag corresponde a un escenario o feature específico, WDIO selecciona solo el archivo `.feature` que contiene ese tag y ejecuta un solo worker. La configuración actual fuerza `maxInstances: 1`.

Antes de cada escenario Android, los hooks cierran `com.urpipro` y Chrome con
`force-stop`, y luego abren nuevamente URPI Pro. Esto evita que una corrida
empiece con la app en el estado que quedó manualmente en el emulador.

iOS completo:

```bash
npm run test:ios
```

iOS por tag:

```bash
TAGS='@ios' npm run test:ios:tags
```

## Flujo de Login

El escenario `@urpiproLogin` hace:

1. Abre la pantalla de login de URPI Pro.
2. Ingresa correo y contraseña Microsoft desde `users.csv`.
3. Espera la pantalla Gestión de clientes.
4. Mantiene Gestión de clientes visible unos segundos para dejar evidencia.

Si un siguiente ejemplo inicia con sesión activa, el `Given` detecta Gestión de clientes, cierra sesión y vuelve a la pantalla de login antes de continuar.

La pausa en Gestión de clientes se puede cambiar con:

```bash
HOME_PAUSE_MS=10000 TAGS='@urpiproLogin' npm run test:android:tags
```

Por defecto son 5000 ms.

## GitHub Actions

El workflow productivo de Appium es:

```text
.github/workflows/android-appium-smoke-test.yml
```

Se ejecuta solo manualmente:

```text
Actions -> Android Appium Smoke Test -> Run workflow -> tags @urpiproLogin
```

El input `tags` se pasa a Cucumber mediante la variable `TAGS`. Por defecto ejecuta:

```text
@urpiproLogin
```

El workflow hace:

- Usa `ubuntu-latest`.
- Habilita KVM.
- Configura Node.js 20 con cache de npm.
- Ejecuta `npm ci`.
- Instala Appium 2 global y el driver `uiautomator2`.
- Levanta Appium en `127.0.0.1:4723`.
- Inicia un emulador Android API 35 con `reactivecircus/android-emulator-runner@v2`.
- Verifica que exista `apps/android/urpipro.apk`.
- Instala la APK con `adb install -r apps/android/urpipro.apk`.
- Captura screenshots antes y despues de la prueba.
- Ejecuta `TAGS="<input>" CI=true npm run test:android:ci`.

## Reportes y Artifacts

El reporte Word del arquetipo se genera en:

```text
reporte-mibanco
```

El artifact descargable de GitHub Actions se llama:

```text
appium-mobile-test-evidence
```

Incluye, cuando existan:

- logs de Appium: `appium-server.log` y `appium.log`
- screenshots: `artifacts/appium/before-test.png` y `artifacts/appium/after-test.png`
- reporte Word: `reporte-mibanco`
- reportes auxiliares: `reports`
- resultados Allure: `allure-results`

La subida del artifact usa `if: always()`, por lo que se intenta publicar evidencia aunque fallen las pruebas.

## Proximas fases

- Publicar Allure Report como GitHub Pages.
- Ejecutar por suite/tag.
- Parametrizar APK.
- Ejecutar nightly si se requiere.

## Reportes Allure

Los resultados Allure se generan durante la ejecución en:

```text
allure-results/
```

Generar reporte:

```bash
npm run allure:report
```

Abrir reporte:

```bash
npm run allure:open
```

Generar y abrir:

```bash
npm run report
```

Resultados:

```text
allure-results/
allure-report/
```

Screenshots:

```text
SCREENSHOT_MODE=always   Captura en cada step. Es el valor por defecto.
SCREENSHOT_MODE=fail     Captura solo en fallos.
SCREENSHOT_MODE=off      Desactiva screenshots automáticos.
```

Con el comando normal ya se generan evidencias en cada step:

```bash
TAGS='@urpiproLogin' npm run test:android:tags
```

## Reporte Word de evidencias

Al terminar una ejecución WDIO, el proyecto genera automáticamente un documento
Word en:

```text
reporte-mibanco/
```

El documento usa como base la plantilla:

```text
templates/CASO-XXXXX Documento de Evidencias V1.01.docx
```

Incluye resumen de ejecución, escenarios probados, estado de cada escenario,
pasos ejecutados y screenshots adjuntos desde `allure-results`.
El encabezado del documento incluye la versión del APK instalada, por ejemplo:
`Evidencia de pruebas - Ambiente de calidad - apk v1.2.1`.

Antes de crear el nuevo documento, se eliminan los `.docx` existentes dentro de
`reporte-mibanco/`. Así cada corrida deja solo el reporte vigente.

También se puede generar manualmente con los resultados Allure existentes:

```bash
npm run evidence:word
```

Variables útiles:

```text
GENERATE_WORD_REPORT=false     No genera Word al terminar WDIO.
WORD_TEMPLATE=/ruta/doc.docx   Usa otra plantilla Word.
REPORT_ENVIRONMENT=QA          Cambia el texto del entorno en el reporte.
APK_VERSION=1.3.3              Sobrescribe la version detectada del APK.
```

## Appium Inspector

1. Levantar Appium:

```bash
npm run appium:android
```

2. Abrir Appium Inspector.

3. Configurar conexión:

```text
Remote Host: 127.0.0.1
Remote Port: 4723
Remote Path: /
```

4. Usar capabilities Android:

```json
{
  "platformName": "Android",
  "appium:automationName": "UiAutomator2",
  "appium:deviceName": "emulator-5554",
  "appium:udid": "emulator-5554",
  "appium:platformVersion": "12",
  "appium:app": "/ruta/absoluta/al/proyecto/apps/android/urpipro.apk",
  "appium:appPackage": "com.urpipro",
  "appium:appActivity": ".MainActivity",
  "appium:autoGrantPermissions": true,
  "appium:noReset": true,
  "appium:newCommandTimeout": 240
}
```

Para iOS:

```json
{
  "platformName": "iOS",
  "appium:automationName": "XCUITest",
  "appium:deviceName": "iPhone 16 Pro",
  "appium:platformVersion": "18.6",
  "appium:app": "/ruta/absoluta/al/proyecto/apps/ios/sample-app.zip",
  "appium:noReset": true,
  "appium:newCommandTimeout": 240
}
```

## VS Code

Extensiones recomendadas:

- Cucumber
- Prettier
- TypeScript and JavaScript Language Features

Configuración sugerida en `settings.json`:

```json
{
  "workbench.colorTheme": "Default Light Modern",
  "[typescript]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  "[json]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  "cucumber.features": ["features/**/*.feature"],
  "cucumber.glue": ["features/step-definitions/**/*.ts"],
  "cucumber.autocomplete": true,
  "cucumber.gherkinDefinitionPart": "step"
}
```

## Scripts npm

```text
npm run appium:android       Levanta Appium para Android.
npm run bdd:gen              Genera features temporales desde CSV.
npm run bdd:clean            Limpia features temporales.
npm run test                 Genera features y ejecuta WDIO.
npm run test:android         Ejecuta Android.
npm run test:android:tags    Ejecuta Android filtrando TAGS.
npm run test:ios             Ejecuta iOS.
npm run test:ios:tags        Ejecuta iOS filtrando TAGS.
npm run evidence:word        Genera reporte Word desde allure-results.
npm run allure:report        Genera reporte Allure.
npm run allure:open          Abre reporte Allure.
npm run report               Genera y abre reporte Allure.
```

## Troubleshooting

### Appium no reconoce `chromedriver_autodownload`

Usar el comando del proyecto:

```bash
npm run appium:android
```

En Appium 3 no usar:

```bash
appium --allow-insecure chromedriver_autodownload
```

Usar:

```bash
appium --allow-insecure uiautomator2:chromedriver_autodownload,uiautomator2:adb_shell
```

### Error con `mobile: shell`

Levantar Appium con `uiautomator2:adb_shell`:

```bash
npm run appium:android
```

### No encuentra el emulador

Validar:

```bash
adb devices
```

Actualizar `deviceName` y `udid` en `wdio.conf.ts` si no es `emulator-5554`.

### WebView / Microsoft login falla por Chromedriver

El proyecto usa:

```ts
"appium:chromedriverExecutableDir": "node_modules/.cache/appium/chromedrivers"
```

Appium descarga el Chromedriver compatible cuando el servidor se levanta con:

```bash
uiautomator2:chromedriver_autodownload
```

### La app queda logueada

El escenario de login intenta cerrar sesión al final. Si se interrumpe la ejecución manualmente, cerrar sesión desde:

```text
Home -> menú superior derecho -> Perfil -> Salir de la cuenta -> Si, salir del app
```

### Limpiar resultados

```bash
rm -rf allure-results allure-report reporte-mibanco features/support/.features_gen
```

## Convenciones

- Los `.feature` viven en `features/urpipro`.
- Los steps viven en `features/step-definitions/urpipro`.
- Los page objects viven en `features/pageobjects/urpipro`.
- La data vive en `features/resources/data/urpipro`.
- Los selectores deben centralizarse en page objects.
- Los escenarios deben tener tags claros para ejecución selectiva.

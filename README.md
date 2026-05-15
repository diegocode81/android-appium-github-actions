# android-appium-github-actions

POC para validar automatizacion mobile QA con GitHub Actions, Android Emulator y futuras fases con Appium.

## Objetivo de la POC

Crear la base minima para comprobar que GitHub Actions puede iniciar un emulador Android en un runner Linux.

Esta primera fase no instala APKs, no levanta Appium y no ejecuta pruebas automatizadas.

## Que valida esta primera fase

El workflow `Android Emulator Smoke Test` valida que GitHub Actions puede:

- Preparar un runner `ubuntu-latest`.
- Habilitar permisos KVM para el emulador Android.
- Iniciar un emulador Android headless usando `reactivecircus/android-emulator-runner@v2`.
- Conectar con el emulador mediante `adb`.
- Listar dispositivos conectados con `adb devices`.
- Imprimir la version de Android.
- Imprimir el modelo del dispositivo emulado.
- Ejecutar comandos basicos de smoke test contra el emulador.
- Finalizar exitosamente la POC.

## Workflow

Archivo:

```text
.github/workflows/android-emulator-smoke-test.yml
```

Configuracion principal:

- Nombre: `Android Emulator Smoke Test`
- Runner: `ubuntu-latest`
- Ejecucion manual: `workflow_dispatch`
- Ejecucion automatica en push: no configurada
- API level: `35`
- Target: `google_apis`
- Arquitectura: `x86_64`
- Perfil: `pixel_6`
- Modo headless: habilitado
- Animaciones: desactivadas

## Como ejecutar el workflow manualmente

1. Abrir el repositorio en GitHub.
2. Ir a la pestana **Actions**.
3. Seleccionar el workflow **Android Emulator Smoke Test**.
4. Hacer clic en **Run workflow**.
5. Seleccionar la rama `main`.
6. Confirmar con **Run workflow**.

Este workflow no se ejecuta automaticamente en `push`. Debe iniciarse manualmente desde GitHub Actions.

## Resultado esperado

Al ejecutar el workflow, los logs de GitHub Actions deben mostrar:

- Configuracion de permisos KVM.
- Inicio exitoso del emulador Android.
- Salida de `adb devices` mostrando un dispositivo conectado.
- Version de Android impresa desde `ro.build.version.release`.
- Modelo del dispositivo impreso desde `ro.product.model`.
- Valor de `window_animation_scale`.
- Mensaje `Android emulator is running successfully`.
- Mensaje final `POC completed: Android emulator started successfully`.

## Proximas fases

- Fase 2: instalar una APK.
- Fase 3: levantar Appium.
- Fase 4: ejecutar pruebas WebdriverIO/Appium.
- Fase 5: publicar reportes Allure.

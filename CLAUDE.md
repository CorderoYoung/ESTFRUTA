# EstFruta — contexto para Claude Code

App React + Firebase para estimación de cosecha de piña. Funciona online y offline (muestreadores de campo).

## Antes de proponer cambios

**Leer `ESTFRUTA_CODEX_Contexto.md`** (en esta misma carpeta). Es la fuente de verdad del proyecto: arquitectura, convenciones, bugs resueltos, bugs abiertos y 30 reglas de trabajo. Este archivo solo resume lo imprescindible y apunta allá.

El plan de la migración multiempresa está en `ESTFRUTA_PLAN_MULTIEMPRESA_OPCION_B.md`.

## Lo que no se toca

- `src/index.js` importa `AppTomaFisica.js`. **`App.js` y `AppConsultaEdicion.js` no se usan** — editarlos no tiene ningún efecto.
- `calcularEstimacion()` en `src/services/estfrutaAnalysisService.js` está validado contra datos reales: **nunca modificarlo**. Para proyecciones nuevas usar `proyectarCajas()` del mismo archivo — no reimplementar la fórmula (ya pasó: llegó a estar duplicada en 5 lugares con criterios de redondeo distintos).
- Firebase config, lógica offline y `ProtectedRoute` no se tocan sin una razón explícita.

## Una sola copia del proyecto

`C:\proyectos\estfruta` es la única copia local, con git. El CODEX y el plan viven aquí dentro. La copia de OneDrive se abandonó el 7-nov-2026: no buscarla y no replicar nada.

## firestore.rules

- **No tiene fecha de expiración y no debe volver a tenerla.** La anterior venció el 31-ago-2026 y dejó la app sin acceso a Firestore durante 68 días sin que nadie lo notara.
- Editar el archivo **no cambia nada** hasta publicarlo: consola de Firebase, o `firebase deploy --only firestore:rules` (`.firebaserc` ya apunta al proyecto `estfruta`).
- Antes de un deploy, releer el archivo desde el disco para confirmar que contiene lo que se cree. Después del deploy, verificar con una lectura real contra la API, no asumir.
- Las reglas validan los campos en **mayúscula** (`Cosecha`, `Tipo`, `Lote`, `Parcela`). Es correcto: los encabezados se crean así. **No pasarlas a minúscula** — rompería la creación de encabezados.

## Bloqueante abierto

`addDoc` se importa en `src/services/estimationService.js` pero **no se llama en ninguna parte del archivo**: no se pueden crear estimaciones nuevas. En `requestCreateEstimation` quedó un `throw new Error(...)` de depuración justo donde debería ir el `addDoc`. Leer y actualizar estimaciones existentes sí funciona.

Detalle y qué revisar antes de arreglarlo: CODEX → "Bugs detectados — pendientes de corregir".

## Al terminar

Si se edita el CODEX o el plan, recordar volver a subirlos al project knowledge de Claude en claude.ai — esa es la copia que ve el proyecto desde la web.

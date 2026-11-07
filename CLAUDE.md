# EstFruta — contexto para Claude Code

App React + Firebase para estimación de cosecha de piña. Funciona online y offline (muestreadores de campo).

## Antes de proponer cambios

**Leer `ESTFRUTA_CODEX_Contexto.md`** (en esta misma carpeta). Es la fuente de verdad del proyecto: arquitectura, convenciones, bugs resueltos, bugs abiertos y las reglas de trabajo. Este archivo solo resume lo imprescindible y apunta allá.

Los otros dos documentos de la carpeta:

- `ESTFRUTA_HISTORIAL.md` — auditorías, incidentes de producción y bugs resueltos, fechados y con su diagnóstico. Consultarlo antes de "corregir" algo que parece raro: varias cosas que parecen bugs están explicadas ahí como decisiones deliberadas.
- `ESTFRUTA_PLAN_MULTIEMPRESA_OPCION_B.md` — el plan fase por fase de la migración a Firebase Auth + Custom Claims.

**Antes de concluir que algo está roto, buscá en todo `src/`** con `grep -rn`, no en un archivo suelto. Ya pasó documentar un bloqueante inexistente por leer un servicio en aislamiento cuando la lógica real vivía en una página.

## Lo que no se toca

- `src/index.js` importa `AppTomaFisica.js`. **`App.js` y `AppConsultaEdicion.js` no se usan** — editarlos no tiene ningún efecto.
- `calcularEstimacion()` en `src/services/estfrutaAnalysisService.js` está validado contra datos reales: **nunca modificarlo**. Para proyecciones nuevas usar `proyectarCajas()` del mismo archivo — no reimplementar la fórmula (llegó a estar duplicada en 5 lugares con criterios de redondeo distintos).
- Firebase config, lógica offline y `ProtectedRoute` no se tocan sin una razón explícita.

## Dónde se crean y se verifican las estimaciones

- **Crear:** `EstimationHeaderPage.js` → `guardarFirebase()`, con su propio `addDoc`. No es `estimationService.js`, cuyo `requestCreateEstimation` es código muerto que nadie llama.
- **Verificar:** solo `handleAprobar` en `EstimationSamplingEditPage.js`, exclusivo del rol Supervisor Estimacion, y siempre escribiendo `aprobadoPor` y `aprobadoEn` junto a `verificado: true`. **Nunca escribir `verificado` desde otro lugar** — ni al navegar, ni al guardar, ni en un efecto.
- **Descartar:** no se elimina, se anula. `firestore.rules` bloquea `delete` siempre, a propósito. Se escribe `anulado: true` con `anuladoPor` y `anuladoEn`.

**Toda pantalla o query nueva que lea `estimaciones` debe excluir los anulados** (`anulado !== true`), incluidos los chequeos de duplicados. Si no, un registro descartado sigue sumando en las proyecciones de cajas/ha, o bloquea rehacer el muestreo.

## Permisos

La matriz está en `src/constants/permissions.js` y **esa es la fuente de verdad**, no la tabla del CODEX.

Ojo: la matriz casi no se aplica. Solo `PantallaConsultaEstFruta` y `EstimationHeaderPage` la consultan. `EstimationSamplingEditPage` usa su propio `isSupervisorEstimacion`. Las demás pantallas no aplican ningún control de rol.

Solo el **Muestreador** puede iniciar un muestreo; ni siquiera el Administrador. No es un bug.

## Publicar cambios

Dos cosas que no surten efecto solas:

- **`estfruta.web.app` sirve `build/`, no `src/`.** Para que un cambio llegue a los celulares: `npm run build` y después `firebase deploy --only hosting`. Luego recargar fuerte en el dispositivo — el service worker de la PWA puede seguir sirviendo el bundle anterior.
- **`firestore.rules` solo obedece a lo publicado.** Publicar en la consola de Firebase o con `firebase deploy --only firestore:rules`. Antes del deploy, releer el archivo desde el disco; después, verificar con una lectura real contra la API. Una escritura puede reportar éxito sin aplicarse.

`firestore.rules` **no tiene fecha de expiración y no debe volver a tenerla**: la anterior venció y dejó la app sin acceso a Firestore durante 68 días sin que nadie lo notara.

## Al terminar

Si se edita el CODEX o el plan, recordar volver a subirlos al project knowledge de Claude en claude.ai — esa es la copia que ve el proyecto desde la web.

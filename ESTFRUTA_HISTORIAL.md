# ESTFRUTA — Historial de auditorías e incidentes

> Complemento de `ESTFRUTA_CODEX_Contexto.md`. Aquí vive el **registro fechado**: auditorías, incidentes de producción y bugs resueltos, cada uno con su diagnóstico completo y por qué se decidió lo que se decidió.
>
> El CODEX es la referencia operativa y es el que hay que leer antes de proponer cambios. Este documento se consulta cuando se quiere entender **por qué** algo está como está, o antes de "corregir" algo que parece raro — varias de las cosas que parecen bugs aquí están explicadas como decisiones deliberadas.
>
> Orden: de lo más antiguo a lo más reciente.

---

<a id="auditoria-motores-calculo"></a>
## Auditoría de Motores de Cálculo — 2026-07-28 ✅ Decidido e implementado (Opción A)

> Origen: revisión solicitada por Freddy antes de iniciar la Fase Multiempresa (S8/S9). Diagnóstico inicial hecho aquí; segunda opinión pedida a Claude Code (en VS Code, sobre `C:\proyectos\estfruta`) para confirmar antes de decidir — ambos coincidieron. Implementado el mismo día en `C:\proyectos\estfruta` (git, 36 cambios pendientes de esa sesión incluidos estos).

### Inventario real: son 5 implementaciones de la proyección de cajas, no 2

La sección anterior documenta 2 motores con propósitos distintos (conteo de frutas vs. proyección de cajas). Pero dentro del motor de **proyección de cajas** (`% empacable → cajas por tamaño → /8 no empacables`), la fórmula está reimplementada 5 veces en archivos distintos, cada una con su propio criterio de redondeo:

| # | Archivo → función | Usado por | Criterio de redondeo del total |
|---|---|---|---|
| 1 | `estfrutaAnalysisService.js` → `calcularEstimacion()` | `PantallaEstimacionPorSeccion.jsx` | Redondeo al final: `round(Σ cajas sin redondear)` |
| 2 | `PantallaEstimacionPorGF.js` → `calcularGF()` | Pantalla Estimación por GF | Mixto: `cajasExport` = redondeo al final; `totalCajasTabla` (tabla T5–T12) = suma de cada tamaño ya redondeado |
| 3 | `PantallaAnalisisGF_Lote.js` → `calcularAgrupado()` | Resumen del lote | Redondeo por tamaño: `Σ cajasRedondeadasPorTam` |
| 4 | `PantallaAnalisisGF_Lote.js` → `calcularParcela()` | Fila de cada parcela en la lista | Redondeo al final |
| 5 | `PantallaAnalisisParcelaDetalle.jsx` → `calcular()` | Detalle de esa misma parcela | Redondeo por tamaño |

Ninguna de las 4 pantallas de análisis por GF/Lote/Parcela llama a `estfrutaAnalysisService.js`; cada una duplica la fórmula a mano con su propio criterio de redondeo.

### Bugs concretos encontrados

**1. Mismo dato, dos pantallas, dos números.** `PantallaAnalisisGF_Lote.js` (función 4, lista de parcelas) y `PantallaAnalisisParcelaDetalle.jsx` (función 5, detalle de esa parcela) calculan la **misma parcela** con criterios de redondeo distintos. Al navegar de la lista al detalle (botón 📈), "Cajas Exp" puede cambiar de valor, y como "Cajas/Ha" está coloreado por umbral (verde ≥7500, naranja ≥5500, rojo <5500), **el color puede cambiar entre pantallas para la misma parcela.**

**2. Inconsistencia dentro de la misma pantalla.** En `PantallaEstimacionPorGF.js`, la tabla T5–T12 (suma de `cajasRedondeadasPorTamano`) y el renglón "Cajas Empacables" del resumen (`cajasExport`) pueden no coincidir, por el criterio de redondeo mixto dentro de la propia `calcularGF()`.

**3. Código muerto que revela un tercer criterio — ✅ decisión tomada 2026-07-28 (confirmado con datos reales de producción).** `PantallaAnalisisGF_Lote.js` calcula `resLoteDetalle` (suma de las proyecciones individuales por parcela) pero **nunca lo renderiza** en el JSX. Da un tercer valor de "cajas del lote" distinto de `resLote.cajasExport` (que agrega los conteos crudos del lote y proyecta una sola vez) — no son equivalentes salvo que todas las parcelas tengan el mismo % de empaque.

Freddy reportó el caso real en producción: GF 11-12, Lote 21, dos parcelas (PC 21-11: 4808 cajas / 0.75 ha; RC 21-28: 1340 cajas / 0.21 ha). Suma de filas = 6148 cajas → 6148/0.96 = 6404 cajas/ha. El encabezado del lote mostraba **6141 cajas / 6397 cajas·ha** — no coincide con la suma, y a simple vista parece un bug.

No lo es: `calcularAgrupado()` combina las muestras crudas (tamaños + defectos) de las dos parcelas y calcula un único % de empaque para el lote completo antes de proyectar; cada fila usa su propio % de empaque calculado por separado. Como el % de empaque de PC y RC no es igual, "combinar-primero" (6141) y "sumar-proyecciones-separadas" (6148) dan resultados distintos — es la misma razón matemática por la que en S11 se prefirió redondeo-al-final sobre suma-de-redondeados: agregar antes de proyectar es más robusto que sumar proyecciones calculadas por separado.

**Decisión (Opción 1 de 3 presentadas):** mantener `resLote.cajasExport`/`cajasHa` (agregar-primero) como el número oficial del encabezado — no cambiarlo a la suma de filas. Se agregó una nota visual bajo el resumen del lote (`.agl-resumen-nota` en `PantallaAnalisisGF_Lote.js`/`.css`) aclarando "Total del lote (muestras combinadas) — no es la suma de las parcelas de abajo", para que no se lea como un error en campo. `resLoteDetalle` se dejó tal cual (código muerto, sin usar).

**4. Clamping inconsistente entre guardar y consultar.** `estimationBusinessRules.js → aggregateFrutasFromDetalle()` (al guardar) hace `Math.max(0, Math.trunc(suma))` por clave — descarta netos negativos por tamaño/defecto. Ninguno de los 5 motores de proyección hace este clamping: suman los deltas crudos tal cual. Si alguna corrección deja un neto negativo en algún código, lo guardado en Firebase y lo mostrado en análisis pueden divergir más allá del simple redondeo.

**5. Convención `??` vs `||` rota.** `PantallaEstimacionPorSeccion.jsx` arma la cabecera con `||` (líneas 48–58: `data.Tipo || data.tipo`, `Number(data.PtasEstac || ...)`, etc.) en vez de `??`, contra la Regla 8 de este documento ("usar `??` para no descartar 0 válidos").

### Por qué importa antes de multiempresa

La migración multiempresa va a tocar exactamente estos mismos archivos (todas sus queries `getDocs`/`getDoc` necesitan `where('empresaId', ...)` — ver inventario en [Plan Multiempresa](ESTFRUTA_CODEX_Contexto.md#plan-multiempresa--decisión-de-seguridad)). Si se modifican sin unificar antes el criterio de redondeo, la inconsistencia se arrastra a las nuevas queries y se vuelve más difícil distinguir "bug de redondeo preexistente" de "bug introducido por el filtro de empresa".

### Decisión — 2026-07-28: Opción A (unificar en un solo motor)

Confirmada con segunda opinión de Claude Code sobre el mismo código (`C:\proyectos\estfruta`), que recalculó el fixture de forma independiente y llegó a la misma conclusión. Especificación de la decisión:

**1. Criterio de redondeo canónico: redondeo al final, no por tamaño.**
`totalCajas` (el KPI que alimenta "Cajas Exp" y el color de "Cajas/Ha") debe calcularse siempre como `round(Σ cajas por tamaño sin redondear)`. Sumar 8 valores ya redondeados por separado puede acumular hasta ±4 cajas de error frente al estimado continuo, y con umbrales de color en 7500/5500 cajas/ha ese ruido puede cambiar el semáforo de una parcela sin que haya cambiado el dato real — es un defecto, no una variante de negocio válida.

**2. El redondeo por tamaño se conserva, pero solo como cosmético para la tabla T5–T12.**
Es correcto y necesario para que las filas de la tabla (cuántas cajas de talla 7 hubo) sean números enteros presentables. Pero esa suma de filas **nunca debe retroalimentar** el KPI, el color de Cajas/Ha, ni ningún otro total mostrado.

**3. Extraer una única función `proyectarCajas(tamanos, defectos, ptasEst, area)` en `estfrutaAnalysisService.js`.**
Las 5 implementaciones hacen la misma matemática de 3 etapas (% empacable → cajas por tamaño → no-empacables/8) sobre la misma forma de entrada. `calcularGF` y `calcularAgrupado` solo agregan varios documentos antes de proyectar (pre-procesamiento del input, no una variante del algoritmo); `calcularParcela` y `calcular()` operan sobre un único documento (mismo caso, N=1). No hay ninguna diferencia de negocio real entre los 5 sitios — es deuda técnica de copy-paste, no una decisión de diseño.

**4. Validación contra el fixture del Sprint 1.**
Recalculado dos veces de forma independiente con los datos de prueba (`ptasEst: 44379, área: 0.75`): suma sin redondear ≈ 4808.01 → round-final → **4808**, que coincide con el valor documentado. En este dataset específico la suma de tamaños ya redondeados también da 4808 — coincidencia de estos números (solo T10 cruza el 0.5), no evidencia de que los dos métodos sean equivalentes en general.

**Implementado — 2026-07-28, en `C:\proyectos\estfruta`:**

- `src/services/estfrutaAnalysisService.js`: se agregó `export function proyectarCajas({ tamanos, totalDefectos, ptasEst, area })`. **No se tocó `calcularEstimacion()`** (sigue siendo el motor validado, usado sin cambios por `PantallaEstimacionPorSeccion.jsx`) — `proyectarCajas()` es una función nueva con la misma matemática, pensada para recibir `tamanos`/`totalDefectos` ya agregados en vez de un `detalle` crudo.
- `src/pages/PantallaEstimacionPorGF.js` → `calcularGF()`: ahora llama a `proyectarCajas()`. `cajasExport`, `cajasHa`, `totalDisp`, `cajasHaTotal` vienen siempre de `proyeccion.totalCajas` (round-final). `totalCajasTabla` se conserva solo como dato informativo de la tabla T5–T12.
- `src/pages/PantallaAnalisisGF_Lote.js` → `calcularAgrupado()` y `calcularParcela()`: ambas migradas a `proyectarCajas()`. `resLoteDetalle` se dejó intacto — sigue sin usarse en el render.
- `src/pages/PantallaAnalisisParcelaDetalle.jsx` → `calcular()`: migrada a `proyectarCajas()`. Este era el bug #1 concreto.

**Validación:** creado `src/services/estfrutaAnalysisService.test.js` (Jest, corre independiente del resto de la app) con el fixture del Sprint 1. Freddy lo corrió con `npm test -- --watchAll=false --testPathPattern=estfrutaAnalysisService`:

```
PASS  src/services/estfrutaAnalysisService.test.js
Test Suites: 1 passed, 1 total
Tests:       4 passed, 4 total
```

Los 4 tests cubren: (1) `calcularEstimacion()` sigue dando `totalCajas 4808 / cajasNoEmpacables 780 / totalCajasGeneral 5588 / cajasHaEmpacables 6411 / cajasHaTotal 7451`; (2) `proyectarCajas()` da exactamente los mismos 5 valores con `tamanos`/`totalDefectos` ya agregados; (3) ambas funciones coinciden entre sí para el mismo input; (4) documenta que `totalCajas` (KPI) y la suma de `cajasRedondeadasPorTamano` (cosmética) coinciden en este fixture, pero deja explícito que solo `totalCajas` es el KPI válido.

(`App.test.js` — el test por defecto de CRA sobre `src/App.js`, el archivo **no usado** — sigue fallando por un `node_modules/react-router-dom` faltante; problema de instalación preexistente.)

✅ **Sincronizado entre copias — 2026-07-28.** El cambio (S11 y S12) se replicó en `OneDrive - Martial Vox\proyectos\estfruta`; ambas carpetas quedaron idénticas en estos 5 archivos + el test nuevo. (Histórico: esa segunda copia se descartó el 2026-11-07 — ver [Copia única del proyecto](#copia-unica).)

### Estado
✅ **Decidido, implementado, validado con test automatizado y sincronizado entre ambas copias del código** (S11 y S12).

---

<a id="incidente-reglas-2026-11-07"></a>
## Firestore Rules — Incidente de vencimiento (2026-11-07) ✅ RESUELTO

> ⚠️ **Lección principal: la app estuvo caída 68 días sin que nadie lo detectara.** Las reglas publicadas tenían fecha de expiración `2026-08-31`. A partir del 1 de setiembre de 2026, Firestore rechazó **todo** acceso (lectura y escritura) para todos los usuarios. Nadie lo notó hasta el 7 de noviembre. Si se vuelve a poner una fecha de expiración en las reglas, poner también un recordatorio de calendario — el CODEX solo no alcanzó.

### Qué pasaba

La condición `request.time < timestamp.date(2026, 9, 1)` aparecía en **tres** lugares de `firestore.rules`, no en uno:

```js
allow read:   if request.time < timestamp.date(2026, 9, 1);   // línea 31
allow create: if request.time < timestamp.date(2026, 9, 1)    // línea 33
              && ...
allow update: if request.time < timestamp.date(2026, 9, 1)    // línea 42
              && ...
```

Se verificó en la consola de Firebase que las reglas **publicadas** (versión del 17-jun-2026) eran idénticas a las del repositorio — es decir, la app efectivamente llevaba desde el 1 de setiembre sin poder leer ni escribir.

### Qué se hizo — 2026-11-07

Se reemplazaron las tres condiciones de fecha por `true`, sin tocar nada más: las validaciones de forma (`hasAll(['Cosecha','Tipo','Lote','Parcela'])` y los chequeos de tipo) quedaron intactas, y `allow delete: if false` sigue bloqueando borrados.

- Publicado en la consola de Firebase (nueva versión activa: 7-nov-2026, 10:09 a.m.).
- Archivo `C:\proyectos\estfruta\firestore.rules` actualizado y dejado idéntico a lo publicado.
- **Verificado end-to-end:** lectura sin autenticar contra `https://firestore.googleapis.com/v1/projects/estfruta/databases/(default)/documents/estimaciones?pageSize=1` → HTTP 200, documento devuelto. Firestore responde otra vez.
- La copia de OneDrive quedó descartada ese mismo día — ver [Copia única del proyecto](#copia-unica).

### ❌ Corrección a lo que decía este CODEX: NO hay "mismatch crítico" de mayúsculas

La versión anterior de este documento afirmaba, en mayúsculas y con ⚠️, que `estimationService.js` guarda en minúscula mientras las reglas exigen mayúscula, y que por lo tanto **"toda escritura a `estimaciones` está siendo rechazada hoy mismo"**. **Eso era falso**, y la Fase 0.1 del plan multiempresa se puede cerrar sin trabajo.

Por qué era falso, verificado contra un documento real de producción:

1. Los documentos contienen **las dos grafías a la vez** — ver [Los documentos reales tienen las dos grafías conviviendo](ESTFRUTA_CODEX_Contexto.md#doble-grafia-campos). El encabezado se crea con `Cosecha`/`Tipo`/`Lote`/`Parcela` en mayúscula.
2. Al **crear**, `request.resource.data` trae las mayúsculas → `hasAll([...])` pasa.
3. Al **actualizar**, `request.resource.data` en Firestore es el documento **fusionado resultante**, no solo los campos enviados. Como el documento ya tenía las mayúsculas, `hasAll([...])` también pasa, aunque `estimationService.js` mande solo minúsculas.

> ⚠️ **No "arreglar" las reglas cambiando las mayúsculas a minúsculas.** Sería introducir el bug que el CODEX creía que ya existía: rechazaría la creación de encabezados nuevos.

### Estado actual de `firestore.rules` (post-arreglo)

- Sin fecha de expiración.
- Siguen marcadas como "TEMPORALES DE PRUEBA — NO aptas para producción", y con razón: ver abajo.
- `allow read: if true` — cualquiera puede leer, sin restricción de identidad.
- `allow create` / `allow update` — validan **forma** del documento (campos en mayúscula presentes), no identidad.
- `allow delete: if false` — eliminación bloqueada siempre ✅

### Lo que las reglas NO pueden hacer sin Firebase Auth

Sin `request.auth` (siempre `null` en la arquitectura actual), las reglas no pueden:
- Verificar a qué empresa pertenece quien hace el request
- Impedir que un usuario de Empresa A lea datos de Empresa B
- Validar roles (Muestreador, Supervisor, etc.) en el servidor

> ⚠️ **La exposición sigue abierta y ya no tiene fecha de cierre automática.** Antes, la fecha de expiración actuaba como un cierre forzado (brutal, pero cierre). Ahora cualquiera con el `projectId` puede leer y escribir en `estimaciones` indefinidamente, hasta que se ejecute la Fase 6 del plan multiempresa (Firebase Auth + Custom Claims). La validación de forma no es seguridad: un atacante puede incluir esos cuatro campos sin esfuerzo. **Esta es ahora la razón principal para priorizar la Fase 6**, ya no el deadline de agosto.

---

<a id="copia-unica"></a>
## Copia única del proyecto — decisión 2026-11-07

Hasta esta fecha el proyecto vivía en dos carpetas que había que mantener sincronizadas a mano: `C:\proyectos\estfruta` (con git, uso diario en VS Code) y una copia en OneDrive donde vivía este CODEX.

**Esa segunda copia ya no existe y se descartó deliberadamente.** Al buscarla el 2026-11-07 no apareció en ningún lado de la máquina: ni bajo `C:\Users\Freddy Cordero` (solo hay `OneDrive` personal y `OneDrive - Mundifrenos`, esta última **vacía**), ni en la raíz de `C:\`, ni en `C:\proyectos\BACKUP`. El nodo "OneDrive - Martial Vox" que muestra el Explorador de Windows es solo una etiqueta: no corresponde a ninguna carpeta sincronizada en disco.

**Desde ahora:**
- `C:\proyectos\estfruta` es la **única** copia local. Tiene git, así que los cambios quedan versionados.
- Este CODEX vive dentro de esa carpeta (`C:\proyectos\estfruta\ESTFRUTA_CODEX_Contexto.md`), ya no en OneDrive.
- La copia de referencia compartida sigue siendo el project knowledge de Claude. Tras editar el CODEX o el plan, volver a subirlos ahí.
- Ya **no** aplica la vieja regla de "aplicar cada cambio de código en ambas carpetas".

### Por qué importaba: un cambio que se perdió sin aviso

El mismo día, al escribir `firestore.rules` en el repo, una primera escritura **reportó éxito pero no se aplicó**. El archivo que quedó en disco fue una versión descartada, con los campos validados en **minúscula** — justo la variante que este documento advierte que rompería la creación de encabezados (ver [doble grafía](ESTFRUTA_CODEX_Contexto.md#doble-grafia-campos)). Se detectó solo porque se volvió a leer el archivo desde el disco en vez de confiar en la confirmación de "escrito".

De ahí la regla 25: después de tocar `firestore.rules`, **leerlo de vuelta desde el disco y compararlo con lo publicado antes de hacer `firebase deploy`**. Un deploy desde esa carpeta en ese momento habría publicado reglas rotas encima de las buenas.

---

<a id="bugs-verificacion-2026-11-07"></a>
## Verificación y anulación de muestreos — tres bugs corregidos (2026-11-07)

> Encontrados probando la app en campo desde el celular, con usuarios reales. Los tres estaban en `EstimationSamplingEditPage.js` y estaban conectados entre sí.

### Bug 1 — Cualquier rol daba por verificado un muestreo con solo salir de la pantalla

El botón Volver ejecutaba esto, sin ningún control de rol y con el comentario *"siempre habilitado para todos los roles"*:

```js
onClick={async () => {
  if (id) {
    await updateDoc(doc(db, 'estimaciones', id), { verificado: true });
  }
  navigate(-1);
}}
```

Un Muestreador abría un registro, presionaba ⬅ y el círculo pasaba de naranja a verde. Sin validar que el Total igualara Plantas Muestreadas y sin dejar constancia de quién aprobó.

**Corregido:** el botón solo navega. La verificación es exclusiva del Supervisor Estimacion vía `handleAprobar`.

### Bug 2 — El botón Aprobar estaba permanentemente deshabilitado

```js
// Antes — el parametro se llamaba mal:
const countsMatch = canCreateEstimationRecord({
  PtasMuest,                        // la funcion espera "ptasMuestras"
  frutasTotales: safeFrutasTotales,
});
```

`canCreateEstimationRecord({ ptasMuestras, frutasTotales })` recibía `ptasMuestras: undefined`, y `parseCount(undefined)` devuelve `null`, así que **`countsMatch` era siempre `false`**. Consecuencias: el botón ✓ (`disabled={!countsMatch}`) nunca se habilitaba, y el mensaje rojo *"Total debe igualar PtasMues"* aparecía incluso con los valores iguales.

**Los bugs 1 y 2 son el mismo problema.** La verificación vivía en el botón Volver justamente porque Aprobar nunca funcionó. Corregir solo el 1 habría dejado los registros imposibles de verificar.

**Corregido:** `ptasMuestras: PtasMuest`.

> ⚠️ `handleSave` y `handleAprobar` hacen además su propia comparación numérica directa (`safeFrutasTotales !== ptasMuesNum`), que sí era correcta. Por eso Guardar funcionaba y Aprobar no.

<a id="borrado-logico"></a>
### Bug 3 — El botón Eliminar no podía funcionar nunca

`handleDelete` llamaba a `deleteDoc`, pero `firestore.rules` tiene `allow delete: if false` **a propósito**, para no perder la trazabilidad de quién capturó cada muestreo. El resultado era un error crudo de Firebase en inglés en pantalla: *"Missing or insufficient permissions"*.

**Decisión: borrado lógico, no abrir el borrado real.** Una estimación es una medición de campo con fecha y autor; borrarla elimina evidencia que alimenta decisiones de producción. Y sin Firebase Auth nadie sabría quién borró qué. Es la misma lógica que el plan multiempresa adopta para usuarios (`activo: false`).

**Implementado:**

```js
await updateDoc(doc(db, 'estimaciones', id), {
  anulado: true,
  anuladoPor: resolvedUser?.Usuario ?? 'Supervisor',
  anuladoEn: new Date(),
});
```

Y **las seis pantallas que leen `estimaciones` excluyen los anulados**:

| Archivo | Cómo filtra |
|---|---|
| `PantallaConsultaEstFruta.js` | `.filter((doc) => doc.data()?.anulado !== true)` antes del `.map()` |
| `PantallaEstimacionPorGF.js` | `.filter((d) => d.anulado !== true)` — crítico: si no, entran en las proyecciones |
| `PantallaAnalisisGF_Lote.js` | igual |
| `PantallaAnalisisParcelaDetalle.jsx` | anulado se trata como "no encontrado" |
| `PantallaEstimacionPorSeccion.jsx` | igual |
| `PantallaDatosGuardadosCelular.js` | el chequeo de duplicados al sincronizar ignora anulados |

Más `EstimationHeaderPage.js`: el chequeo de duplicados al crear ignora anulados, para poder **rehacer** un muestreo descartado.

No hizo falta migrar datos: los documentos existentes no tienen el campo y la comparación es `!== true`, así que pasan el filtro.

### Limpieza de datos — hecha el 2026-11-07

Auditoría de los 26 documentos de `estimaciones` (todos de 2026), leyendo la API REST de Firestore:

| | |
|---|---|
| Total de documentos | 26 |
| Anulados | 5 |
| Vigentes | 21 |
| Vigentes con aprobación real (`aprobadoPor`) | **0** |

O sea: **ningún registro de la base tenía una aprobación real de supervisor.** Todos los círculos verdes de la app venían del bug 1.

Antes de tocar nada se verificó si el dato de fondo estaba bien: en los 21 vigentes, la suma de `cantidadDelta` del array `detalle` **coincide exactamente** con `PtasMues`. El muestreo estaba bien hecho; lo único que faltaba era el acto de aprobación.

**Acción tomada:** a esos 21 se les escribió `verificado: false` más `verificacionReseteadaEn` (timestamp) como marca de auditoría, vía PATCH con `updateMask` para no tocar ningún otro campo. Los 5 anulados se dejaron como estaban. Verificado después: 21 pendientes, 0 verificados sin aprobación, los 21 con el `detalle` intacto.

Quedan a la espera de que el Supervisor Estimacion los apruebe con el botón ✓ — los 21 pasan la validación, así que es un toque por registro.

<a id="frutastotales-desactualizado"></a>
### Hallazgo colateral: `frutasTotales` guardado está desactualizado

En la misma auditoría apareció otro problema, **no relacionado con los tres bugs de arriba**: en **20 de los 21 documentos vigentes**, el campo agregado `frutasTotales` que está guardado en Firestore no coincide con la suma real del `detalle`.

| Parcela | `PtasMues` | `frutasTotales` guardado | Suma real del `detalle` |
|---|---|---|---|
| GF 5-20, Lote 11, Parcela 40 | 448 | **3** | 448 |
| GF 5-20, Lote 11, Parcela 3 | 1008 | **3** | 1008 |
| GF 11-12, Lote 21, Parcela 11 | 2660 | **0** | 2660 |
| GF 11-12, Lote 2, Parcela 58 | 3087 | **2** | 3087 |

Las pantallas de análisis (Patrón A) recalculan desde `detalle`, así que **las proyecciones de cajas/ha no están afectadas**. Pero `PantallaConsultaEstFruta` y `PantallaDatosGuardadosCelular` (Patrón B) leen los campos guardados tal cual, así que ahí ese número se muestra mal.

Es exactamente la fragilidad que el CODEX ya advertía: los dos motores de cálculo (`estimationBusinessRules.js` al guardar, `estfrutaAnalysisService.js` al consultar) no están sincronizados.

**Sin diagnosticar todavía.** Hay que averiguar en qué momento se escribe ese valor y por qué queda con el conteo de las primeras pulsaciones en vez del total final — probablemente se guarda el agregado antes de que el `detalle` esté completo. No se tocó ningún dato: corregirlo requiere entender primero el flujo de escritura.

---

## Bugs resueltos

| Bug | Causa raíz | Solución |
|---|---|---|
| Navegación a `/seccion/:id` iba a login | `index.js` importaba `AppTomaFisica`, no `App.js` | Editar el archivo correcto |
| `currentUser` llegaba `null` a `ProtectedRoute` | `useState(null)` + `useEffect` asíncrono | `useState(() => localStorage.getItem(...))` síncrono |
| Sesión se perdía entre navegaciones | `sessionStorage` se borra con refresh | Cambiar a `localStorage` |
| Ruta `/seccion/:id` no existía | Solo estaba en `App.js` (no usado) | Agregar a `AppTomaFisica.js` |
| Botón 📈 no navegaba | No tenía `onClick` en el backup original | Agregar `navigate()` directo sin `setTimeout` |
| "Debe verificar antes de regresar" | Validación con `savedSamplingId`/`verifiedSamplingId` | Reemplazar por `verificado: true` en Firebase |
| Botón 📈 de parcela navegaba a `PantallaConsultaEstFruta` | Rutas nuevas solo en `App.js` y `AppConsultaEdicion.js`, no en `AppTomaFisica.js` | Agregar import y ruta en `AppTomaFisica.js` |
| Lista mostraba Lote incorrecto | `data.lote \|\| data.Lote` — el número guardado tenía prioridad sobre el string correcto | Cambiar a `data.Lote ?? data.lote` (mayúscula primero, nullish) |
| Tabla % tamaños se encogía en celular | Faltaba `table-layout: fixed` y `width: 12.5%` por celda | Agregar en base y en `@media (max-width: 600px)` |
| Gráfico defectos con espacio vacío arriba | `.papd-card--defectos` tenía `flex: 1` | Eliminar `flex: 1`, fijar `height: 130px` igual que cajas |
| Módulo no encontrado `PantallaAnalisisParcelaDetalle` | Archivo descargado como `.jx` en lugar de `.jsx` | Renombrar extensión en VS Code |
| `ProtectedRoute` bloqueaba roles válidos | `permissions.js` tenía `"SupervisorEstimacion"` (sin espacio) y `"GerenteGeneral"` mientras `roles.js` tenía `'Supervisor Estimacion'` y `'Gerente General'` | Sincronizar valores string exactos en `permissions.js` con `roles.js` |
| Error de compilación en `AppTomaFisica.js` | Importaba `getActiveUsers` y `authenticateUser` pero `authService.js` solo exportaba `USERS` y `validateCredentials` | Agregar ambas funciones con la firma correcta |
| `navigate()` recibía `undefined` tras login | `authenticateUser` no devolvía `redirectPath` | Agregar `redirectPath: ROLE_ROUTES[user.Rol]` al objeto de retorno |
| `setError` recibía `undefined` en login fallido | `authenticateUser` devolvía `message` pero `AppTomaFisica.js` lee `result.error` | Usar clave `error` (no `message`) en el objeto de retorno de error |
| Muestreador asignado como `SUPERVISOR_ESTIMACION` | Confusión entre nombre de usuario visible y rol interno | Restaurar `ROLES.MUESTREADOR = 'Muestreador'` como rol independiente |
| "Cajas Exp" y color de "Cajas/Ha" cambiaban entre lista de parcelas y detalle de parcela para el mismo registro | 5 implementaciones distintas de la fórmula de proyección de cajas, cada una con su propio criterio de redondeo | 2026-07-28 (S11): unificadas en `proyectarCajas()`, `totalCajas` (round-final) como único KPI. Ver [Auditoría de Motores de Cálculo](#auditoria-motores-calculo) |
| Tabla T5–T12 y "Cajas Empacables" podían no sumar igual en `PantallaEstimacionPorGF.js` | `cajasExport` (redondeo al final) y `totalCajasTabla` (suma de tamaños ya redondeados) se calculaban con criterios distintos dentro de `calcularGF()` | 2026-07-28 (S11): `cajasExport`/`cajasHa` ahora vienen siempre de `proyeccion.totalCajas`; `totalCajasTabla` quedó como dato solo informativo |
| "Cajas Exp/Ha" del encabezado del lote no coincide con sumar las filas de parcela (Lote 21: 6141 vs. 6148) | `calcularAgrupado()` agrega muestras crudas y proyecta una vez; cada fila usa su propio % de empaque — no son sumables entre sí | No es un bug de cálculo. 2026-07-28 (S12): se mantuvo el comportamiento y se agregó nota visual `.agl-resumen-nota` aclarándolo |
| **App completamente caída: Firestore rechazaba toda lectura y escritura desde el 1-set-2026** | Las reglas publicadas tenían `request.time < timestamp.date(2026, 9, 1)` en `allow read`, `allow create` y `allow update`. La fecha venció y nadie lo detectó durante 68 días | 2026-11-07 (S13): las tres condiciones reemplazadas por `true` y publicadas en la consola. Verificado con lectura real contra la API REST (HTTP 200). Ver [Incidente de reglas vencidas](#incidente-reglas-2026-11-07) |

---

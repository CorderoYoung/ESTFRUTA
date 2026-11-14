# Plan de Implementación — Multiempresa, Opción B (Firebase Auth)

> **Nota de título (2026-11-14):** este plan se llamó durante meses "Opción B (Firebase Auth + Custom Claims)". Los custom claims se descartaron — ver [Decisión — sin Cloud Functions](#decision-spark). El aislamiento por empresa sigue siendo el mismo y se sigue aplicando en las reglas de Firestore; lo que cambia es de dónde sale el `empresaId`: del documento `usuarios/{uid}`, no del token.

> Complementa la sección "Plan Multiempresa — Decisión de Seguridad" del CODEX. Ese documento explica **qué** hay que cambiar y **por qué** se eligió la Opción B; este documento define **en qué orden** ejecutarlo sin romper la app en producción, y qué probar en cada paso.
>
> Creado: 2026-07-28 · Actualizado: 2026-11-14.

---

## ⚠️ Cambios importantes desde la versión anterior de este plan (2026-11-07)

Tres cosas cambiaron y afectan directamente cómo se lee el resto del documento.

**1. El deadline del 31 de agosto ya pasó, y ya está resuelto.**
Las reglas de Firestore vencieron el 31-ago-2026 y **la app estuvo caída 68 días** — Firestore rechazó toda lectura y escritura desde el 1 de setiembre hasta que se detectó el 7 de noviembre. Se quitó la fecha de expiración y se republicaron las reglas ese día. Ya no hay ninguna fecha forzando la Fase 6.

**2. Lo que ahora justifica la Fase 6 es otra cosa, y es peor.**
Antes, la fecha de expiración actuaba como un cierre forzado de la exposición: brutal, pero cierre. Al quitarla, `estimaciones` quedó **abierta a lectura y escritura sin autenticación, de forma indefinida**, para cualquiera que tenga el `projectId` (que es público por diseño). La validación de forma que quedó en las reglas no es seguridad: cualquiera puede incluir esos cuatro campos. **Esa exposición permanente es ahora la razón para hacer la Fase 6**, y no tiene fecha límite que la empuje — hay que decidirla.

**3. La tarea 0.1 está cerrada: no había ningún mismatch.**
Ver Fase 0 abajo.

<a id="fecha-objetivo"></a>
### 🎯 Fecha objetivo: mediados de enero de 2027 (fijada el 2026-11-14)

La idea es **entrar en producción con Frutera Varfa a mediados de enero de 2027**, sujeto a que salga el desembolso. Es la primera fecha real que tiene el proyecto desde que venció la del 31 de agosto, y se diferencia de aquella en algo importante: aquella era una bomba de tiempo escrita dentro de las reglas, que explotó sola y dejó la app caída 68 días. Esta es una meta de calendario — si se corre, no se rompe nada.

Lo que sí implica: las Fases 3 a 6 tienen que estar **probadas**, no solo escritas, antes de esa fecha, porque la Fase 6 es el punto de no retorno y no conviene desplegarla con el equipo ya trabajando en campo.

---

## Antes de empezar: respuestas de Freddy

1. **¿Cuántas empresas hay hoy y cómo se llaman?** ✅ **Respondido: cero.** Hoy no existe ninguna empresa creada en el sistema — la app funciona como si todo fuera una sola empresa implícita. **Actualizado el 2026-11-14:** la empresa se llama **Frutera Varfa**, `empresaId: 'frutera-varfa'`. Ya no hay placeholder — el plan decía `Contoso S.A.` mientras no se sabía el nombre real. Se nace con el slug definitivo a propósito: el `empresaId` queda escrito en cada documento de `estimaciones` y en cada documento de `usuarios`, así que cambiarlo después costaría un backfill. El `nombre` sí es barato de cambiar en cualquier momento.
2. **¿Los 7 usuarios son personas reales o roles compartidos?** ✅ Respondido en su momento: son **nombres de Puesto/Cargo**, no personas individuales. ⚠️ **Reabierta el 2026-11-14 por el requisito de fincas, y hay que cerrarla antes de crear `usuarios`.** Con tres fincas, "un usuario por Cargo" pasa a ser Cargo × finca: 3 roles de finca × 3 fincas + 4 roles de alcance empresa = **13 cuentas**, con clave compartida dentro de cada puesto. El problema es que eso choca de frente con lo que se arregló el 2026-11-07: todo el punto de `aprobadoPor` es saber **quién** aprobó, y si tres muestreadores de Cabo Zarzo comparten un login, el campo dice la finca, no la persona. Las opciones son (a) una cuenta por persona, trazabilidad completa; (b) por persona solo los que firman —Supervisor Estimación, Supervisor Cosecha, Administrador— y Muestreador compartido por finca; (c) Cargo × finca, 13 cuentas, el mínimo de administración. **Pregunta adjunta:** ¿tiene correo electrónico la gente de campo? Sin correo real no funciona `sendPasswordResetEmail` y las claves las tiene que reponer el Administrador a mano.
3. **¿Pantalla de administración de usuarios ahora o después?** ✅ **Respondido: ahora.** Se agregó como **Fase 5** de este plan (implementa el Sprint S6, que en el CODEX estaba como "Futuro").

**Estado: la 1 y la 3 cerradas; la 2 reabierta el 2026-11-14 y es el único bloqueo para arrancar la Fase 3.**

---

## Nota sobre dónde vive el código (2026-11-07)

Este plan asumía dos copias locales del proyecto que había que mantener sincronizadas a mano. **Ya no.** La copia de OneDrive se descartó: `C:\proyectos\estfruta` (con git) es la única copia local, y tanto el CODEX como este plan viven dentro de esa carpeta. Ver "Copia única del proyecto" en el CODEX.

Esto simplifica cada fase: ya no hay que replicar nada. Pero agrega una verificación: **después de escribir `firestore.rules` y antes de hacer `firebase deploy`, leer el archivo de vuelta desde el disco y confirmar que contiene lo que creés.** El 7 de noviembre una escritura reportó éxito y no se aplicó; el archivo que quedó en disco era una variante rota, y un deploy en ese momento habría publicado reglas malas encima de las buenas.

---

<a id="fincas"></a>
## Requisito nuevo — fincas dentro de una empresa (2026-11-08)

Freddy lo detectó revisando la app: falta un nivel entre la empresa y el lote.

El caso real: **Frutera Varfa tiene tres fincas grandes, separadas por kilómetros.** Cada finca tiene **su propio personal** — sus Muestreadores, su Supervisor Estimación y su Supervisor Cosecha. Lo que comparten las tres es la **planta de empaque**, y por eso Frutera Varfa necesita las dos vistas: el desglose de cada finca y **el consolidado de las tres**.

La planta de empaque **no se modela como entidad** (decisión de Freddy, 2026-11-08). Es la consumidora del consolidado, no un dato de la app. Si algún día una finca despachara a otra planta, ahí habrá que revisarlo.

### Finca no es lo mismo que empresa

| | `empresaId` | `fincaId` |
|---|---|---|
| Para qué sirve | **Aislar** | **Agrupar** |
| ¿Se puede cruzar? | Nunca: Frutera Varfa no ve datos de otra empresa | Sí, y es el requisito: el consolidado cruza las tres |
| Quién lo hace cumplir | Las reglas de Firestore (Fase 6) | La UI y las queries |

> ⚠️ **No modelar las fincas como empresas separadas.** Es el error natural y rompe el requisito: el aislamiento haría imposible el consolidado que la planta necesita.

### Modelo de datos

```
empresas/{empresaId}/
  nombre, activa

fincas/{fincaId}/
  empresaId          // una finca pertenece a una sola empresa
  nombre
  activa

estimaciones/{id}/
  empresaId          // Fase 1
  fincaId            // NUEVO — se guarda en el documento, no se infiere del usuario

usuarios/{uid}/
  empresaId
  fincaId            // null = alcance empresa (ve todas las fincas)
  rol
```

**`fincaId` va escrito en el documento, no deducido de quién lo capturó.** Si solo viajara en la sesión, la finca de un registro sería una inferencia: el día que alguien quede mal asignado, los registros de esa jornada se clasifican mal y **no hay forma de detectarlo mirando los datos**. Es el mismo patrón del bug de `frutasTotales` del 2026-11-08 — un dato derivado en vez de guardado.

El valor **se pre-carga desde el usuario** en la pantalla de Encabezado, para que el muestreador no lo escriba, pero queda visible y editable, y se guarda.

Las fincas van en **catálogo, no en texto libre**: escrito a mano aparecen "La Esperanza" y "la esperanza" y el consolidado se parte en dos.

### Agregar una finca nueva no requiere tocar código

Es la ventaja de que sea un catálogo: **dar de alta una cuarta finca es crear un documento en `fincas`**, nada más. Sin cambio de esquema, sin despliegue, sin backfill.

Esa propiedad se pierde fácil si alguien la rompe sin darse cuenta, así que al implementar las fases 5 y 8:

- **Las fincas no van en un archivo de constantes**, al estilo de `DEFECT_CODES` en `sampling.js`. Se leen siempre de la colección.
- **El selector de Finca se llena desde la colección**, no desde un array escrito a mano. Si se hardcodea, la finca nueva existe en la base pero no aparece en el filtro — y ese bug cuesta verlo.
- **El reporte consolidado no se maqueta con tres columnas.** Si se arma como "Cabo Zarzo | Augrofresh | Ananasinc", una cuarta finca rompe el diseño. Tiene que recorrer las fincas que existan.

### Dos alcances de visibilidad dentro de la misma empresa

| Rol | Alcance | Ve |
|---|---|---|
| Muestreador | Su finca | Solo su finca |
| Supervisor Estimación | Su finca | Solo su finca |
| Supervisor Cosecha | Su finca | Solo su finca |
| Administrador, Gerente General, Gerente Producción, Logística | Empresa | Todas las fincas, con desglose y consolidado |

Se resuelve con `usuarios.fincaId`: lleno para los roles de finca, vacío para los que consolidan. La query filtra por finca **solo cuando el usuario tiene una asignada**; siempre filtra por empresa.

### Cambia la Regla 31 del CODEX

Hoy dice que solo el Supervisor Estimación verifica un muestreo. Con varias fincas eso ya no alcanza: tiene que ser el Supervisor Estimación **de esa finca**. Si no, el de la Finca A puede aprobar muestreos de la Finca B — el mismo tipo de agujero que se corrigió el 2026-11-07.

`handleAprobar` en `EstimationSamplingEditPage.js` debe validar, además del rol, que `user.fincaId === documento.fincaId`.

### Dónde aterriza en las fases que ya existen

No es una fase nueva: es un campo que atraviesa casi todas.

| Fase | Qué se le suma |
|---|---|
| 1 — Modelo de datos | ✅ **Hecho el 2026-11-14** — colección `fincas` creada con las tres: `cabo-zarzo`, `augrofresh`, `ananasinc` |
| 2 — Backfill | ✅ **Hecho el 2026-11-14** — los 26 documentos quedaron con `fincaId: "ananasinc"`. Eran datos de prueba, así que no hubo que mapear nada a mano (decisión del 2026-11-08; finca elegida el 2026-11-14) |
| 3 — Modelo de usuarios | `usuarios/{uid}` lleva `fincaId` además de `empresaId` y `rol`; `fincaId: null` = alcance empresa |
| 4 — Login | La sesión conserva `fincaId` |
| 5 — Admin de usuarios | Alta de usuarios con finca asignada, y alta de fincas |
| 6 — Rules | Las reglas siguen validando **solo empresa**. La finca agrupa, no aísla: meterla en las reglas impediría el consolidado |
| 7 — Inyectar al guardar | `fincaId` en el payload de `EstimationHeaderPage.js`, y **en la `uniqueKey`**: dos fincas pueden tener cada una su "Lote 11, Parcela 40" y hoy se bloquearían como duplicado falso |
| 8 — Filtrar consultas | Selector de Finca junto a GF / Lote / Sección, con opción **"Todas"** — ese "Todas" es literalmente el consolidado |
| 10 — Pruebas | Caso nuevo: supervisor de Finca A no puede aprobar un muestreo de Finca B |

### Consecuencia sobre las prioridades

Tres fincas por tres roles son nueve usuarios por empresa, más los de consolidación. Hoy los usuarios son un array escrito a mano en `authService.js`, con `Clave: '123'` para todos. **Eso no se administra.** Dicho de otra forma: el requisito de fincas **adelanta las Fases 3 y 5** — ya no es solo el argumento de seguridad, es que sin usuarios en base de datos no hay forma de asignar fincas.

### Una grafía sola

`fincaId` se escribe **en una sola grafía**, minúscula, y nada más. Los documentos actuales ya arrastran el problema de tener cada campo duplicado en mayúscula y minúscula; no agregar un caso nuevo.

---

## Fase 0 — Arreglos previos (no depende de decidir nada de multiempresa)

| # | Tarea | Archivo | Estado |
|---|---|---|---|
| 0.1 | Verificar el supuesto mismatch de mayúsculas entre el payload y las reglas | `firestore.rules` / `estimationService.js` | ✅ **CERRADA — no había mismatch.** Ver abajo |
| 0.2 | Quitar el `throw` de depuración de `requestCreateEstimation` | `estimationService.js` | ✅ **CERRADA — no bloqueaba nada.** Ver abajo |

### 0.1 — Cerrada: el mismatch no existía

El CODEX advertía que `estimationService.js` guarda los campos en minúscula mientras las reglas exigen mayúscula, y que por lo tanto toda escritura estaría siendo rechazada. Se verificó el 2026-11-07 contra un documento real de producción y **es falso**:

- Los documentos tienen **las dos grafías conviviendo** (`Cosecha` y `cosecha`, `Lote` y `lote`…). El encabezado se crea con mayúsculas.
- Al **crear**, `request.resource.data` trae las mayúsculas → la validación pasa.
- Al **actualizar**, `request.resource.data` en Firestore es el documento **fusionado resultante**, no solo los campos enviados. Como el documento ya tenía las mayúsculas, también pasa.

> ⚠️ **No "corregir" las reglas pasándolas a minúscula.** Eso sí rompería la creación de encabezados. Las reglas de la Fase 6 deben seguir usando mayúsculas, salvo que antes se haga un backfill que unifique la doble grafía.

### 0.2 — Cerrada: el `throw` es código muerto inalcanzable

Una versión anterior de este plan afirmaba que crear estimaciones no funcionaba. **Es falso.** `requestCreateEstimation` tiene efectivamente un `throw` de depuración donde iría un `addDoc`, pero **esa función no se llama desde ningún lado** — el compilador lo confirma: *'requestCreateEstimation' is defined but never used*.

La creación real vive en **`EstimationHeaderPage.js` → `guardarFirebase()`**, con su propio `addDoc`. Eso además explica por qué los documentos de Firestore tienen los campos en mayúscula: los escribe esa página.

Comprobado en producción el 2026-11-07 creando estimaciones reales desde el celular, online y offline con sincronización posterior.

Queda como limpieza opcional borrar `requestCreateEstimation` y el import de `addDoc` en `estimationService.js`, porque hacen creer que ahí se crean las estimaciones.

**Salida de la Fase 0:** ya alcanzada — se crean y guardan estimaciones de punta a punta.

---

## Fase 1 — Modelo de datos

1. Crear la colección `empresas` con la empresa real:
   ```
   empresas/
     frutera-varfa/
       nombre: "Frutera Varfa"
       activa: true
   ```
   El `empresaId` es un slug corto y estable, no un ID autogenerado. Es el valor que va a quedar escrito en cada documento de `estimaciones` y en el documento `usuarios/{uid}` de cada persona, así que se define una vez y no se toca. El `nombre` sí se puede editar cuando sea.

2. Crear la colección `fincas` con las tres fincas (nombres confirmados el 2026-11-14):
   ```
   fincas/
     cabo-zarzo/   empresaId: "frutera-varfa"   nombre: "Cabo Zarzo"   activa: true
     augrofresh/   empresaId: "frutera-varfa"   nombre: "Augrofresh"   activa: true
     ananasinc/    empresaId: "frutera-varfa"   nombre: "Ananasinc"    activa: true
   ```
   Mismo criterio de slug. `cabo-zarzo` lleva guion porque son dos palabras; `augrofresh` va con U y `ananasinc` como una sola palabra — confirmado, no son erratas.

**Salida:** las colecciones `empresas` y `fincas` creadas, con un documento y tres documentos respectivamente. **Cero impacto en la app todavía** — nada las lee, así que no hay forma de romper nada.

### ✅ Ejecutada el 2026-11-14

Creadas a mano en la consola de Firebase (https://console.firebase.google.com/project/estfruta/firestore). **No se pueden crear por REST**: `firestore.rules` tiene `match /{document=**} { allow read, write: if false; }` como regla por defecto y solo abre `estimaciones`, así que `empresas` y `fincas` solo son escribibles desde la consola o con el Admin SDK. Eso es correcto y no hay que cambiarlo.

Lo que quedó escrito, verificado documento por documento en la consola:

| Ruta | Campos |
|---|---|
| `empresas/frutera-varfa` | `nombre: "Frutera Varfa"` · `activa: true` |
| `fincas/cabo-zarzo` | `empresaId: "frutera-varfa"` · `nombre: "Cabo Zarzo"` · `activa: true` |
| `fincas/augrofresh` | `empresaId: "frutera-varfa"` · `nombre: "Augrofresh"` · `activa: true` |
| `fincas/ananasinc` | `empresaId: "frutera-varfa"` · `nombre: "Ananasinc"` · `activa: true` |

`activa` es booleano real (`true`), no la cadena `"true"` — en la consola hay que cambiar el *Tipo* a `boolean` y el *Valor* de `falso` a `verdadero`, porque los dos desplegables arrancan en el valor equivocado.

Para agregar una cuarta finca más adelante: un documento más en `fincas` con el mismo `empresaId`, desde la consola. No hay que tocar código.

---

## Fase 2 — Backfill de datos existentes

Todos los documentos de `estimaciones` hoy NO tienen `empresaId`. Antes de exigirlo en las reglas, hay que agregarlo a lo que ya existe.

1. Script único (Node + Admin SDK, o manual si son pocos documentos) que recorra `estimaciones` y agregue `empresaId: '<la empresa actual>'` a cada documento que no lo tenga.
2. Verificar con una query: contar documentos totales vs. documentos con `empresaId` — deben coincidir al terminar.
3. Aditivo únicamente — no tocar ningún otro campo.
4. Agregar en la misma pasada `fincaId: 'ananasinc'` a todos: los documentos actuales son datos de prueba, así que no hace falta decidir caso por caso (decisión de Freddy — datos de prueba el 2026-11-08, finca elegida el 2026-11-14). Ver [Requisito nuevo — fincas](#fincas).

> Oportunidad: este es el momento natural para decidir si se aprovecha el mismo script para limpiar la **doble grafía de campos** (quedarse con un solo juego, mayúscula o minúscula). No está decidido. Si se hace, las reglas de la Fase 6 deben ajustarse en el mismo despliegue.

**Salida:** el 100% de los documentos existentes tiene `empresaId` y `fincaId`.

### ✅ Ejecutada el 2026-11-14

Hecho por REST (`PATCH` con `updateMask.fieldPaths=empresaId&updateMask.fieldPaths=fincaId`), que sí se puede porque `estimaciones` está abierta — al revés que la Fase 1.

| | |
|---|---|
| Documentos tocados | **26 de 26** (21 vigentes + 5 anulados) |
| Ya tenían `empresaId` o `fincaId` antes | 0, en cualquiera de las dos grafías |
| Escritos con `empresaId: "frutera-varfa"` | 26 |
| Escritos con `fincaId: "ananasinc"` | 26 |
| Fallidos | 0 |

**Los anulados también llevan los dos campos, a propósito.** Cuando entren las reglas de la Fase 6, un documento sin `empresaId` queda ilegible de forma permanente; dejarlos fuera habría convertido el borrado lógico en un borrado real por la puerta de atrás.

Verificación posterior, sobre los 26: nada más se movió. 5 anulados, 20 vigentes con firma real de supervisor, 0 descuadres entre `frutasTotales` y `PtasMues`, y `frutasEmpacables + frutasNoEmpacables = frutasTotales` en todos. Sigue pendiente de aprobar un solo registro, `O17Df4CnDVmP2aUzNWnM` (GF 11-12) — es el mismo de antes del backfill, no lo cambió esto.

La doble grafía de campos **no se tocó**: `empresaId` y `fincaId` se escribieron en una sola grafía, minúscula. Esa limpieza, si se hace, es un trabajo aparte.

---

<a id="decision-spark"></a>
## Decisión 2026-11-14 — sin Cloud Functions, el proyecto se queda en Spark

El plan original apoyaba la Fase 3 en dos Cloud Functions con el Admin SDK. **Eso no se puede desplegar:** Cloud Functions es exclusivo del plan Blaze y el proyecto `estfruta` está en Spark. Las dos funciones eran lo único en todo el plan que exigía Blaze; nada más lo necesita.

Se evaluó subir a Blaze. El costo mensual real de esta app cae entero en la capa gratuita, así que la factura esperada sería cero, pero la retención de verificación de la tarjeta no es simbólica en Costa Rica: **Freddy ya pasó por esto con un cliente y fueron USD 50 inmovilizados mes y medio**, porque el banco espera al cierre de mes aunque Google libere antes. Se decidió no pagar eso por ahora.

**Decisión: Ruta Spark.** El rol, la empresa y la finca viven en `usuarios/{uid}` y las reglas los leen con `get()`. Las altas de usuario se hacen desde el cliente con una instancia secundaria de la app de Firebase. No es un parche temporal: es la arquitectura elegida.

Qué se gana, además de no pagar:

- **Desactivar un usuario surte efecto de inmediato.** Con custom claims el token viejo sigue siendo válido hasta que se refresca; con `get()` la regla lee el dato vivo. `activo: false` es un requisito real de la Fase 5, así que esto importa.
- **Desaparece el punto de mayor riesgo del plan.** No hay Cloud Function con Admin SDK que programar mal. El riesgo se muda a las reglas de `usuarios`, que son unas pocas líneas, saltan a la vista y se prueban con el emulador.

Qué se paga a cambio — los tres, con nombre y apellido:

- **Una lectura extra por consulta.** `get()` y `exists()` en reglas cuestan como una lectura normal. Con este volumen es ruido.
- **La casilla "Enable create (sign-up)" tiene que quedar encendida.** En Authentication → Settings → User actions se puede apagar para que solo el Admin SDK cree cuentas, pero eso también bloquearía la pantalla de la Fase 5, que crea las cuentas desde el navegador. Consecuencia: cualquiera que tenga el `projectId` puede registrarse. **Mitigación: una cuenta así no sirve de nada** — queda sin documento en `usuarios`, y las reglas le niegan todo. Hay que (a) revisar de vez en cuando la lista de Users de la consola buscando cuentas sin documento espejo, y (b) evaluar App Check para que solo la app pueda hablarle al proyecto.
- **Borrar una cuenta de Auth de verdad requiere la consola.** No estorba: el plan ya había decidido `activo: false` en vez de borrar.

**Cuándo revisar esta decisión.** El día que EstFruta necesite algo que corra en servidor sin un humano con el navegador abierto: reportes programados, correos automáticos, un recálculo nocturno, o una integración con la planta de empaque. Ahí Blaze entra por su propio peso. Migrar entonces es barato: `usuarios` ya existe, solo cambian las reglas y se agregan las funciones.

---

## Fase 3 — Firebase Authentication (infraestructura)

> Reescrita el 2026-11-14. **Ya no hay Cloud Functions** — ver la decisión de arriba.

1. **Habilitar el proveedor Email/Password** en Firebase Authentication. Hoy Authentication no está inicializado en absoluto: la consola muestra la pantalla de bienvenida con el botón "Comenzar". Email/Password es gratis en Spark; lo que exige Blaze es la autenticación por teléfono, que aquí no se usa.

2. **Arreglar `src/firebaseConfig.js`.** Hoy solo exporta `db`; falta `export const auth = getAuth(app)`. Y ojo con el bloque de configuración: el `appId` que tiene es un marcador de posición (`...web:a1b2c3d4e5f6g7h8i9j0k1`). La `apiKey` sí es real y Firestore funciona igual, pero antes de habilitar Auth hay que bajar la configuración real desde la consola (Configuración del proyecto → Tus apps) y reemplazar el objeto completo.

3. **Crear la colección `usuarios`**, espejo de las cuentas de Auth. Hace falta sí o sí porque el cliente no puede listar cuentas de Firebase Auth, y en esta ruta es además **la fuente de verdad del rol**:
   ```
   usuarios/
     <uid>/                 // uid = el mismo ID de la cuenta de Firebase Auth
       nombre:    "..."                    // nombre visible
       rol:       "Supervisor Estimacion"  // debe coincidir con ROLES de roles.js
       empresaId: "frutera-varfa"
       fincaId:   "cabo-zarzo"             // null = alcance empresa (ve todas las fincas)
       activo:    true
       creadoEn:  <timestamp>
   ```
   `activo: false` es la forma de "eliminar" un usuario, igual que `allow delete: if false` en `estimaciones`: nunca hard-delete, para no perder la trazabilidad de quién capturó qué.

4. **Bootstrap del primer Administrador, a mano y una sola vez.** En la consola: Authentication → Users → Agregar usuario (correo + clave), copiar el `uid` que queda, y crear a mano `usuarios/{uid}` con `rol: "Administrador"`, `empresaId: "frutera-varfa"`, `fincaId: null`, `activo: true`. Hasta que exista ese Administrador nadie puede usar la pantalla de la Fase 5 para crear a los demás.

**Salida:** autenticación habilitada, `usuarios` creada y un Administrador real que puede loguearse. Los demás Cargos todavía no tienen cuenta.

---

## Fase 4 — Reescribir el login de la app

1. `authService.js`: reemplazar `validateCredentials`/`authenticateUser` (array local) por `signInWithEmailAndPassword` de Firebase Auth, y después leer `rol`/`empresaId`/`fincaId` con un `getDoc` de `usuarios/{uid}`. Mantener la firma de salida que ya espera `AppTomaFisica.js` (`{success, user, redirectPath}` / `{success:false, error}`). Si la cuenta de Auth existe pero no tiene documento en `usuarios`, o lo tiene con `activo: false`, es un login fallido con mensaje propio ("Usuario inactivo"), no el genérico.
2. `LoginScreen.js`: cambiar el selector de "Usuario" (Cargo) por un formulario de correo + contraseña — cambio de UX visible, avisar antes de desplegar. El botón ya está `disabled` sin conexión; eso se queda.
3. `AppTomaFisica.js`: agregar `onAuthStateChanged` de Firebase Auth como fuente de verdad; `localStorage` queda solo como caché para la carga inicial offline.
4. `ProtectedRoute.js`: verificar que haya sesión y que el rol permita la ruta. Hoy lee `localStorage` de forma **síncrona**.

   > ⚠️ **Aquí se reintroduce un bug ya resuelto si no se diseña con cuidado.** `onAuthStateChanged` es asíncrono y en el primer render devuelve `null`: sin un estado explícito de "cargando", `ProtectedRoute` va a mandar a `/login` a un usuario que sí tiene sesión. Es exactamente el bug *"`currentUser` llegaba `null` a `ProtectedRoute`"* de la tabla de bugs resueltos del historial. Tres estados, no dos: `cargando` / `autenticado` / `sin sesión`.

5. **Probar el modo offline en el celular antes de desplegar.** Firebase Auth guarda la sesión en el dispositivo y en principio sigue funcionando sin red después del primer login, pero eso es un supuesto: hay que verificarlo en campo, no descubrirlo ahí.

**Salida:** login real contra Firebase Auth. El Administrador bootstrapeado en la Fase 3 ya puede entrar con correo/contraseña.

---

## Fase 5 — Pantalla de Administración de Usuarios y Empresas (Sprint S6)

`permissions.js` ya tiene `PERMISOS_ADMIN_USUARIOS` con `puedeCrearUsuarios`, `puedeEliminarUsuarios`, `puedeCambiarRoles` — hoy los tres en `false`. Esta fase es la que finalmente los usa.

1. **Permisos:** en `permissions.js`, poner los tres en `true` solo para `ROLES.ADMINISTRADOR`.
2. **Ruta nueva**, protegida por `ProtectedRoute` con `allowedRoles={[ROLES.ADMINISTRADOR]}` — ej. `/admin/usuarios`. Agregar el link de acceso en `RoleHomePage.js` o en el header de Administrador.
3. **Listado de usuarios:** lee `usuarios` filtrado por `empresaId` del Administrador logueado. Muestra Cargo, correo, Rol, estado activo/inactivo.
4. **Formulario "Nuevo usuario":** Nombre visible, correo, contraseña temporal, Rol (dropdown con los valores de `roles.js` — nunca texto libre, para no repetir el bug histórico de `permissions.js` con roles mal escritos), Finca (dropdown leído de la colección `fincas`, con opción "Todas" para los roles de alcance empresa), Empresa fija a la del Administrador.

   **Cómo se crea la cuenta sin Admin SDK — instancia secundaria.** `createUserWithEmailAndPassword` firma automáticamente al usuario recién creado, lo que sacaría de sesión al Administrador. Se rodea inicializando una segunda app de Firebase con la misma configuración y otro nombre; esa instancia tiene su propio estado de autenticación, así que la sesión del Administrador no se toca:

   ```js
   const secundaria = getApps().find(a => a.name === 'altaUsuarios')
     ?? initializeApp(getApp().options, 'altaUsuarios');
   const authSecundaria = getAuth(secundaria);
   const cred = await createUserWithEmailAndPassword(authSecundaria, correo, claveTemporal);
   await setDoc(doc(db, 'usuarios', cred.user.uid), { nombre, rol, empresaId, fincaId, activo: true, creadoEn: serverTimestamp() });
   await signOut(authSecundaria);
   ```

   > ⚠️ Las dos escrituras no son atómicas. Si la cuenta de Auth se crea y el `setDoc` falla, queda una cuenta huérfana que puede loguearse y no ve nada. No es una fuga —las reglas le niegan todo sin documento espejo— pero hay que manejar el error en pantalla y dejar en la Fase 5 una vista de "cuentas sin documento" para limpiarlas.

5. **Editar / desactivar usuario:** cambiar Rol, Finca o marcar `activo: false`, con un `updateDoc` directo sobre `usuarios/{uid}` — lo autoriza la regla, no código de servidor. Un usuario desactivado debe fallar el login con un mensaje claro ("Usuario inactivo"), no con el genérico "Usuario o clave incorrecta". El efecto es inmediato: las reglas leen el documento vivo.
6. **Restablecer contraseña:** `sendPasswordResetEmail` desde el cliente. Funciona en Spark y evita que el Administrador tenga que conocer claves ajenas.
7. **Gestión de `empresas` y `fincas`:** se quedan en la consola. Las reglas las dejan en solo lectura desde la app (ver Fase 6). Dar de alta una cuarta finca es crear un documento, y es una operación de una vez al año.

**Salida:** el Administrador crea desde la app las cuentas de los otros 6 Cargos — ya no hace falta tocar la consola de Firebase para altas normales.

---

## Fase 6 — Firestore Rules (el paso que no se puede revertir fácil)

Desplegar recién cuando las Fases 1-5 estén probadas.

Reescritas el 2026-11-14 para la ruta sin custom claims: la empresa sale de `usuarios/{uid}`, no del token.

```js
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // get() dentro de reglas NO vuelve a pasar por las reglas: no hay recursión.
    function perfil() {
      return get(/databases/$(database)/documents/usuarios/$(request.auth.uid)).data;
    }
    function activo() {
      return request.auth != null && perfil().activo == true;
    }
    function miEmpresa()  { return perfil().empresaId; }
    function esAdmin()    { return activo() && perfil().rol == 'Administrador'; }

    match /estimaciones/{id} {
      allow read:   if activo() && resource.data.empresaId == miEmpresa();
      allow create: if activo()
                    && request.resource.data.empresaId == miEmpresa()
                    && request.resource.data.keys().hasAll(
                         ['empresaId','fincaId','Cosecha','Tipo','Lote','Parcela']);
      allow update: if activo()
                    && resource.data.empresaId == miEmpresa()
                    && request.resource.data.empresaId == resource.data.empresaId;
      allow delete: if false;
    }

    match /usuarios/{uid} {
      // cada quien lee el suyo: lo necesita el login de la Fase 4
      allow read:   if request.auth != null && (request.auth.uid == uid || esAdmin());
      allow create: if esAdmin() && request.resource.data.empresaId == miEmpresa();
      allow update: if esAdmin()
                    && resource.data.empresaId == miEmpresa()
                    && request.resource.data.empresaId == resource.data.empresaId;
      allow delete: if false;
    }

    match /empresas/{empresaId} {
      allow read:  if activo() && empresaId == miEmpresa();
      allow write: if false;            // solo consola
    }

    match /fincas/{fincaId} {
      allow read:  if activo() && resource.data.empresaId == miEmpresa();
      allow write: if false;            // solo consola
    }

    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

Tres cosas que hacen el trabajo pesado aquí:

- **`empresaId` no se puede cambiar en un `update`.** Ni en `estimaciones` ni en `usuarios`. Sin esa línea, un Administrador podría mover un registro o una persona a otra empresa, y el aislamiento deja de ser aislamiento.
- **La finca no entra en las reglas, a propósito.** Agrupa, no aísla: meterla aquí impediría el consolidado que la planta de empaque necesita. Quien lo hace cumplir es la UI (Fase 8) y, para aprobar, `handleAprobar` (Regla 31 revisada).
- **Una cuenta de Auth sin documento en `usuarios` no pasa de la puerta.** `perfil()` sobre un documento inexistente hace fallar la condición y todo queda denegado. Es la mitigación de tener que dejar el registro abierto (ver la decisión de Spark).

> ⚠️ Los nombres de campo van en **mayúscula**, igual que hoy — ver tarea 0.1. Solo pasarlos a minúscula si antes se hizo el backfill que unifica la doble grafía.

**Antes de desplegar:** confirmar que la Fase 2 (backfill) está 100% completa — ya lo está desde el 2026-11-14 — y leer `firestore.rules` de vuelta desde el disco para confirmar su contenido.

**Qué resuelve:** cierra la exposición permanente de `estimaciones` a lectura y escritura sin autenticación. Ya no hay deadline externo — esta fase se hace cuando se decida, y mientras no se haga, la base queda abierta.

---

## Fase 7 — Inyectar `empresaId` al guardar

1. ⚠️ **`EstimationHeaderPage.js` es el archivo clave**, no `estimationService.js`: ahí está el `addDoc` que crea las estimaciones (`guardarFirebase()`). Hay que inyectar `empresaId` en ese payload, en el chequeo de duplicados y en el registro que se guarda localmente en modo offline. Si se sigue solo lo que decía este plan antes, los documentos nuevos saldrían sin `empresaId` y las reglas de la Fase 6 los rechazarían.
2. `estimationService.js`: inyectar `empresaId` en sus `updateDoc` y agregar `where('empresaId','==', empresaId)` en `checkFirebaseDuplicate`.
3. `operationalDraftStorage.js`: `crearUniqueKey()` debe llevar `empresaId` como primer segmento (`EMPRESA-COSECHA-TIPO-GF-LOTE-PARCELA-AÑO`).

> ⚠️ En la base ya conviven **dos formatos de `uniqueKey`**: documentos viejos con 4 segmentos (`"C1-11-40-2026"`) y el formato actual de 6. Al agregar `empresaId` serían tres. Contemplarlo en la validación de duplicados, y definir qué hacer con los borradores locales pendientes de sincronizar al momento del despliegue.

**Salida:** todo documento nuevo lleva `empresaId` correcto.

---

## Fase 8 — Filtrar las consultas existentes

| Archivo | Patrón actual | Cambio |
|---|---|---|
| `PantallaConsultaEstFruta.js` | `getDocs(collection(db,'estimaciones'))` sin `where` | Agregar `where('empresaId','==',user.empresaId)` — **el más crítico, es la fuga de datos confirmada** |
| `PantallaDatosGuardadosCelular.js` | igual que arriba | igual, más verificar `useOffline` |
| `PantallaEstimacionPorGF.js` | igual que arriba | igual |
| `PantallaAnalisisGF_Lote.js` | igual que arriba | igual |
| `PantallaEstimacionPorSeccion.jsx` | `getDoc` por `id` directo | Verificar `data.empresaId === user.empresaId` post-fetch; si no coincide, "no encontrado" |
| `PantallaAnalisisParcelaDetalle.jsx` | `getDoc` por `id` directo | mismo patrón |

> ⚠️ Estas mismas queries ya filtran los registros **anulados** (`anulado !== true`, borrado lógico agregado el 2026-11-07). Al agregar el filtro por empresa, conservar el de anulados: son dos condiciones, no una.

**Salida:** ningún dispositivo recibe documentos de una empresa que no es la suya.

---

## Fase 9 — Offline

`useOffline.js`: namespacing por `empresaId` en la clave de almacenamiento local, y limpiar la caché al cambiar de sesión/empresa.

---

## Fase 10 — Pruebas

**Automatizadas** (patrón de `estfrutaAnalysisService.test.js`):
- `crearUniqueKey()` con `empresaId` y `fincaId` — mismos lote/parcela/cosecha en dos empresas, o en dos fincas de la misma empresa, no deben chocar.
- **Reglas, con el emulador de Firestore** (`@firebase/rules-unit-testing`). Es el reemplazo de las pruebas de Cloud Functions y ahora es el control principal:
  - usuario de empresa A no lee documentos de empresa B;
  - usuario con `activo: false` no lee ni escribe nada;
  - cuenta de Auth **sin** documento en `usuarios` no lee ni escribe nada;
  - usuario no Administrador no puede crear ni modificar documentos de `usuarios`, **ni el suyo propio** (autoescalamiento);
  - un Administrador no puede cambiar el `empresaId` de un documento existente, ni de una estimación ni de un usuario;
  - nadie escribe en `empresas` ni en `fincas`.

**Manuales — Multiempresa (requiere 2 empresas de prueba):**
- [ ] Login empresa A ve solo datos de empresa A en `PantallaConsultaEstFruta`
- [ ] Respuesta de red (devtools) al cargar `PantallaEstimacionPorGF` ya viene filtrada server-side, no solo oculta en la UI
- [ ] Crear una estimación en empresa A no aparece en empresa B
- [ ] URL de detalle de una parcela de empresa B estando logueado en empresa A → "no encontrado"
- [ ] Mismo Lote/Parcela/Cosecha en empresa A y empresa B → ambas lo guardan sin chocar
- [ ] Usuario sin `empresaId` válido → redirigido a login, no pantalla en blanco

**Manuales — Administración de usuarios (Fase 5):**
- [ ] Un usuario NO Administrador no ve la ruta `/admin/usuarios` ni puede escribir en `usuarios` (probar el `updateDoc` a mano desde la consola del navegador con su sesión, no solo confiar en que la UI lo oculta)
- [ ] Administrador crea un usuario nuevo → **el Administrador sigue logueado** (es lo que verifica la instancia secundaria) y esa persona puede entrar de inmediato
- [ ] Administrador desactiva un usuario → ese usuario deja de poder leer **sin esperar a que caduque nada**, y su login falla con "Usuario inactivo"
- [ ] Administrador de empresa A no puede crear ni ver usuarios de empresa B
- [ ] Alguien se registra por fuera con `createUserWithEmailAndPassword` → entra pero no ve absolutamente nada

**Manual — regresión del incidente de noviembre:**
- [ ] Tras cualquier despliegue de reglas, hacer una lectura real contra la API y confirmar que responde — no asumir que el deploy funcionó

---

## Fase 11 — Rollout

1. Fases 0-2 (arreglos previos + modelo de datos + backfill) — cero impacto visible.
2. Fase 3 (habilitar Auth + `firebaseConfig.js` + colección `usuarios` + bootstrap del primer Administrador a mano) — todavía nada visible para el resto de usuarios.
3. Fase 4 (login nuevo) — el Administrador ya puede entrar con correo/contraseña. Los demás Cargos siguen sin cuenta, así que **coordinar el corte**: considerar una ventana corta donde el Administrador crea todas las cuentas antes de anunciar el cambio al equipo.
4. Fase 5 (pantalla de administración) — Administrador crea las 6 cuentas restantes.
5. Validar que todos los Cargos pueden loguearse antes de seguir.
6. Fase 6 (reglas nuevas) — el punto de no retorno. Ventana de baja actividad de campo, con alguien monitoreando.
7. Fases 7-9 en el mismo release que la Fase 6 (las reglas nuevas van a rechazar escrituras sin `empresaId`).
8. Fase 10 corrida completa antes de dar por cerrado.

---

## Riesgos a tener presentes

- **Cambio de UX en el login** (selector de Cargo → correo/contraseña) requiere avisar a los usuarios de campo antes del despliegue.
- **Ventana de corte de acceso:** entre que se despliega el login nuevo (Fase 4) y el Administrador termina de crear las 6 cuentas restantes (Fase 5), esos Cargos no pueden entrar.
- **Seguridad de las reglas de `usuarios`:** es donde quedó el riesgo de escalamiento de privilegios al quitar las Cloud Functions. Son pocas líneas, pero si `allow update` no bloquea que un usuario edite su propio documento, cualquiera se asciende a Administrador. Se prueba con el emulador (Fase 10), no a ojo.
- **El registro público queda abierto:** "Enable create (sign-up)" tiene que seguir encendido para que la pantalla de la Fase 5 funcione. Una cuenta registrada por fuera no ve nada, pero conviene revisar la lista de Users cada tanto y evaluar App Check.
- **Alta de usuario en dos pasos no atómicos:** cuenta de Auth y documento espejo se crean por separado. Un fallo en medio deja una cuenta huérfana e inútil que hay que poder detectar y limpiar.
- **Ventana de riesgo en la Fase 6:** si el backfill (Fase 2) no fue 100% completo, cualquier documento huérfano queda inaccesible al desplegar las reglas nuevas. Tener lista una reversión rápida.
- **Un despliegue de reglas puede romper la app en silencio.** Es exactamente lo que pasó entre setiembre y noviembre de 2026: nadie se dio cuenta durante 68 días. Después de cada despliegue, verificar con una lectura real, y considerar un chequeo periódico que avise si Firestore deja de responder.
- **Borradores offline en tránsito:** dispositivos con registros sin sincronizar al momento del despliegue de las Fases 7-8 pueden tener `uniqueKey` en formato viejo.

---

## Resumen de estado

| Fase | Descripción | Estado / dependencia |
|---|---|---|
| 0.1 | Verificar mismatch de mayúsculas | ✅ Cerrada — no existía |
| 0.2 | `throw` de depuración en `requestCreateEstimation` | ✅ Cerrada — código muerto, no bloquea nada |
| 1 | Colecciones `empresas` y `fincas` | ✅ **Cerrada el 2026-11-14** — 1 empresa + 3 fincas creadas en la consola de Firebase |
| 2 | Backfill `empresaId` + `fincaId` en datos existentes | ✅ **Cerrada el 2026-11-14** — 26/26 documentos |
| 3 | Firebase Auth + colección `usuarios` + bootstrap Administrador | **Siguiente** — prerequisito de Fases 4-6 |
| 4 | Login nuevo en la app | Pendiente — prerequisito de Fase 6 |
| 5 | Pantalla de administración de usuarios (Sprint S6) | Pendiente — necesaria para dar de alta a los otros 6 Cargos |
| 6 | `firestore.rules` nuevas | Pendiente — **cierra la exposición permanente** de `estimaciones` |
| 7 | Inyectar `empresaId` al guardar | Pendiente — el `addDoc` está en `EstimationHeaderPage.js` |
| 8 | Filtrar las consultas de las 6 pantallas | Pendiente — cierra la fuga de datos |
| 9 | Offline por empresa | Pendiente — puede ir después |
| 10 | Pruebas | Antes de cerrar el rollout |
| 11 | Orden de despliegue | — |

> 📌 **El requisito de fincas (2026-11-08) atraviesa las Fases 1, 2, 3, 4, 5, 7, 8 y 10.** No es una fase aparte y no conviene hacerlo en una segunda tanda: son los mismos archivos, las mismas queries y la misma clave de duplicados. Ver [Requisito nuevo — fincas](#fincas).

Las Fases 0, 1 y 2 están cerradas (las dos últimas el 2026-11-14: `empresas` y `fincas` existen, y los 26 documentos de `estimaciones` ya llevan `empresaId` y `fincaId`). Hasta aquí el impacto en la app es cero. El siguiente paso es la **Fase 3** — habilitar Firebase Auth, arreglar `firebaseConfig.js`, crear `usuarios` y el Administrador inicial — que es donde empieza el trabajo de verdad y el prerequisito de todo lo que falta. La fecha a la que apunta todo esto es [mediados de enero de 2027](#fecha-objetivo) — una meta de calendario, no una bomba de tiempo como la de agosto. Lo que hace que la Fase 6 sea obligatoria y no opcional sigue siendo la exposición permanente descrita arriba.

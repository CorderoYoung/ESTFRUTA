# Plan de Implementación — Multiempresa, Opción B (Firebase Auth + Custom Claims)

> Complementa la sección "Plan Multiempresa — Decisión de Seguridad" del CODEX. Ese documento explica **qué** hay que cambiar y **por qué** se eligió la Opción B; este documento define **en qué orden** ejecutarlo sin romper la app en producción, y qué probar en cada paso.
>
> Creado: 2026-07-28 · Actualizado: 2026-11-07.

---

## ⚠️ Cambios importantes desde la versión anterior de este plan (2026-11-07)

Tres cosas cambiaron y afectan directamente cómo se lee el resto del documento.

**1. El deadline del 31 de agosto ya pasó, y ya está resuelto.**
Las reglas de Firestore vencieron el 31-ago-2026 y **la app estuvo caída 68 días** — Firestore rechazó toda lectura y escritura desde el 1 de setiembre hasta que se detectó el 7 de noviembre. Se quitó la fecha de expiración y se republicaron las reglas ese día. Ya no hay ninguna fecha forzando la Fase 6.

**2. Lo que ahora justifica la Fase 6 es otra cosa, y es peor.**
Antes, la fecha de expiración actuaba como un cierre forzado de la exposición: brutal, pero cierre. Al quitarla, `estimaciones` quedó **abierta a lectura y escritura sin autenticación, de forma indefinida**, para cualquiera que tenga el `projectId` (que es público por diseño). La validación de forma que quedó en las reglas no es seguridad: cualquiera puede incluir esos cuatro campos. **Esa exposición permanente es ahora la razón para hacer la Fase 6**, y no tiene fecha límite que la empuje — hay que decidirla.

**3. La tarea 0.1 está cerrada: no había ningún mismatch.**
Ver Fase 0 abajo.

---

## Antes de empezar: respuestas de Freddy

1. **¿Cuántas empresas hay hoy y cómo se llaman?** ✅ **Respondido: cero.** Hoy no existe ninguna empresa creada en el sistema — la app funciona como si todo fuera una sola empresa implícita. La primera empresa a crear en la Fase 1 será un **placeholder**: nombre `Contoso S.A.`, `empresaId: 'contoso'` — Freddy indicó explícitamente que **se renombrará más adelante** cuando se defina el nombre real. No bloquea el resto del plan: renombrar una empresa después es solo actualizar `empresas/{empresaId}.nombre` (o, si cambia también el `empresaId`, un backfill puntual como el de la Fase 2 pero solo para ese campo).
2. **¿Los 7 usuarios son personas reales o roles compartidos?** ✅ **Respondido:** son **nombres de Puesto/Cargo** dentro de la empresa (Administrador, Muestreador, Supervisor Cosecha, etc.), no personas individuales. Cada Cargo tendrá su propio correo y contraseña reales al migrar a Firebase Auth (ya no clave `123` compartida).
3. **¿Pantalla de administración de usuarios ahora o después?** ✅ **Respondido: ahora.** Se agregó como **Fase 5** de este plan (implementa el Sprint S6, que en el CODEX estaba como "Futuro").

**Las 3 preguntas están respondidas — el plan no tiene bloqueos abiertos para arrancar la Fase 0.**

---

## Nota sobre dónde vive el código (2026-11-07)

Este plan asumía dos copias locales del proyecto que había que mantener sincronizadas a mano. **Ya no.** La copia de OneDrive se descartó: `C:\proyectos\estfruta` (con git) es la única copia local, y tanto el CODEX como este plan viven dentro de esa carpeta. Ver "Copia única del proyecto" en el CODEX.

Esto simplifica cada fase: ya no hay que replicar nada. Pero agrega una verificación: **después de escribir `firestore.rules` y antes de hacer `firebase deploy`, leer el archivo de vuelta desde el disco y confirmar que contiene lo que creés.** El 7 de noviembre una escritura reportó éxito y no se aplicó; el archivo que quedó en disco era una variante rota, y un deploy en ese momento habría publicado reglas malas encima de las buenas.

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

1. Crear la colección `empresas` en Firestore, con la primera empresa (placeholder, a renombrar después):
   ```
   empresas/
     contoso/
       nombre: "Contoso S.A."   // placeholder — se renombra más adelante
       activa: true
   ```
   `empresaId` = `contoso` (slug corto y estable, no un ID autogenerado). Renombrar después es editar `nombre`; si además cambia el `empresaId`, requiere un backfill puntual (mismo patrón que la Fase 2, pero acotado a `estimaciones.empresaId` y `usuarios/{uid}.empresaId`/custom claims).

**Salida:** colección `empresas` con al menos un documento. Cero impacto en la app todavía.

---

## Fase 2 — Backfill de datos existentes

Todos los documentos de `estimaciones` hoy NO tienen `empresaId`. Antes de exigirlo en las reglas, hay que agregarlo a lo que ya existe.

1. Script único (Node + Admin SDK, o manual si son pocos documentos) que recorra `estimaciones` y agregue `empresaId: '<la empresa actual>'` a cada documento que no lo tenga.
2. Verificar con una query: contar documentos totales vs. documentos con `empresaId` — deben coincidir al terminar.
3. Aditivo únicamente — no tocar ningún otro campo.

> Oportunidad: este es el momento natural para decidir si se aprovecha el mismo script para limpiar la **doble grafía de campos** (quedarse con un solo juego, mayúscula o minúscula). No está decidido. Si se hace, las reglas de la Fase 6 deben ajustarse en el mismo despliegue.

**Salida:** el 100% de los documentos existentes tiene `empresaId`.

---

## Fase 3 — Firebase Authentication + Custom Claims (infraestructura)

1. Habilitar el proveedor **Email/Password** en Firebase Authentication (hoy no está inicializado en absoluto).
2. Crear la colección `usuarios` en Firestore, espejo de las cuentas de Auth — necesaria porque el cliente no puede listar cuentas de Firebase Auth directamente, solo vía Admin SDK:
   ```
   usuarios/
     <uid>/                 // uid = el mismo ID de la cuenta de Firebase Auth
       nombre:    "Supervisor Cosecha"   // el Cargo/Puesto, lo que hoy es "Usuario"
       rol:       "Supervisor Cosecha"   // debe coincidir con ROLES de roles.js
       empresaId: "contoso"
       activo:    true
       creadoEn:  <timestamp>
   ```
3. Cloud Function callable **`crearUsuario`** (Admin SDK): recibe `{ nombre, correo, claveTemporal, rol, empresaId }`, valida que quien la invoca ya tiene el custom claim de Administrador de esa misma empresa, crea la cuenta en Firebase Auth, le asigna los custom claims `{ empresaId, rol }`, y crea el doc espejo en `usuarios/{uid}`.
4. Cloud Function callable **`actualizarUsuario`**: cambia `rol`/`empresaId`/`activo` — actualiza tanto los custom claims como el doc espejo. `activo: false` es la forma de "eliminar" un usuario (igual que `allow delete: if false` en `estimaciones` — nunca hard-delete, para no perder trazabilidad de quién capturó qué).
5. **Bootstrap manual (una sola vez, fuera de la app):** crear a mano la primera cuenta de Administrador — consola de Firebase o script directo con Admin SDK — porque hasta que exista un Administrador que pueda loguearse, nadie puede usar la pantalla de la Fase 5 para crear a los demás.

   > ⚠️ Ojo con la seguridad de estas dos Cloud Functions: si la validación de "quien invoca ya es Administrador" tiene un bug, cualquier usuario logueado podría crearse a sí mismo como Administrador de otra empresa. Este es el punto de mayor riesgo de todo el plan — probarlo explícitamente (ver checklist de Fase 10).

**Salida:** infraestructura de autenticación lista + un Administrador real que puede loguearse. Los otros 6 Cargos todavía no tienen cuenta.

---

## Fase 4 — Reescribir el login de la app

1. `authService.js`: reemplazar `validateCredentials`/`authenticateUser` (array local) por `signInWithEmailAndPassword` de Firebase Auth, leyendo `rol`/`empresaId` desde los custom claims del token (no desde `usuarios/{uid}`, para no depender de una lectura extra a Firestore en cada login). Mantener la firma de salida que ya espera `AppTomaFisica.js` (`{success, user, redirectPath}` / `{success:false, error}`).
2. `LoginScreen.js`: cambiar el selector de "Usuario" (Cargo) por un formulario de correo + contraseña — cambio de UX visible, avisar antes de desplegar.
3. `AppTomaFisica.js`: agregar `onAuthStateChanged` de Firebase Auth como fuente de verdad; `localStorage` queda solo como caché para la carga inicial offline.
4. `ProtectedRoute.js`: verificar el claim `empresaId` del token — si no existe o la empresa está inactiva, redirigir a `/login`.

**Salida:** login real contra Firebase Auth. El Administrador bootstrapeado en la Fase 3 ya puede entrar con correo/contraseña.

---

## Fase 5 — Pantalla de Administración de Usuarios y Empresas (Sprint S6)

`permissions.js` ya tiene `PERMISOS_ADMIN_USUARIOS` con `puedeCrearUsuarios`, `puedeEliminarUsuarios`, `puedeCambiarRoles` — hoy los tres en `false`. Esta fase es la que finalmente los usa.

1. **Permisos:** en `permissions.js`, poner los tres en `true` solo para `ROLES.ADMINISTRADOR`.
2. **Ruta nueva**, protegida por `ProtectedRoute` con `allowedRoles={[ROLES.ADMINISTRADOR]}` — ej. `/admin/usuarios`. Agregar el link de acceso en `RoleHomePage.js` o en el header de Administrador.
3. **Listado de usuarios:** lee `usuarios` filtrado por `empresaId` del Administrador logueado. Muestra Cargo, correo, Rol, estado activo/inactivo.
4. **Formulario "Nuevo usuario":** Cargo/Nombre visible, correo, contraseña temporal, Rol (dropdown con los valores de `roles.js` — nunca texto libre, para no repetir el bug histórico de `permissions.js` con roles mal escritos), Empresa (fija a la del Administrador). Llama a la Cloud Function `crearUsuario` de la Fase 3.
5. **Editar / desactivar usuario:** cambiar Rol o marcar `activo: false`. Llama a `actualizarUsuario`. Un usuario desactivado debe fallar el login con un mensaje claro ("Usuario inactivo"), no con el genérico "Usuario o clave incorrecta".
6. **Gestión de `empresas`** (crear nueva empresa, activar/desactivar): puede vivir en la misma pantalla como una segunda sección, o quedar solo por consola/script mientras haya una sola empresa.

**Salida:** el Administrador crea desde la app las cuentas de los otros 6 Cargos — ya no hace falta tocar la consola de Firebase para altas normales.

---

## Fase 6 — Firestore Rules (el paso que no se puede revertir fácil)

Desplegar recién cuando las Fases 1-5 estén probadas.

```js
allow read: if request.auth != null
  && request.auth.token.empresaId == resource.data.empresaId;

allow create: if request.auth != null
  && request.auth.token.empresaId == request.resource.data.empresaId
  && request.resource.data.keys().hasAll(['empresaId','Cosecha','Tipo','Lote','Parcela']);

allow update: if request.auth != null
  && request.auth.token.empresaId == resource.data.empresaId;

allow delete: if false;
```

> ⚠️ Los nombres de campo van en **mayúscula**, igual que hoy — ver tarea 0.1. Solo pasarlos a minúscula si antes se hizo el backfill que unifica la doble grafía.

**Antes de desplegar:** confirmar que la Fase 2 (backfill) está 100% completa, y leer `firestore.rules` de vuelta desde el disco para confirmar su contenido.

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
- `crearUniqueKey()` con `empresaId` — mismos lote/parcela/cosecha en dos empresas no deben chocar.
- Si hay emulador de Cloud Functions disponible: probar `crearUsuario`/`actualizarUsuario` con un token que NO es de Administrador → debe rechazar.

**Manuales — Multiempresa (requiere 2 empresas de prueba):**
- [ ] Login empresa A ve solo datos de empresa A en `PantallaConsultaEstFruta`
- [ ] Respuesta de red (devtools) al cargar `PantallaEstimacionPorGF` ya viene filtrada server-side, no solo oculta en la UI
- [ ] Crear una estimación en empresa A no aparece en empresa B
- [ ] URL de detalle de una parcela de empresa B estando logueado en empresa A → "no encontrado"
- [ ] Mismo Lote/Parcela/Cosecha en empresa A y empresa B → ambas lo guardan sin chocar
- [ ] Usuario sin `empresaId` válido → redirigido a login, no pantalla en blanco

**Manuales — Administración de usuarios (Fase 5):**
- [ ] Un usuario NO Administrador no ve la ruta `/admin/usuarios` ni puede invocar `crearUsuario` directamente (probar llamando la Cloud Function a mano con su token, no solo confiar en que la UI la oculta)
- [ ] Administrador crea un Cargo nuevo → esa persona puede loguearse de inmediato
- [ ] Administrador desactiva un usuario → login de ese usuario falla con "Usuario inactivo"
- [ ] Administrador de empresa A no puede crear ni ver usuarios de empresa B

**Manual — regresión del incidente de noviembre:**
- [ ] Tras cualquier despliegue de reglas, hacer una lectura real contra la API y confirmar que responde — no asumir que el deploy funcionó

---

## Fase 11 — Rollout

1. Fases 0-2 (arreglos previos + modelo de datos + backfill) — cero impacto visible.
2. Fase 3 (infraestructura Auth + Cloud Functions + bootstrap del primer Administrador) — todavía nada visible para el resto de usuarios.
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
- **Seguridad de las Cloud Functions de administración:** son las que más riesgo de escalamiento de privilegios introducen. La validación de "quien invoca ya es Administrador de esa empresa" tiene que probarse explícitamente.
- **Costo de Cloud Functions:** fuera de la capa gratuita se cobra por invocación — para un puñado de usuarios no debería ser relevante.
- **Ventana de riesgo en la Fase 6:** si el backfill (Fase 2) no fue 100% completo, cualquier documento huérfano queda inaccesible al desplegar las reglas nuevas. Tener lista una reversión rápida.
- **Un despliegue de reglas puede romper la app en silencio.** Es exactamente lo que pasó entre setiembre y noviembre de 2026: nadie se dio cuenta durante 68 días. Después de cada despliegue, verificar con una lectura real, y considerar un chequeo periódico que avise si Firestore deja de responder.
- **Borradores offline en tránsito:** dispositivos con registros sin sincronizar al momento del despliegue de las Fases 7-8 pueden tener `uniqueKey` en formato viejo.

---

## Resumen de estado

| Fase | Descripción | Estado / dependencia |
|---|---|---|
| 0.1 | Verificar mismatch de mayúsculas | ✅ Cerrada — no existía |
| 0.2 | `throw` de depuración en `requestCreateEstimation` | ✅ Cerrada — código muerto, no bloquea nada |
| 1 | Colección `empresas` | Pendiente |
| 2 | Backfill `empresaId` en datos existentes | Pendiente — prerequisito de Fase 6 |
| 3 | Firebase Auth + Custom Claims + Cloud Functions + bootstrap Administrador | Pendiente — prerequisito de Fases 4-6 |
| 4 | Login nuevo en la app | Pendiente — prerequisito de Fase 6 |
| 5 | Pantalla de administración de usuarios (Sprint S6) | Pendiente — necesaria para dar de alta a los otros 6 Cargos |
| 6 | `firestore.rules` nuevas | Pendiente — **cierra la exposición permanente** de `estimaciones` |
| 7 | Inyectar `empresaId` al guardar | Pendiente — el `addDoc` está en `EstimationHeaderPage.js` |
| 8 | Filtrar las consultas de las 6 pantallas | Pendiente — cierra la fuga de datos |
| 9 | Offline por empresa | Pendiente — puede ir después |
| 10 | Pruebas | Antes de cerrar el rollout |
| 11 | Orden de despliegue | — |

Nada de este plan se ha ejecutado todavía. La Fase 0 está cerrada, así que el arranque natural es la **Fase 1** (colección `empresas`), seguida del backfill. Lo que justifica llegar hasta la Fase 6 es la exposición permanente descrita arriba, no una fecha límite.

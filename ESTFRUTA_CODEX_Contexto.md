# ESTFRUTA CODEX — Archivo Técnico del Proyecto

> 📄 **El historial fechado vive aparte**, en `ESTFRUTA_HISTORIAL.md`: auditorías, incidentes y bugs ya resueltos, con su diagnóstico completo. Este documento es la referencia operativa — lo que hay que saber antes de tocar código. Si algo de aquí te sorprende, la explicación de por qué es así suele estar en el historial.

---

## Contexto General
App React para gestión de estimaciones de cosecha de piña.  
Funciona **online y offline** (muestreadores de campo). Usa Firebase como backend.

---

## Punto de entrada real
```
src/index.js → importa AppTomaFisica (NO App.js)
```
> ⚠️ `App.js` y `AppConsultaEdicion.js` existen pero **no se usan**. Siempre editar `AppTomaFisica.js`.

---

## Estructura de carpetas relevante
```
src/
├── AppTomaFisica.js                         ← App principal (punto de entrada real)
├── index.js                                 ← Importa AppTomaFisica
├── constants/
│   ├── roles.js                             ← ROLES, ROLE_OPTIONS, ROLE_ROUTES ← fuente de verdad de roles
│   ├── permissions.js                       ← PERMISOS_ROL, helpers de acceso ✅
│   └── sampling.js                          ← FRUIT_SIZE_CODES, DEFECT_CODES ← tocar aquí para agregar defectos
├── hooks/
│   ├── useDebounceEffect.js
│   ├── useEstimacionDetalle.js
│   └── useOffline.js
├── pages/
│   ├── EstimationHeaderPage.js
│   ├── EstimationSamplingEditPage.js
│   ├── EstimationSamplingPageTF.js
│   ├── PantallaAnalisisGF_Lote.js           ← Análisis por GF y Lote ✅ — nav GF fijado ✅
│   ├── PantallaAnalisisGF_Lote.css          ← estilos .agl-gf-fijado agregados ✅
│   ├── PantallaAnalisisParcelaDetalle.jsx   ← Detalle por parcela ✅ Sprint 3
│   ├── PantallaAnalisisParcelaDetalle.css
│   ├── PantallaConsultaEstFruta.js          ← permisos aplicados ✅
│   ├── PantallaDatosGuardadosCelular.js
│   ├── PantallaEstimacionPorGF.js           ← gráfico motivos + nav GF fijado ✅ Sprint 7
│   ├── PantallaEstimacionPorGF.css          ← rediseño completo coherente PAPD ✅
│   ├── PantallaEstimacionPorSeccion.jsx     ← Sprint 2 ✅
│   ├── PantallaEstimacionPorSeccion.css
│   ├── RoleHomePage.js
│   └── UnauthorizedPage.js
├── routes/
│   └── ProtectedRoute.js
├── services/
│   ├── authService.js                       ← USERS, validateCredentials, getActiveUsers, authenticateUser
│   ├── estfrutaAnalysisService.js           ← Motor matemático ✅ NO TOCAR
│   ├── estimationService.js
│   └── operationalDraftStorage.js
└── firebaseConfig.js
```

---

## Autenticación

- **Archivo:** `AppTomaFisica.js`
- **Storage:** `localStorage` (cambiado de `sessionStorage`)
- **Key:** `estfruta_session_user`
- **Patrón:** inicializador síncrono obligatorio:

```js
const SESSION_KEY = 'estfruta_session_user'; // fuera del componente

const [currentUser, setCurrentUser] = useState(() => {
  try {
    const stored = window.localStorage.getItem(SESSION_KEY);
    if (!stored) return null;
    const parsed = JSON.parse(stored);
    return parsed?.Usuario && parsed?.Rol ? parsed : null;
  } catch {
    return null;
  }
});
```

- **Funciones exportadas por `authService.js`:**

```js
// Poblar selector de login (AppTomaFisica.js: setUsers(await getActiveUsers()))
export async function getActiveUsers() → Promise<USERS[]>

// Autenticar (AppTomaFisica.js: const result = await authenticateUser(credentials))
// credentials = { usuario, clave }  ← objeto, no dos argumentos
export async function authenticateUser(credentials)
  → { success: true,  user, redirectPath }   // éxito
  → { success: false, error }                // fallo — AppTomaFisica.js lee result.error (no result.message)

// Helper interno (sigue disponible para uso directo si se necesita)
export function validateCredentials(usuario, clave) → objeto_usuario | null
```

> ⚠️ `authenticateUser` recibe un **objeto** `{ usuario, clave }` — no dos argumentos separados.  
> En caso de error, `AppTomaFisica.js` lee `result.error`. Nunca usar `result.message`.  
> `result.redirectPath` es obligatorio: `navigate(result.redirectPath)` lo usa para redirigir tras login.

### Autenticación: estado real confirmado por código (auditoría multiempresa)

> ⚠️ **CRÍTICO:** `authService.js` valida usuario/clave contra un **array hardcodeado en el código fuente** (`USERS`), con `Clave: '123'` para todos los usuarios. **No usa Firebase Authentication.** `firebaseConfig.js` solo inicializa `getFirestore`, no `getAuth`. Por lo tanto `request.auth` en las reglas de Firestore **siempre es `null`**.

Consecuencias:
- "Estar logueado" es un estado en memoria/`localStorage`, generado por la propia app — Firebase no lo conoce.
- Cualquier persona con el `projectId` (visible en `firebaseConfig.js`, es público por diseño) puede leer/escribir `estimaciones` directamente contra la API de Firestore sin pasar por la app.
- Las reglas de `firestore.rules` no pueden validar identidad ni rol, solo forma de los documentos.

**Plan de migración:** ver sección [Plan Multiempresa — Decisión de Seguridad](#plan-multiempresa--decisión-de-seguridad).

- **Roles disponibles** (valores exactos almacenados en `user.Rol`):

| Constante | Valor string | Usuario en login |
|---|---|---|
| `ROLES.ADMINISTRADOR` | `'Administrador'` | Administrador |
| `ROLES.SUPERVISOR_ESTIMACION` | `'Supervisor Estimacion'` | *(sin usuario en login actualmente)* |
| `ROLES.SUPERVISOR_COSECHA` | `'Supervisor Cosecha'` | Supervisor Cosecha |
| `ROLES.LOGISTICA` | `'Logistica'` | Logistica |
| `ROLES.GERENTE_GENERAL` | `'Gerente General'` | Gerente General |
| `ROLES.GERENTE_PRODUCCION` | `'Gerente Produccion'` | Gerente Produccion |
| `ROLES.MUESTREADOR` | `'Muestreador'` | Muestreador |

> ⚠️ **Muestreador es un rol independiente.** Representa al peón de campo que toma la muestra física: uno canta desde adentro de la parcela, otro digita en el celular desde la orilla. NO es sinónimo de `Supervisor Estimacion`.

- **Rutas por rol** (definidas en `ROLE_ROUTES`):

| Rol | Ruta |
|---|---|
| Administrador | `/admin` |
| Supervisor Estimacion | `/estimaciones` |
| Supervisor Cosecha | `/estimaciones` |
| Logistica | `/estimaciones` |
| Gerente General | `/gerencia` |
| Gerente Produccion | `/gerencia` |
| Muestreador | `/estimaciones` |

> ⚠️ Usuarios eliminados: `Admin`, `Supervisor`, `Gerente` (nombres genéricos viejos). No restaurar.

---

## Sistema de Permisos — `src/constants/permissions.js`

> Archivo creado en este proyecto. **No mezclar con roles.js.**  
> `roles.js` es la fuente de verdad de los valores string. `permissions.js` DEBE copiar esos mismos valores exactos.

### Constantes exportadas

```js
NIVEL_ACCESO = { NINGUNO, CONSULTA, CONSULTA_EDICION }
ROLES        // mismos valores que roles.js — copiar exactamente, sin espacios extra
PANTALLAS    // claves simbólicas de cada pantalla
PERMISOS_ROL // matriz [rol][pantalla] → NIVEL_ACCESO
```

### Helpers exportados

```js
getNivelAcceso(rol, pantalla)  // → "CONSULTA_EDICION" | "CONSULTA" | "NINGUNO"
puedeConsultar(rol, pantalla)  // → true si CONSULTA o CONSULTA_EDICION
puedeEditar(rol, pantalla)     // → true solo si CONSULTA_EDICION
esAdministrador(rol)           // → true solo para "Administrador"
```

### Patrón de uso en pantallas

```js
import { puedeEditar, PANTALLAS } from '../constants/permissions';

const rol = user?.Rol;
const canEdit = puedeEditar(rol, PANTALLAS.CONSULTA_EST_FRUTA);

// En JSX: ocultar botones de edición
{canEdit && <BotonGuardar />}
{canEdit && <BotonEditar />}
```

### Matriz de permisos

> ⚠️ **Tabla re-derivada del código el 2026-11-07.** La versión anterior de este CODEX tenía varias filas equivocadas (sobre todo la columna Admin y la fila de PantallaConsultaEstFruta). Si hay duda, manda `src/constants/permissions.js`, no esta tabla.

| Pantalla | Admin | Sup.Est | Sup.Cos | Logist. | Ger.Gen | Ger.Pro | Muestreador |
|---|---|---|---|---|---|---|---|
| PantallaConsultaEstFruta | C/E | C/E | C/E | C/E | C/E | C/E | C/E |
| EstimacionSamplingEditPage | C/E | C/E | C | C | C | C | C |
| EstimationHeaderPage | C | C | C | C | C | C | **C/E** |
| EstimacionSamplingPageTF | C/E | C/E | C | C | C | C | C/E |
| PantallaAnalisisGF_Lote | C | C | C | C | C | C | — |
| PantallaAnalisisParcelaDetalle | C | C | C | C | C | C | — |
| PantallaDatosGuardadosCelular | C/E | C/E | C | C | C | C | C/E |
| PantallaEstimacionPorGF | C | C | C | C | C | C | — |
| PantallaEstimacionPorSeccion | C | C | C | C | C | C | — |

> C/E = Consulta/Edición · C = Consulta · — = Ninguno

> ⚠️ **Solo el Muestreador puede iniciar un muestreo.** `EstimationHeaderPage` es la única pantalla donde el Muestreador tiene edición y los demás no — incluido el Administrador. El botón "Iniciar muestreo" usa `disabled={!canEdit || hasPendingVerification}`, así que con cualquier otro rol aparece gris. No es un bug.

> ⚠️ **La matriz casi no se aplica.** Solo dos pantallas la consultan: `PantallaConsultaEstFruta` y `EstimationHeaderPage`. `EstimationSamplingEditPage` **no importa `permissions.js`**: usa su propio `isSupervisorEstimacion = rol === ROLES.SUPERVISOR_ESTIMACION` para guardar, aprobar y anular. Las seis restantes no aplican ningún control de rol. Antes de confiar en una celda de esta tabla, verificá que la pantalla efectivamente la lea.

### Permisos de administración de usuarios (preparados, no implementados)

```js
// En PERMISOS_ADMIN_USUARIOS — todos en false hasta implementar la pantalla de usuarios
puedeCrearUsuarios:    false   // TODO: true para Administrador
puedeEliminarUsuarios: false   // TODO: true para Administrador
puedeCambiarRoles:     false   // TODO: true para Administrador
```

### Sincronización roles.js ↔ permissions.js
Los valores string de `ROLES` en `permissions.js` deben ser idénticos a `roles.js`.  
Bug histórico: `permissions.js` tenía `"SupervisorEstimacion"` (sin espacio) y `"GerenteGeneral"` (sin espacio) mientras `roles.js` tenía `'Supervisor Estimacion'` y `'Gerente General'`. Esto bloqueaba `ProtectedRoute` para esos roles. Ya corregido.

---

## PantallaConsultaEstFruta — Permisos aplicados ✅

Pantalla donde se aplicó la Fase 1 de permisos. Cambios realizados:

```js
// Import agregado
import { puedeEditar, PANTALLAS } from '../constants/permissions';

// Constantes al inicio del componente
const rol = user?.Rol;
const canEdit = puedeEditar(rol, PANTALLAS.CONSULTA_EST_FRUTA);
```

Elementos protegidos con `{canEdit && (...)}`:

| Elemento | Comportamiento si canEdit = false |
|---|---|
| Botón `+` (crear nueva estimación, header) | Oculto |
| Botón `✏️` (lápiz editar por cada fila) | Oculto |

No se tocó: botón Exit (auth), botón 📊 (navegación), filtros, lógica Firebase, lógica offline.

---

## Motor Matemático — `estfrutaAnalysisService.js`

> ⚠️ NO MODIFICAR. Motor validado con datos reales.

### Función principal
```js
calcularEstimacion(input) → resultado
```

### Input
```js
{
  ptasEst: number,       // plantas en estación
  area: number,          // hectáreas
  tamanos: { 5, 6, 7, 8, 9, 10, 11, 12 },
  defectos: { Muerta, Forza, Enferma, Peque, NDF, Eriza, ... }
}
```

### Output completo
```js
{
  empacables,
  noEmpacables,
  totalMuestra,
  porcentajeEmpacable,
  frutaEmpacableTotal,
  frutasPorTamano,       // { 5, 6, 7, 8, 9, 10, 11, 12 }
  cajasPorTamano,        // { 5, 6, 7, 8, 9, 10, 11, 12 }
  totalCajas,            // cajas empacables
  cajasHaEmpacables,     // cajas/ha empacables
  cajasPorHectarea,      // alias de cajasHaEmpacables
  cajasNoEmpacables,
  cajasHaNoEmpacables,
  totalCajasGeneral,     // totalCajas + cajasNoEmpacables
  cajasHaTotal,          // totalCajasGeneral / area
}
```

### Datos de prueba validados
```
ptasEst: 44379 | area: 0.75
T6:350 T7:647 T8:386 T9:253 T10:300 T11:250 T12:100
Muerta:144 Forza:6 Enferma:28 NDF:115 Quebrada:52 ...

→ totalCajas:        4,808
→ cajasNoEmpacables:   780
→ totalCajasGeneral: 5,588
→ cajasHaEmpacables: 6,411
→ cajasHaTotal:      7,451
```

### Relación con `estimationBusinessRules.js` — IMPORTANTE

Existen **dos motores de cálculo distintos sobre los mismos datos crudos**:

| Motor | Archivo | Calcula | Cuándo se usa |
|---|---|---|---|
| Motor de conteo | `estimationBusinessRules.js` → `aggregateFrutasFromDetalle()` | `frutasEmpacables`, `frutasNoEmpacables`, `frutasTotales` (conteo de frutas) | Al **guardar** en Firebase (dentro de `estimationService.js`) |
| Motor de análisis | `estfrutaAnalysisService.js` → `calcularEstimacion()` | `cajasPorTamano`, `cajasHaTotal`, `totalCajasGeneral`, etc. (proyección de cajas/ha) | Al **consultar** análisis (`PantallaEstimacionPorSeccion`, etc.) |

Ambos parten del array `detalle` crudo y recalculan por separado. **No son redundantes** (calculan cosas distintas), pero **no están sincronizados**: si se modifica la lógica de uno sin actualizar el otro, los totales de la pantalla de consulta pueden diferir de los guardados en Firebase sin ninguna advertencia. Esto no es un bug hoy, pero es una fragilidad a vigilar.

---

## Patrones de consulta a Firestore — Auditado

Hay dos patrones distintos conviviendo en las pantallas:

### Patrón A — Recalcula en cada consulta (motor de la app)
**Pantallas:** `PantallaEstimacionPorSeccion.jsx`

Trae un documento por `id` con `getDoc`, reconstruye `tamanos`/`defectos` desde el array `detalle` (datos crudos), y **recalcula todo en cada visita** llamando a `calcularEstimacion()`. Ignora los campos ya agregados (`frutasEmpacables`, `frutasTotales`) que `estimationService.js` guardó en el documento.

Para multiempresa: el filtro de empresa va **después del fetch**, verificando que `data.empresaId === user.empresaId` antes de renderizar. Si no coincide, tratar como "no encontrado".

### Patrón B — Lee campos ya guardados, sin recalcular
**Pantallas:** `PantallaConsultaEstFruta.js`, `PantallaDatosGuardadosCelular.js`

Traen todos los documentos con `getDocs(collection(db, 'estimaciones'))` **sin ningún filtro `where`**, y leen campos tal cual están guardados. El filtrado por GF/Lote/Sección ocurre en memoria del cliente.

> ⚠️ **FUGA DE DATOS CONFIRMADA:** Con la query actual sin `where`, cuando haya varias empresas, **todos los documentos de todas las empresas llegarán al dispositivo del usuario**, aunque la UI no los muestre. Este es el cambio más crítico a hacer para multiempresa.

**Pendiente de auditar con el mismo criterio:** `PantallaEstimacionPorGF.js`, `PantallaAnalisisGF_Lote.js`, `PantallaAnalisisParcelaDetalle.jsx`. Por su estructura, probablemente traen múltiples documentos (patrón B) y tienen el mismo problema.

---

## Rutas de la App

```
/login                               → LoginScreen
/admin                               → PantallaConsultaEstFruta (ProtectedRoute)
/gerencia                            → PantallaConsultaEstFruta (ProtectedRoute)
/estimaciones                        → PantallaConsultaEstFruta (ProtectedRoute — Sup.Est, Sup.Cos, Logistica, Muestreador)
/estimaciones/nueva                  → EstimationHeaderPage
/estimaciones/muestreo               → EstimationSamplingPageTF
/estimaciones/editar/:id             → EstimationSamplingEditPage
/estimaciones/locales                → PantallaDatosGuardadosCelular
/estimaciones/seccion/:id            → PantallaEstimacionPorSeccion ✅ Sprint 2
/estimaciones/gf                     → PantallaEstimacionPorGF ✅ Sprint 7
/estimaciones/analisis               → PantallaAnalisisGF_Lote ✅
/estimaciones/analisis/parcela/:id   → PantallaAnalisisParcelaDetalle ✅ Sprint 3
```

> Todas las rutas `/estimaciones/*` están dentro de `ProtectedRoute` con `allowedRoles={[...ROLE_OPTIONS]}`.  
> Al agregar rutas nuevas, **siempre** agregarlas en `AppTomaFisica.js` dentro del bloque `ProtectedRoute` existente.

---

## Flujo Offline

```
PantallaConsultaEstFruta
  → [+] EstimationHeaderPage (offline)
    → EstimationSamplingPageTF (offline)
      → PantallaDatosGuardadosCelular
        → EstimationSamplingEditPage (verificar)
          → puede volver a Cabecera o Consulta
```

---

## Estructura de documento Firebase (`estimaciones`)

```js
{
  // Campos canónicos guardados por estimationService (minúscula + número)
  cosecha, tipo, semana, forza,
  lote,    // Number — campo canónico
  parcela, // Number — campo canónico
  poblacion, ptasEstac, ptasMues, area,
  GF,          // String mayúscula — campo canónico
  uniqueKey,   // String — clave única de duplicados
  anio,        // Number — año de la estimación
  createdAt, updatedAt,
  isHeaderOnly,
  detalle: [
    { tipoLinea: 'TAMANO',  codigoClasificacion: '6',      cantidadDelta: 350 },
    { tipoLinea: 'TAMANO',  codigoClasificacion: '7',      cantidadDelta: 647 },
    { tipoLinea: 'DEFECTO', codigoClasificacion: 'Muerta', cantidadDelta: 144 },
    ...
  ],
  verificado: true,   // ← campo agregado en Sprint 2
  aprobadoPor,        // ← String — quién aprobó (solo lo escribe handleAprobar)
  aprobadoEn,         // ← Date — cuándo se aprobó
  anulado: true,      // ← Boolean — borrado lógico (S15). Si falta, el registro está vigente
  anuladoPor,         // ← String — quién anuló
  anuladoEn,          // ← Date — cuándo se anuló
  // empresaId: string  ← campo a agregar en Fase Multiempresa (aún no implementado)
}
```

<a id="doble-grafia-campos"></a>
### ⚠️ Los documentos reales tienen las dos grafías conviviendo — verificado 2026-11-07

Inspección directa de un documento de producción en la consola de Firebase (`estimaciones/0gDbNEG9zzG83YSCo7G0`). El documento contiene **ambos juegos de campos a la vez**:

| Con mayúscula inicial | En minúscula |
|---|---|
| `Area`, `Cosecha`, `Forza`, `GF`, `Lote`, `Parcela`, `Poblacion`, `PtasEstac`, `PtasMues`, `PtasMuestras`, `Semana`, `Tipo` | `area`, `cosecha`, `forza`, `lote`, `parcela`, `poblacion`, `ptasEstac`, `ptasMues`, `semana`, `tipo` |

Además hay duplicación de tipo: `Poblacion: "10010"` (string) junto a `ptasEstac: 10010` (int64), y `PtasEstac: "8964"` (string) junto a `poblacion: 8964` (int64) — es decir, los pares no solo difieren en mayúscula, en algunos casos están **cruzados**. Revisar antes de confiar en cualquiera de los dos para cálculos.

**Por qué pasa:** el encabezado se crea con los campos en mayúscula, y después `estimationService.js` hace `updateDoc` con el payload en minúscula. Como `updateDoc` fusiona en vez de reemplazar, el documento termina con los dos juegos.

**Consecuencias prácticas:**
1. La validación de `firestore.rules` que exige `Cosecha`/`Tipo`/`Lote`/`Parcela` (mayúscula) **sí se cumple** — tanto al crear (el encabezado los trae) como al actualizar (`request.resource.data` en un update es el documento fusionado resultante, que ya los contiene). Ver [Incidente de reglas vencidas](ESTFRUTA_HISTORIAL.md#incidente-reglas-2026-11-07).
2. **No "corregir" las reglas a minúscula** pensando que hay un mismatch: eso rompería la creación de encabezados.
3. La Regla 8 (`??` en vez de `||`) y el orden de prioridad de la normalización existen precisamente por esta doble grafía. No es cosmético: elegir mal la prioridad hace que una pantalla lea el valor equivocado.
4. Limpiar esto (quedarse con un solo juego de campos) es un backfill pendiente, no decidido. Mientras tanto, toda lectura nueva debe usar el patrón de normalización de abajo.

### Normalización de campos Firebase
```js
// Prioridad correcta — usar ?? (nullish) no || para evitar que 0 descarte el valor
cosecha:  data.Cosecha  ?? data.cosecha  ?? data.pc      ?? ''
tipo:     data.Tipo     ?? data.tipo     ?? ''
lote:     data.Lote     ?? data.lote     ?? ''   // Lote (mayúscula) primero
parcela:  data.Parcela  ?? data.parcela  ?? data.seccion ?? ''
ptasEst:  Number(data.PtasEstac ?? data.ptasEstac ?? data.ptasEst ?? 0)
area:     Number(data.Area ?? data.area ?? 0)
gf:       data.GF || data.gf || ''   // GF mayúscula primero
```

---

## Sistema de uniqueKey — Anti-duplicados

### Función `crearUniqueKey(header)` — `operationalDraftStorage.js`
```js
// Formato actual:    COSECHA-TIPO-GF-LOTE-PARCELA-AÑO
// Formato multiempresa: EMPRESA-COSECHA-TIPO-GF-LOTE-PARCELA-AÑO  ← pendiente
// Ejemplo actual: PC-C1-5-20-11-9-2026
export function crearUniqueKey(header) {
  const cosecha = String(header.Cosecha ?? header.cosecha ?? '').trim().toUpperCase();
  const tipo    = String(header.Tipo    ?? header.tipo    ?? '').trim().toUpperCase();
  const gf      = String(header.GF      ?? header.gf      ?? '').trim().toUpperCase();
  const lote    = String(Number(header.Lote    ?? header.lote    ?? 0));
  const parcela = String(Number(header.Parcela ?? header.parcela ?? 0));
  const anio    = String(header.anio ?? new Date().getFullYear());
  return [cosecha, tipo, gf, lote, parcela, anio].join('-');
}
```

> ⚠️ **Para multiempresa:** la clave debe incluir `empresaId` como primer segmento. Sin esto, dos empresas con el mismo Lote/Parcela/Cosecha se bloquearían mutuamente con falso positivo de duplicado. Pendiente de implementar.

> ⚠️ **Nota 2026-11-07:** en el documento de producción inspeccionado, `uniqueKey` vale `"C1-11-40-2026"` — solo 4 segmentos (TIPO-LOTE-PARCELA-AÑO), no los 6 que genera `crearUniqueKey()` hoy. Hay documentos guardados con un formato de clave anterior. Al tocar la clave para multiempresa, contemplar que conviven al menos dos formatos en la base.

### Reglas de duplicados
- `PC` y `RC` pueden coexistir para la misma parcela si son cosecha/año distinta
- La validación aplica **solo a registros nuevos**
- En modo edición se excluye el propio `id`/`docId` de la consulta
- Mensaje estándar: `"Ya existe una estimación para esta Cosecha, Tipo, GF, Lote, Parcela y Año."`

### Flujo de validación
1. **Online → Firebase:** `checkFirebaseDuplicate(uniqueKey, excludeId?)` — consulta `where('uniqueKey', '==', uniqueKey)`
2. **Offline → local:** `localDuplicateExists(header, registrosLocales, excludeId?)` — compara contra array de `useOffline`
3. **Sync local→Firebase:** `PantallaDatosGuardadosCelular` verifica contra Firebase antes de `syncRegistro()`

### Botón 🗑️ en PantallaDatosGuardadosCelular
- Al detectar duplicado en sync, se activa `duplicadosDetectados[item.id] = true`
- Aparece botón 🗑️ (fondo rojo suave) solo para ese registro
- Al pulsar pide confirmación y llama `eliminarRegistroLocal(id)`

---

## Defectos — `src/constants/sampling.js`

> Para agregar o reordenar defectos, **solo tocar `sampling.js`**. Las pantallas consumen `DEFECT_CODES` con `.map()` dinámicamente.

```js
export const DEFECT_CODES = Object.freeze([
  'Muert', 'Forza', 'Enfer', 'Peque', 'NDF',   'QSol',
  'Conic', 'Eriza', 'Somb',  'Cuello','Defor',  'Quebr',
  'Cicatr','Doble', '+Pequ', 'Mult',  'Torcid', 'Roedo',
  'Tecla', 'Erphin',
]);
```

---

## PantallaEstimacionPorGF — Sprint 7 ✅

### Prefijo CSS
Todas las clases usan el prefijo `.pgf-` (ej: `.pgf-page`, `.pgf-header`, `.pgf-chart-card`).

### Archivos
```
pages/PantallaEstimacionPorGF.js
pages/PantallaEstimacionPorGF.css
```

### Secciones (de arriba a abajo)
1. **Header** — título "Estimación por GF" + subtítulo con GF/Cosecha activos. Botón `←` vuelve. Botón `📈` navega a `PantallaAnalisisGF_Lote`.
2. **Filtros** — dos `<select>`: GF (izquierda) y Cosecha/PC (derecha). Clases `.pgf-filters` / `.pgf-select`.
3. **Resumen** — Parcelas | Has GF. Clase `.pgf-summary-top`.
4. **Totales** — tres filas: Total Cajas / Cajas No Empacables / Cajas Empacables, cada una con Cajas/Ha. Clases `.pgf-total-box` / `.pgf-total-row` con modificadores `.total`, `.no-empacables`, `.empacables`.
5. **Tabla tamaños** — T5–T12, cabecera con colores por tamaño. Clase `.pgf-size-table`.
6. **Gráfico Curva de Tamaños** — barras verticales con % y grupos Grandes/Intermedios/Pequeños. Clase `.pgf-chart-card` + `.pgf-size-chart`. **Es clickeable** → navega a `PantallaAnalisisGF_Lote` con GF fijado.
7. **Gráfico Motivos de No Empaque** — top 12 defectos ordenados mayor→menor. Clase `.pgf-chart-card pgf-defects-card`.

### Motor de cálculo interno — `calcularGF(registrosFiltrados)`
> Desde 2026-07-28 (S11) llama a `proyectarCajas()` de `estfrutaAnalysisService.js` para el KPI y el color — ya no reimplementa la fórmula a mano. Ver [Auditoría de Motores de Cálculo](ESTFRUTA_HISTORIAL.md#auditoria-motores-calculo).

```js
function extraerMuestras(doc)
  → { tamanos, defectos, motivosMap }
  // motivosMap = { 'codigo||nombre': cantidad }

function calcularGF(registrosFiltrados)
  → {
      cajasExport, cajasNoEmp, totalDisp,
      totalMotivosNoEmpaque,   // ← total crudo de frutas defectuosas (para mostrar en título)
      areaAcum, cajasHa, cajasHaNoEmp, cajasHaTotal,
      cajasPorTam, tamAcum,
      cajasRedondeadasPorTamano, totalCajasTabla,
      porcentajePorTamano,
      grupoGrandes, grupoIntermedios, grupoPequenos, maxPct,
      colorCajasHa,
      top12Motivos,  // array de { codigo, nombre, abrev, total } — máx 12, ordenado desc
      maxMotivo,     // total del primer motivo (para escalar barras)
    }
```

### Color Cajas/Ha (consistente en toda la app)
```js
>= 7500 → '#16a34a' (verde)
>= 5500 → '#f59e0b' (amarillo/naranja)
<  5500 → '#dc2626' (rojo)
```

### Colores de motivos (`.pgf-defect-color-1` … `.pgf-defect-color-12`)
Paleta multicolor para distinguir hasta 12 barras: violeta, azul, cyan, verde, amarillo, naranja, rojo, rosa, morado, teal, lima, slate.

### Gráfico de tamaños como botón de navegación
```js
// pgf-chart-card--clickable: hover eleva la card con sombra roja suave
// pgf-tap-hint: texto pequeño "· Ver detalle →" junto al título
onClick={() =>
  navigate('/estimaciones/analisis', {
    state: { gfFijado: filtroGF === 'Todos' ? null : filtroGF },
  })
}
```

---

## Sistema de Navegación GF Fijado ✅ Sprint 7

### Concepto
El GF se selecciona **una sola vez** en `PantallaEstimacionPorGF` y viaja en modo **solo lectura** hacia las pantallas de análisis. El usuario no puede cambiar el GF en `PantallaAnalisisGF_Lote` ni en `PantallaAnalisisParcelaDetalle`.

### Flujo completo
```
PantallaEstimacionPorGF
  [usuario selecciona GF 5-20]
  [toca gráfico de tamaños o botón 📈]
  → navigate('/estimaciones/analisis', { state: { gfFijado: '5-20' } })

PantallaAnalisisGF_Lote
  gfFijado = location.state?.gfFijado  // '5-20'
  → selector GF reemplazado por pill bloqueada (.agl-gf-fijado)
  → selector Lote sigue libre
  [usuario toca botón 📈 de una parcela]
  → navigate('/estimaciones/analisis/parcela/:id', { state: { ..., gfFijado } })

PantallaAnalisisParcelaDetalle
  gfFijado = location.state?.gfFijado  // propagado
  [usuario toca ←]
  → navigate('/estimaciones/analisis', { state: { gfFijado } })
  // vuelve a AnalisisGF_Lote con el mismo GF bloqueado

PantallaAnalisisGF_Lote (al volver)
  [usuario toca ←]
  → gfFijado
      ? navigate('/estimaciones/gf', { state: { gfFijado } })
      : navigate(-1)

PantallaEstimacionPorGF (al volver)
  gfRestaurado = location.state?.gfFijado ?? 'Todos'
  const [filtroGF, setFiltroGF] = useState(gfRestaurado)
  // selector restaurado al GF original
```

### Cambios en `PantallaEstimacionPorGF.js`
```js
// 1. Import
import { useNavigate, useLocation } from 'react-router-dom';

// 2. Leer GF restaurado al volver
const location     = useLocation();
const gfRestaurado = location.state?.gfFijado ?? 'Todos';

// 3. Estado inicial del filtro
const [filtroGF, setFiltroGF] = useState(gfRestaurado);

// 4. Botón 📈 y card gráfico → pasar gfFijado
navigate('/estimaciones/analisis', {
  state: { gfFijado: filtroGF === 'Todos' ? null : filtroGF },
})
```

### Cambios en `PantallaAnalisisGF_Lote.js` (patch aplicado)
```js
// 1. Import
import { useNavigate, useLocation } from 'react-router-dom';

// 2. Leer gfFijado
const location = useLocation();
const gfFijado = location.state?.gfFijado ?? null;

// 3. Estado inicial del filtro GF
const [filtroGF, setFiltroGF] = useState(gfFijado ?? 'Todos');

// 4. Selector GF condicional
{gfFijado ? (
  <div className="agl-gf-fijado">
    <span className="agl-gf-fijado-label">GF</span>
    <span className="agl-gf-fijado-val">GF {gfFijado}</span>
    <span className="agl-gf-fijado-icono">🔒</span>
  </div>
) : (
  <select ...>...</select>
)}

// 5. Al navegar a ParcelaDetalle → propagar gfFijado
navigate('/estimaciones/analisis/parcela/:id', {
  state: { lote, parcela, cosecha, gfFijado },
})

// 6. Botón ←
onClick={() =>
  gfFijado
    ? navigate('/estimaciones/gf', { state: { gfFijado } })
    : navigate(-1)
}
```

### Clases CSS del GF bloqueado — `PantallaAnalisisGF_Lote.css`
```css
.agl-gf-fijado         /* contenedor pill: fondo #fff1f2, borde #fca5a5 */
.agl-gf-fijado-label   /* "GF" en gris pequeño */
.agl-gf-fijado-val     /* valor "GF 5-20" en rojo oscuro */
.agl-gf-fijado-icono   /* 🔒 */
```

### Clase CSS de card clickeable — `PantallaEstimacionPorGF.css`
```css
.pgf-chart-card--clickable   /* hover: sombra roja + translateY(-1px) */
.pgf-tap-hint                /* texto pequeño "· Ver detalle →" en rojo */
```

---

## PantallaAnalisisParcelaDetalle — Sprint 3 ✅

### Ruta
```
/estimaciones/analisis/parcela/:id
```

### Acceso
Desde `PantallaAnalisisGF_Lote` → botón 📈 de cada fila de parcela.

### Secciones
1. **Resumen en una línea:** Cajas Exp | Cajas No Emp | Cajas/Ha (con color dinámico)
2. **Gráfico Cajas por Tamaño** — barras T5–T12 con colores por tamaño
3. **Tabla horizontal % por Tamaño** — `table-layout: fixed`, siempre ancho completo
4. **Grupos** — Grandes (T5+T6+T7) / Intermedios (T8+T9) / Pequeños (T10+T11+T12)
5. **Gráfico Top 12 Defectos** — altura igual al gráfico de tamaños (90px en celular)

### Color Cajas/Ha
```js
>= 7500 → '#166534' (verde)
>= 5500 → '#f97316' (naranja)
<  5500 → '#dc2626' (rojo)
```

### Motor de cálculo propio
`PantallaAnalisisParcelaDetalle` tiene su propia función `calcular(data)`, que desde 2026-07-28 (S11) llama a `proyectarCajas()` de `estfrutaAnalysisService.js` para el KPI y el color de "Cajas/Ha" (antes usaba suma de tamaños ya redondeados, bug #1 — ver [Auditoría de Motores de Cálculo](ESTFRUTA_HISTORIAL.md#auditoria-motores-calculo)). `calcular()` sigue siendo dueña de la lectura del documento y del top de defectos; solo la proyección de cajas se delegó.

### CSS — clase especial
```css
.papd-card--defectos  /* card de defectos — altura fija igual que cajas, sin flex:1 */
```

### Sistema de diseño (fuente de verdad visual)
`PantallaAnalisisParcelaDetalle.css` es la **referencia de diseño** del proyecto. Usar como base al crear o rediseñar otras pantallas:
- Fondo: `#f3f4f6`
- Font: `system-ui, -apple-system, sans-serif`
- Cards: `background #fff`, `border-radius 12px`, `box-shadow 0 1px 4px rgba(0,0,0,0.08)`
- Header: `#dc2626` (rojo)
- Colores tamaños T5–T12: `#006b35 → #2f8f58 → #5fbd62 → #ca8a04 → #ea580c → #f66b45 → #dd3029 → #b4002d`

---

## PantallaAnalisisGF_Lote

- Ordenamiento de parcelas: **Lote ASC → Parcela ASC** (numérico)
- Botón 📈 de cada parcela navega a `/estimaciones/analisis/parcela/${p.id}` — con `gfFijado` en state
- Resumen superior muestra totales del lote seleccionado
- Al volver con GF fijado: botón `←` navega a `/estimaciones/gf` (no `navigate(-1)`)
- `calcularAgrupado()` (usado para el total del lote) y `calcularParcela()` (usado por fila de parcela) llaman a `proyectarCajas()` desde 2026-07-28 (S11). `resLoteDetalle` sigue existiendo como código muerto (suma proyecciones individuales por parcela, nunca renderizado) — no se tocó porque no se usa.
- El total del lote (`resLote.cajasExport`/`cajasHa`) **no es la suma de las filas de parcela** — es el resultado de combinar las muestras crudas de todas las parcelas del lote y proyectar una sola vez. Confirmado como comportamiento correcto (no bug) el 2026-07-28 con un caso real de producción; se agregó `.agl-resumen-nota` en la UI para aclararlo. Ver [Auditoría de Motores de Cálculo](ESTFRUTA_HISTORIAL.md#auditoria-motores-calculo), bug #3.

---

## Plan Multiempresa — Decisión de Seguridad

> 📄 **Plan de implementación fase por fase para la Opción B:** ver `ESTFRUTA_PLAN_MULTIEMPRESA_OPCION_B.md` (mismo directorio que este CODEX). Ese documento define el orden de ejecución y qué probar en cada paso. Nada de ese plan se ha ejecutado todavía.
>
> ⚠️ **El plan está desactualizado en dos puntos desde el 2026-11-07:** (a) su "deadline duro del 31 de agosto" ya pasó y quedó resuelto por el arreglo de reglas, así que ya no hay fecha forzando la Fase 6 — lo que la justifica ahora es la exposición permanente descrita arriba; (b) su tarea **0.1** (verificar el mismatch de mayúsculas) está cerrada: no había mismatch. Su tarea **0.2** también está cerrada: el `throw` de depuración es código muerto inalcanzable, no bloquea nada (se comprobó creando estimaciones reales en producción).

### Concepto central
Cada documento en Firestore debe saber a qué empresa pertenece. Todas las queries deben filtrar por `empresaId`. La clave de duplicados debe incluir `empresaId`.

### Dos opciones de implementación (pendiente decisión)

#### Opción A — Mínimo viable (sin Firebase Auth)
- Login sigue siendo array local en `authService.js`, se agrega `empresaId` a cada usuario
- `empresaId` viaja en sesión (`localStorage`) y se inyecta en cada documento al guardar
- Queries: `where("empresaId", "==", user.empresaId)` en el cliente
- Reglas: validan que el documento tenga `empresaId` (forma), pero **no pueden verificar identidad**
- Separación es **funcional (UI)**, no real: alguien con devtools puede leer datos de otras empresas

**Cuándo aplica:** clientes de confianza, datos no críticos, deadline urgente. Tratar como puente temporal.

#### Opción B — Robusta (Firebase Authentication + Custom Claims) ← RECOMENDADA
- Migrar login a `signInWithEmailAndPassword` o equivalente de Firebase Auth
- Asignar `empresaId` y `rol` como Custom Claims via Cloud Function (`onCreate` o callable)
- Reglas pueden verificar: `request.auth.token.empresaId == resource.data.empresaId`
- Aislamiento **real** entre empresas, garantizado por Firebase, no solo por el cliente
- Costo: reescribir `authService.js`, `LoginScreen.js`, `AppTomaFisica.js`; activar Cloud Functions; migrar usuarios a Firebase Auth con contraseñas reales

**Por qué se recomienda B:** dado que hay que tocar `authService.js` y `firestore.rules` de todas formas, el costo incremental de hacerlo bien de una vez es menor que parchear dos veces.

### Archivos a modificar para Fase Multiempresa (inventario completo)

| Archivo | Cambio requerido |
|---|---|
| `authService.js` | Agregar `empresaId` (y `empresaNombre`) a cada usuario del array `USERS`. Incluirlos en el objeto de sesión que devuelve `authenticateUser`. Si se elige Opción B, reescribir completamente usando Firebase Auth. |
| `AppTomaFisica.js` | El inicializador síncrono de `useState` ya lee `localStorage` — verificar que `empresaId` se conserve al parsear la sesión. |
| `EstimationHeaderPage.js` | ⚠️ **Aquí vive el `addDoc` real** que crea las estimaciones (`guardarFirebase()`). Es el archivo donde hay que inyectar `empresaId` al crear. También hay que agregarlo al chequeo de duplicados y al payload que se guarda localmente en modo offline. |
| `estimationService.js` | Inyectar `empresaId` en los `updateDoc`, y `where('empresaId','==',empresaId)` en `checkFirebaseDuplicate`. **Ojo:** este archivo NO crea documentos — su `requestCreateEstimation` es código muerto. No alcanza con tocar solo este archivo. |
| `operationalDraftStorage.js` | `crearUniqueKey()`: agregar `empresaId` como primer segmento de la clave. |
| `PantallaConsultaEstFruta.js` | Cambiar `getDocs(collection(db,'estimaciones'))` por `getDocs(query(collection(db,'estimaciones'), where('empresaId','==',user.empresaId)))`. **Este es el cambio más crítico.** |
| `PantallaDatosGuardadosCelular.js` | Mismo cambio de query. Verificar también que los registros locales (`useOffline`) lleven `empresaId` al sincronizar. |
| `PantallaEstimacionPorSeccion.jsx` | Trae por `id` directo (`getDoc`): después del fetch verificar `data.empresaId === user.empresaId`. Si no coincide, tratar como "no encontrado". |
| `PantallaEstimacionPorGF.js`, `PantallaAnalisisGF_Lote.js`, `PantallaAnalisisParcelaDetalle.jsx` | **Confirmado patrón B** (traen todos los documentos sin `where`) — requieren `where('empresaId',...)`. |
| `useOffline.js` | Verificar que la clave de almacenamiento local incluya `empresaId` o que la caché se limpie al cambiar de sesión/empresa. |
| `ProtectedRoute.js` | Agregar verificación: si el usuario no tiene `empresaId` válido o empresa inactiva, redirigir a login. |
| `firestore.rules` | Reemplazar `if true` por las reglas con `request.auth` de la Opción B (abajo). |
| Firebase colección `empresas` | Nueva colección a crear: `{ nombre, activa }` por documento. |

### Estructura de usuario con multiempresa
```js
// authService.js — USERS (versión multiempresa)
{
  Usuario:       'Juan Pérez',
  Clave:         '...',        // En Opción B: contraseña real en Firebase Auth, no aquí
  Rol:           ROLES.SUPERVISOR_ESTIMACION,
  empresaId:     'empresa_001',
  empresaNombre: 'Bananera del Norte',  // denormalizado para evitar join en cada pantalla
}
```

### uniqueKey con multiempresa
```js
// Formato multiempresa: EMPRESA-COSECHA-TIPO-GF-LOTE-PARCELA-AÑO
// Ejemplo: EMP001-PC-C1-5-20-11-9-2026
// Sin empresaId en la clave: dos empresas con mismo lote/parcela se bloquean mutuamente
```

### Colección `empresas` en Firestore
```
empresas/
  empresa_001/
    nombre: "Bananera del Norte"
    activa: true
  empresa_002/
    nombre: "Finca El Progreso"
    activa: true
```

### Reglas Firestore — Opción B (Firebase Auth + Custom Claims)
```js
// Con Firebase Auth, las reglas pueden verificar identidad real:
allow read: if request.auth != null
  && request.auth.token.empresaId == resource.data.empresaId;

allow create: if request.auth != null
  && request.auth.token.empresaId == request.resource.data.empresaId
  && request.resource.data.keys().hasAll(['empresaId','Cosecha','Tipo','Lote','Parcela']);

allow update: if request.auth != null
  && request.auth.token.empresaId == resource.data.empresaId;

allow delete: if false;
```

> ⚠️ Nótese que los nombres de campo van en **mayúscula**, igual que hoy. No cambiarlos a minúscula sin antes hacer el backfill que unifique la doble grafía de los documentos.

### Reglas Firestore — Opción A (sin Firebase Auth)
```js
// Sin Firebase Auth, solo se puede validar forma, no identidad.
// Es esencialmente lo que hay hoy, más la exigencia de empresaId:
allow read: if true; // No hay forma de restringir por empresa sin Auth

allow create: if request.resource.data.empresaId is string
  && request.resource.data.empresaId.size() > 0
  && request.resource.data.keys().hasAll(['empresaId','Cosecha','Tipo','Lote','Parcela']);

allow update: if request.resource.data.empresaId is string
  && request.resource.data.empresaId.size() > 0;

allow delete: if false;
```

---

## Sprints

| Sprint | Pantalla / Funcionalidad | Estado |
|---|---|---|
| S1 | Motor `estfrutaAnalysisService` | ✅ Completo |
| S2 | `PantallaEstimacionPorSeccion` | ✅ Completo |
| S3 | `PantallaAnalisisParcelaDetalle` | ✅ Completo |
| S4 | `PantallaAnalisisEstFruta` (análisis global) | ⏳ Futuro |
| S5 | Sistema de permisos por rol (`permissions.js`) | ✅ Completo — Fase 1 |
| S6 | Pantalla administración de usuarios | ⏳ Futuro — Fase 2 |
| S7 | `PantallaEstimacionPorGF` — gráfico motivos + nav GF fijado | ✅ Completo |
| S8 | Multiempresa — Fase 1 (empresaId en documentos y queries) | ⏳ Pendiente decisión |
| S9 | Multiempresa — Fase 2 (Firebase Auth + Custom Claims) | ⏳ Pendiente decisión |
| S10 | Multiempresa — Fase 3 (Panel Administrador General) | ⏳ Futuro |
| S11 | Unificar motores de cálculo de proyección de cajas (5 → 1) | ✅ Implementado, validado (test automatizado, 4/4 passed) y sincronizado en ambas copias del código (2026-07-28) |
| S12 | Aclarar en UI que "Cajas Exp/Ha" del lote no es la suma de las parcelas (bug #3) | ✅ Implementado 2026-07-28 — nota visual agregada en `PantallaAnalisisGF_Lote.js`/`.css`, sin cambiar el cálculo (Opción 1) |
| S13 | Quitar fecha de expiración de `firestore.rules` y reactivar Firestore | ✅ Implementado y publicado 2026-11-07. Verificado con lectura real contra la API (HTTP 200). Ver [Incidente de reglas vencidas](ESTFRUTA_HISTORIAL.md#incidente-reglas-2026-11-07) |
| S14 | Corregir la verificación de muestreos (botón Volver + botón Aprobar) | ✅ Implementado y probado en producción 2026-11-07. Ver [Verificación y anulación](ESTFRUTA_HISTORIAL.md#bugs-verificacion-2026-11-07) |
| S15 | Cambiar Eliminar por anulación (borrado lógico) en las 7 pantallas afectadas | ✅ Implementado y probado en producción 2026-11-07. Ver [Borrado lógico](ESTFRUTA_HISTORIAL.md#borrado-logico) |

---

<a id="bugs-pendientes"></a>
## Bugs detectados — pendientes de corregir

| Bug | Archivo | Causa raíz | Impacto |
|---|---|---|---|
| Código muerto en `estimationService.js` con un `throw` de depuración adentro | `estimationService.js` | `requestCreateEstimation` tiene un `throw new Error(...)` de depuración donde iría un `addDoc`, y `addDoc` se importa sin usarse. **La función no se llama desde ningún lado** (el compilador lo confirma: *'requestCreateEstimation' is defined but never used*), así que el `throw` es inalcanzable | Ninguno funcional, pero es una trampa: hace creer que ahí se crean las estimaciones. Conviene borrar la función. La creación real está en `EstimationHeaderPage.js` → `guardarFirebase()` |
| Registros verificados sin aprobación real | datos en Firestore | El bug del botón Volver (ver [verificación](ESTFRUTA_HISTORIAL.md#bugs-verificacion-2026-11-07)) marcó `verificado: true` sin `aprobadoPor` | Se identifican por tener `verificado: true` y no tener `aprobadoPor`. Pendiente devolverlos a estado no verificado |
| Doble grafía de campos en los documentos (`Cosecha` y `cosecha` conviviendo), con algunos pares cruzados de tipo | Documentos en Firestore | El encabezado se crea con mayúsculas y `updateDoc` agrega después las minúsculas; al fusionar quedan los dos juegos | No rompe nada hoy porque la normalización con `??` lo absorbe, pero duplica almacenamiento y es una trampa para código nuevo. Backfill de limpieza pendiente, no decidido. Ver [doble grafía](#doble-grafia-campos) |
| Exposición permanente de `estimaciones` (lectura y escritura sin autenticación) | `firestore.rules` + `authService.js` | No hay Firebase Auth, así que `request.auth` es `null` y las reglas solo validan forma | Antes la fecha de expiración actuaba como cierre forzado; ahora no hay ninguno. Se cierra con la Fase 6 del plan multiempresa |

> ❌ **Ya NO es un bug:** el supuesto bloqueante de que "no se pueden crear estimaciones nuevas". Se diagnosticó mal el 2026-11-07 leyendo `estimationService.js` en aislamiento: la creación real vive en `EstimationHeaderPage.js` → `guardarFirebase()`, con su propio `addDoc`. Probado en producción el mismo día, online y offline.
>
> ❌ **Tampoco es un bug:** el supuesto "mismatch de mayúsculas entre el payload y las reglas". Se verificó el 2026-11-07 contra un documento real y las escrituras sí pasaban la validación. Ver [Incidente de reglas vencidas](ESTFRUTA_HISTORIAL.md#incidente-reglas-2026-11-07).

---

## Reglas para futuros chats

1. **Siempre editar `AppTomaFisica.js`**, nunca `App.js` ni `AppConsultaEdicion.js`
2. **No modificar** `estfrutaAnalysisService.js` → `calcularEstimacion()` — motor validado
3. **No modificar** Firebase config, lógica offline, ProtectedRoute
4. Toda la matemática de estimaciones debe venir de `calcularEstimacion()` o `proyectarCajas()`
5. Para agregar defectos: solo tocar `src/constants/sampling.js` → array `DEFECT_CODES`
6. CSS optimizado para **celular vertical** (`height: 100dvh` + `flex column` + `overflowY: auto`)
7. Al agregar rutas nuevas, agregarlas en `AppTomaFisica.js` dentro del bloque `ProtectedRoute` existente
8. Campos Firebase: usar `??` (nullish) en lugar de `||` para evitar que `0` o string vacío descarte un valor válido
9. `uniqueKey` y `anio` deben incluirse en todo payload nuevo guardado en Firebase
10. La función `crearUniqueKey()` está en `operationalDraftStorage.js` — importarla desde ahí
11. **`roles.js` es la fuente de verdad de los valores string de roles.** `permissions.js` debe copiar esos valores exactamente — cualquier diferencia rompe `ProtectedRoute`
12. **`authenticateUser(credentials)`** recibe objeto `{usuario, clave}`. Devuelve `{success, user, redirectPath}` o `{success: false, error}`. `AppTomaFisica.js` lee `result.error` y navega con `result.redirectPath`
13. **Muestreador es un rol independiente** (`ROLES.MUESTREADOR = 'Muestreador'`). No asignarlo como `SUPERVISOR_ESTIMACION`
14. Al aplicar permisos en una pantalla: importar `{ puedeEditar, PANTALLAS }` de `permissions.js`, declarar `const rol = user?.Rol` y `const canEdit = puedeEditar(rol, PANTALLAS.NOMBRE)`, luego envolver cada botón de edición/creación/eliminación con `{canEdit && (...)}`
15. **`PantallaAnalisisParcelaDetalle.css` es la fuente de verdad del sistema de diseño visual.** Al rediseñar cualquier pantalla, alinear con sus tokens: fondo `#f3f4f6`, cards blancas con `border-radius 12px`, header `#dc2626`, font `system-ui`
16. **Prefijos CSS por pantalla** — nunca mezclar clases entre archivos:
    - `pgf-` → `PantallaEstimacionPorGF`
    - `agl-` → `PantallaAnalisisGF_Lote`
    - `papd-` → `PantallaAnalisisParcelaDetalle`
17. **Navegación con GF fijado:** el GF se bloquea en `PantallaEstimacionPorGF` y se propaga via `location.state.gfFijado`. Nunca permitir cambiarlo en `PantallaAnalisisGF_Lote` ni en `PantallaAnalisisParcelaDetalle` cuando `gfFijado != null`
18. **`calcularGF()`** en `PantallaEstimacionPorGF.js` retorna `totalMotivosNoEmpaque` (total crudo de frutas defectuosas) y `top12Motivos` (array de máx 12 ordenados desc). Desde S11 delega la proyección de cajas en `proyectarCajas()`
19. **Gráfico de motivos de no empaque:** los nombres vienen de `item.descripcion ?? item.nombreClasificacion ?? item.nombre ?? item.codigoClasificacion`. Si en Firestore el campo tiene otro nombre, ajustar solo en `extraerMuestras()`
20. **Multiempresa — campo `empresaId` es obligatorio en todo documento nuevo.** Tomado de `user.empresaId` en sesión, nunca pedirlo al usuario
21. **Multiempresa — toda query de Firestore debe filtrar por empresa.** Nunca `getDocs(collection(db,'estimaciones'))` sin `where('empresaId','==',user.empresaId)`. Para `getDoc` por `id`, verificar después del fetch
22. **Multiempresa — `crearUniqueKey()` debe incluir `empresaId` como primer segmento.** Sin esto, dos empresas con el mismo Lote/Parcela/Cosecha generan falsos positivos de duplicado
23. **`firestore.rules` ya NO tiene fecha de expiración** (se quitó el 2026-11-07 tras 68 días de app caída). **Nunca volver a poner una fecha de expiración sin crear además un recordatorio de calendario** — este CODEX no alcanzó para detectarlo. Ver [Incidente de reglas vencidas](ESTFRUTA_HISTORIAL.md#incidente-reglas-2026-11-07)
24. **Los documentos de `estimaciones` tienen los campos duplicados en mayúscula y minúscula.** Las reglas validan los de **mayúscula** (`Cosecha`, `Tipo`, `Lote`, `Parcela`) y eso es correcto: el encabezado se crea con mayúsculas. **No cambiar las reglas a minúscula** — rompería la creación de encabezados. Ver [doble grafía](#doble-grafia-campos)
25. **Al cambiar `firestore.rules`, el archivo del repo no hace nada por sí solo.** Firestore solo obedece lo publicado en el servidor: publicar en la consola de Firebase o `firebase deploy --only firestore:rules` desde `C:\proyectos\estfruta` (`.firebaserc` ya apunta al proyecto `estfruta`). Después, verificar con una lectura real contra la API, no asumir. Y antes de un `firebase deploy`, leer el archivo de vuelta desde el disco para confirmar que contiene lo que creés — una escritura puede reportar éxito sin aplicarse (ver [Copia única del proyecto](ESTFRUTA_HISTORIAL.md#copia-unica))
26. **Dos motores de cálculo independientes:** `estimationBusinessRules.js` (conteo de frutas, al guardar) y `estfrutaAnalysisService.js` (proyección de cajas/ha, al consultar). No son redundantes pero tampoco están sincronizados
27. **El flujo de Patrón A (análisis por sección/GF/parcela) recalcula desde `detalle` crudo**; el Patrón B (consulta y datos guardados) lee campos ya guardados sin recalcular. Ambos coexisten
28. **El motor de proyección de cajas está unificado en `proyectarCajas()`** (`estfrutaAnalysisService.js`), S11. `totalCajas` (round-final) es el único KPI válido para "Cajas Exp" y el color de Cajas/Ha; `cajasRedondeadasPorTamano` es solo cosmético para la tabla T5–T12. Si se agrega una pantalla nueva que necesite esta proyección, **llamar a `proyectarCajas()`, no reimplementar la fórmula**
29. **El total de cajas/ha de un lote nunca es igual a sumar las filas de parcela** — es intencional, no un bug. No "corregirlo" para que la suma cuadre; la UI ya tiene `.agl-resumen-nota` aclarándolo
31. **La verificación de un muestreo es exclusiva del Supervisor Estimacion.** Solo `handleAprobar` en `EstimationSamplingEditPage.js` puede escribir `verificado: true`, y siempre junto con `aprobadoPor` y `aprobadoEn`. **Nunca escribir `verificado` desde otro lugar** — ni al navegar, ni al guardar, ni en un efecto. Ya pasó una vez: ver [Verificación y anulación](ESTFRUTA_HISTORIAL.md#bugs-verificacion-2026-11-07)
32. **Los registros no se eliminan, se anulan.** `firestore.rules` bloquea `delete` siempre. Para descartar un registro se escribe `anulado: true` con `anuladoPor` y `anuladoEn`. **Toda pantalla o query nueva que lea `estimaciones` debe excluir los anulados** (`anulado !== true`), incluidos los chequeos de duplicados — si no, un registro anulado sigue sumando en las proyecciones de cajas/ha o bloquea rehacer el muestreo. Ver [Borrado lógico](ESTFRUTA_HISTORIAL.md#borrado-logico)
33. **`estfruta.web.app` sirve la carpeta `build/`, no `src/`.** Editar el código fuente no cambia nada en el sitio publicado. Para que un cambio llegue al celular: `npm run build` y después `firebase deploy --only hosting`. Luego recargar fuerte en el dispositivo, porque el service worker de la PWA puede seguir sirviendo el bundle anterior. Es el mismo tipo de error que la regla 25 describe para `firestore.rules`
34. **Antes de concluir que algo está roto, buscá en todo `src/`, no en un archivo suelto.** El 2026-11-07 se documentó un bloqueante inexistente ("no se pueden crear estimaciones") por leer `estimationService.js` en aislamiento: `addDoc` se importaba sin usarse ahí, pero la creación real estaba en `EstimationHeaderPage.js`. Un `grep -rn` sobre `src/` lo habría evitado
35. **Hay una sola copia local del proyecto: `C:\proyectos\estfruta`** (con git), y este CODEX vive dentro de ella. La copia de OneDrive se abandonó el 2026-11-07 — ver [Copia única del proyecto](ESTFRUTA_HISTORIAL.md#copia-unica). Tras editar este documento o el plan, volver a subirlo al project knowledge de Claude

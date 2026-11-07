# ESTFRUTA CODEX — Archivo Técnico del Proyecto

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

| Pantalla | Admin | Sup.Est | Sup.Cos | Logist. | Ger.Gen | Ger.Pro | Muestreador |
|---|---|---|---|---|---|---|---|
| PantallaConsultaEstFruta | C/E | C/E | C | C | C | C | C |
| EstimacionSamplingEditPage | C/E | C/E | C | C | C | C | C |
| EstimationHeaderPage | C/E | C/E | C | C | C | C | C/E |
| EstimacionSamplingPageTF | C/E | C | C | C | C | C | C/E |
| PantallaAnalisisGF_Lote | C/E | C | C | C | C | C | — |
| PantallaAnalisisParcelaDetalle | C/E | C | C | C | C | C | — |
| PantallaDatosGuardadosCelular | C/E | C/E | C | C | C | C | C/E |
| PantallaEstimacionPorGF | C/E | C | C | C | C | C | — |
| PantallaEstimacionPorSeccion | C/E | C | C | C | C | C | — |

> C/E = Consulta/Edición · C = Consulta · — = Ninguno

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

La migración multiempresa va a tocar exactamente estos mismos archivos (todas sus queries `getDocs`/`getDoc` necesitan `where('empresaId', ...)` — ver inventario en [Plan Multiempresa](#plan-multiempresa--decisión-de-seguridad)). Si se modifican sin unificar antes el criterio de redondeo, la inconsistencia se arrastra a las nuevas queries y se vuelve más difícil distinguir "bug de redondeo preexistente" de "bug introducido por el filtro de empresa".

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
  verificado: true   // ← campo agregado en Sprint 2
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
1. La validación de `firestore.rules` que exige `Cosecha`/`Tipo`/`Lote`/`Parcela` (mayúscula) **sí se cumple** — tanto al crear (el encabezado los trae) como al actualizar (`request.resource.data` en un update es el documento fusionado resultante, que ya los contiene). Ver [Incidente de reglas vencidas](#incidente-reglas-2026-11-07).
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
> Desde 2026-07-28 (S11) llama a `proyectarCajas()` de `estfrutaAnalysisService.js` para el KPI y el color — ya no reimplementa la fórmula a mano. Ver [Auditoría de Motores de Cálculo](#auditoria-motores-calculo).

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
`PantallaAnalisisParcelaDetalle` tiene su propia función `calcular(data)`, que desde 2026-07-28 (S11) llama a `proyectarCajas()` de `estfrutaAnalysisService.js` para el KPI y el color de "Cajas/Ha" (antes usaba suma de tamaños ya redondeados, bug #1 — ver [Auditoría de Motores de Cálculo](#auditoria-motores-calculo)). `calcular()` sigue siendo dueña de la lectura del documento y del top de defectos; solo la proyección de cajas se delegó.

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
- El total del lote (`resLote.cajasExport`/`cajasHa`) **no es la suma de las filas de parcela** — es el resultado de combinar las muestras crudas de todas las parcelas del lote y proyectar una sola vez. Confirmado como comportamiento correcto (no bug) el 2026-07-28 con un caso real de producción; se agregó `.agl-resumen-nota` en la UI para aclararlo. Ver [Auditoría de Motores de Cálculo](#auditoria-motores-calculo), bug #3.

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

1. Los documentos contienen **las dos grafías a la vez** — ver [Los documentos reales tienen las dos grafías conviviendo](#doble-grafia-campos). El encabezado se crea con `Cosecha`/`Tipo`/`Lote`/`Parcela` en mayúscula.
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

El mismo día, al escribir `firestore.rules` en el repo, una primera escritura **reportó éxito pero no se aplicó**. El archivo que quedó en disco fue una versión descartada, con los campos validados en **minúscula** — justo la variante que este documento advierte que rompería la creación de encabezados (ver [doble grafía](#doble-grafia-campos)). Se detectó solo porque se volvió a leer el archivo desde el disco en vez de confiar en la confirmación de "escrito".

De ahí la regla 25: después de tocar `firestore.rules`, **leerlo de vuelta desde el disco y compararlo con lo publicado antes de hacer `firebase deploy`**. Un deploy desde esa carpeta en ese momento habría publicado reglas rotas encima de las buenas.

---

## Plan Multiempresa — Decisión de Seguridad

> 📄 **Plan de implementación fase por fase para la Opción B:** ver `ESTFRUTA_PLAN_MULTIEMPRESA_OPCION_B.md` (mismo directorio que este CODEX). Ese documento define el orden de ejecución y qué probar en cada paso. Nada de ese plan se ha ejecutado todavía.
>
> ⚠️ **El plan está desactualizado en dos puntos desde el 2026-11-07:** (a) su "deadline duro del 31 de agosto" ya pasó y quedó resuelto por el arreglo de reglas, así que ya no hay fecha forzando la Fase 6 — lo que la justifica ahora es la exposición permanente descrita arriba; (b) su tarea **0.1** (verificar el mismatch de mayúsculas) está cerrada: no había mismatch. Su tarea **0.2** (quitar el `throw` de depuración) sigue abierta y es más grande de lo que el plan supone — ver [Bugs pendientes](#bugs-pendientes).

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
| `estimationService.js` | En cada `addDoc`/`setDoc`: inyectar `empresaId` (y opcionalmente `empresaNombre`) al `dbPayload`. En cada query (`checkFirebaseDuplicate`): agregar `where('empresaId', '==', empresaId)`. **Ojo:** hoy este archivo no tiene ningún `addDoc` operativo — ver [Bugs pendientes](#bugs-pendientes). |
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
| S13 | Quitar fecha de expiración de `firestore.rules` y reactivar Firestore | ✅ Implementado y publicado 2026-11-07. Verificado con lectura real contra la API (HTTP 200). Ver [Incidente de reglas vencidas](#incidente-reglas-2026-11-07) |
| S14 | Restaurar el `addDoc` perdido en `requestCreateEstimation` | ⏳ **Pendiente — bloquea la creación de estimaciones nuevas.** Ver [Bugs pendientes](#bugs-pendientes) |

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

<a id="bugs-pendientes"></a>
## Bugs detectados — pendientes de corregir

| Bug | Archivo | Causa raíz | Impacto |
|---|---|---|---|
| **No existe ningún `addDoc` operativo: no se pueden crear estimaciones nuevas** | `estimationService.js` | `addDoc` se importa en la línea 1 pero **no se llama en ninguna parte del archivo**. Las únicas escrituras reales son dos `updateDoc` (líneas ~199 y ~305). En la rama header-only de `requestCreateEstimation` quedó un `throw new Error(JSON.stringify(finalDbPayload))` de depuración (líneas ~104-106) justo donde debería ir el `addDoc`; el `catch` lo atrapa y devuelve `success: false`. La otra rama hace `updateDoc(doc(db,'estimaciones', draft.estimationId))`, que depende de que el encabezado ya exista | **Bloqueante.** Leer y actualizar estimaciones existentes funciona; crear nuevas, no. Verificado 2026-11-07, independiente del arreglo de reglas. Al restaurarlo, revisar de dónde sale `draft.estimationId` en la segunda rama y mapear el camino offline (`syncRegistro()`) antes de tocar nada |
| Doble grafía de campos en los documentos (`Cosecha` y `cosecha` conviviendo), con algunos pares cruzados de tipo | Documentos en Firestore | El encabezado se crea con mayúsculas y `updateDoc` agrega después las minúsculas; al fusionar quedan los dos juegos | No rompe nada hoy porque la normalización con `??` lo absorbe, pero duplica almacenamiento y es una trampa para código nuevo. Backfill de limpieza pendiente, no decidido. Ver [doble grafía](#doble-grafia-campos) |
| Exposición permanente de `estimaciones` (lectura y escritura sin autenticación) | `firestore.rules` + `authService.js` | No hay Firebase Auth, así que `request.auth` es `null` y las reglas solo validan forma | Antes la fecha de expiración actuaba como cierre forzado; ahora no hay ninguno. Se cierra con la Fase 6 del plan multiempresa |

> ❌ **Ya NO es un bug:** el supuesto "mismatch de mayúsculas entre el payload y las reglas". Se verificó el 2026-11-07 contra un documento real y las escrituras sí pasaban la validación. Ver [Incidente de reglas vencidas](#incidente-reglas-2026-11-07).

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
23. **`firestore.rules` ya NO tiene fecha de expiración** (se quitó el 2026-11-07 tras 68 días de app caída). **Nunca volver a poner una fecha de expiración sin crear además un recordatorio de calendario** — este CODEX no alcanzó para detectarlo. Ver [Incidente de reglas vencidas](#incidente-reglas-2026-11-07)
24. **Los documentos de `estimaciones` tienen los campos duplicados en mayúscula y minúscula.** Las reglas validan los de **mayúscula** (`Cosecha`, `Tipo`, `Lote`, `Parcela`) y eso es correcto: el encabezado se crea con mayúsculas. **No cambiar las reglas a minúscula** — rompería la creación de encabezados. Ver [doble grafía](#doble-grafia-campos)
25. **Al cambiar `firestore.rules`, el archivo del repo no hace nada por sí solo.** Firestore solo obedece lo publicado en el servidor: publicar en la consola de Firebase o `firebase deploy --only firestore:rules` desde `C:\proyectos\estfruta` (`.firebaserc` ya apunta al proyecto `estfruta`). Después, verificar con una lectura real contra la API, no asumir. Y antes de un `firebase deploy`, leer el archivo de vuelta desde el disco para confirmar que contiene lo que creés — una escritura puede reportar éxito sin aplicarse (ver [Copia única del proyecto](#copia-unica))
26. **Dos motores de cálculo independientes:** `estimationBusinessRules.js` (conteo de frutas, al guardar) y `estfrutaAnalysisService.js` (proyección de cajas/ha, al consultar). No son redundantes pero tampoco están sincronizados
27. **El flujo de Patrón A (análisis por sección/GF/parcela) recalcula desde `detalle` crudo**; el Patrón B (consulta y datos guardados) lee campos ya guardados sin recalcular. Ambos coexisten
28. **El motor de proyección de cajas está unificado en `proyectarCajas()`** (`estfrutaAnalysisService.js`), S11. `totalCajas` (round-final) es el único KPI válido para "Cajas Exp" y el color de Cajas/Ha; `cajasRedondeadasPorTamano` es solo cosmético para la tabla T5–T12. Si se agrega una pantalla nueva que necesite esta proyección, **llamar a `proyectarCajas()`, no reimplementar la fórmula**
29. **El total de cajas/ha de un lote nunca es igual a sumar las filas de parcela** — es intencional, no un bug. No "corregirlo" para que la suma cuadre; la UI ya tiene `.agl-resumen-nota` aclarándolo
30. **Hay una sola copia local del proyecto: `C:\proyectos\estfruta`** (con git), y este CODEX vive dentro de ella. La copia de OneDrive se abandonó el 2026-11-07 — ver [Copia única del proyecto](#copia-unica). Tras editar este documento o el plan, volver a subirlo al project knowledge de Claude

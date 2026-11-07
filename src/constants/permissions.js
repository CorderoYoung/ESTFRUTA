/**
 * permissions.js
 * Configuración centralizada de permisos por rol y pantalla.
 *
 * ROLES DEFINIDOS:
 *   - Administrador
 *   - Supervisor Estimacion
 *   - Supervisor Cosecha
 *   - Logistica
 *   - Gerente General
 *   - Gerente Produccion
 *   - Muestreador  (peón de campo; toma la muestra física en parcela)
 *
 * NIVELES DE ACCESO:
 *   "NINGUNO"          → Sin acceso a la pantalla.
 *   "CONSULTA"         → Solo lectura (ver información).
 *   "CONSULTA_EDICION" → Lectura y modificación de registros.
 *
 * PERMISOS FUTUROS (preparados, no implementados todavía):
 *   puedeCrearUsuarios    → Crear nuevos usuarios en el sistema.
 *   puedeEliminarUsuarios → Eliminar usuarios existentes.
 *   puedeCambiarRoles     → Asignar o cambiar roles a usuarios.
 */

// ─────────────────────────────────────────────
// 1. Constantes de nivel de acceso
// ─────────────────────────────────────────────

export const NIVEL_ACCESO = Object.freeze({
  NINGUNO: "NINGUNO",
  CONSULTA: "CONSULTA",
  CONSULTA_EDICION: "CONSULTA_EDICION",
});

// ─────────────────────────────────────────────
// 2. Constantes de roles
//    ⚠️  Estos valores DEBEN coincidir exactamente con src/constants/roles.js
//    Son los strings que se almacenan en user.Rol y que compara ProtectedRoute.
// ─────────────────────────────────────────────

export const ROLES = Object.freeze({
  ADMINISTRADOR:         "Administrador",
  SUPERVISOR_ESTIMACION: "Supervisor Estimacion",
  SUPERVISOR_COSECHA:    "Supervisor Cosecha",
  LOGISTICA:             "Logistica",
  GERENTE_GENERAL:       "Gerente General",
  GERENTE_PRODUCCION:    "Gerente Produccion",
  MUESTREADOR:           "Muestreador",
});

// ─────────────────────────────────────────────
// 3. Pantallas registradas
// ─────────────────────────────────────────────

export const PANTALLAS = Object.freeze({
  CONSULTA_EST_FRUTA:       "PantallaConsultaEstFruta",
  ESTIMACION_SAMPLING_EDIT: "EstimacionSamplingEditPage",
  ESTIMATION_HEADER:        "EstimationHeaderPage",
  ESTIMACION_SAMPLING_TF:   "EstimacionSamplingPageTF",
  ANALISIS_GF_LOTE:         "PantallaAnalisisGF_Lote",
  ANALISIS_PARCELA_DETALLE: "PantallaAnalisisParcelaDetalle",
  DATOS_GUARDADOS_CELULAR:  "PantallaDatosGuardadosCelular",
  ESTIMACION_POR_GF:        "PantallaEstimacionPorGF",
  ESTIMACION_POR_SECCION:   "PantallaEstimacionPorSeccion",

  // FASE FUTURA — pantalla de administración de usuarios:
  // ADMIN_USUARIOS: "PantallaAdminUsuarios",
});

// ─────────────────────────────────────────────
// 4. Matriz de permisos por rol
//    Estructura: PERMISOS_ROL[rol][pantalla] = NIVEL_ACCESO
//
//  Reglas aplicadas (v2):
//  ┌──────────────────────────────┬──────┬──────┬──────┬──────┬──────┬──────┬──────┐
//  │ Pantalla                     │ ADM  │ SE   │ MUES │ SC   │ LOG  │ GG   │ GP   │
//  ├──────────────────────────────┼──────┼──────┼──────┼──────┼──────┼──────┼──────┤
//  │ PantallaConsultaEstFruta     │ C/E  │ C/E  │ C/E  │ C/E  │ C/E  │ C/E  │ C/E  │
//  │ EstimacionSamplingEditPage   │ C/E  │ C/E  │ C    │ C    │ C    │ C    │ C    │
//  │ EstimationHeaderPage         │ C    │ C    │ C/E  │ C    │ C    │ C    │ C    │
//  │ EstimacionSamplingPageTF     │ C/E  │ C/E  │ C/E  │ C    │ C    │ C    │ C    │
//  │ PantallaAnalisisGF_Lote      │ C    │ C    │ NING │ C    │ C    │ C    │ C    │
//  │ PantallaAnalisisParcelaDetalle│ C   │ C    │ NING │ C    │ C    │ C    │ C    │
//  │ PantallaDatosGuardadosCelular│ C/E  │ C/E  │ C/E  │ C    │ C    │ C    │ C    │
//  │ PantallaEstimacionPorGF      │ C    │ C    │ NING │ C    │ C    │ C    │ C    │
//  │ PantallaEstimacionPorSeccion │ C    │ C    │ NING │ C    │ C    │ C    │ C    │
//  └──────────────────────────────┴──────┴──────┴──────┴──────┴──────┴──────┴──────┘
// ─────────────────────────────────────────────

const { NINGUNO, CONSULTA, CONSULTA_EDICION } = NIVEL_ACCESO;
const {
  ADMINISTRADOR,
  SUPERVISOR_ESTIMACION,
  SUPERVISOR_COSECHA,
  LOGISTICA,
  GERENTE_GENERAL,
  GERENTE_PRODUCCION,
  MUESTREADOR,
} = ROLES;
const {
  CONSULTA_EST_FRUTA,
  ESTIMACION_SAMPLING_EDIT,
  ESTIMATION_HEADER,
  ESTIMACION_SAMPLING_TF,
  ANALISIS_GF_LOTE,
  ANALISIS_PARCELA_DETALLE,
  DATOS_GUARDADOS_CELULAR,
  ESTIMACION_POR_GF,
  ESTIMACION_POR_SECCION,
} = PANTALLAS;

export const PERMISOS_ROL = Object.freeze({
  [ADMINISTRADOR]: {
    [CONSULTA_EST_FRUTA]:       CONSULTA_EDICION,
    [ESTIMACION_SAMPLING_EDIT]: CONSULTA_EDICION,
    [ESTIMATION_HEADER]:        CONSULTA,
    [ESTIMACION_SAMPLING_TF]:   CONSULTA_EDICION,
    [ANALISIS_GF_LOTE]:         CONSULTA,
    [ANALISIS_PARCELA_DETALLE]: CONSULTA,
    [DATOS_GUARDADOS_CELULAR]:  CONSULTA_EDICION,
    [ESTIMACION_POR_GF]:        CONSULTA,
    [ESTIMACION_POR_SECCION]:   CONSULTA,
  },

  [SUPERVISOR_ESTIMACION]: {
    [CONSULTA_EST_FRUTA]:       CONSULTA_EDICION,
    [ESTIMACION_SAMPLING_EDIT]: CONSULTA_EDICION,
    [ESTIMATION_HEADER]:        CONSULTA,
    [ESTIMACION_SAMPLING_TF]:   CONSULTA_EDICION,
    [ANALISIS_GF_LOTE]:         CONSULTA,
    [ANALISIS_PARCELA_DETALLE]: CONSULTA,
    [DATOS_GUARDADOS_CELULAR]:  CONSULTA_EDICION,
    [ESTIMACION_POR_GF]:        CONSULTA,
    [ESTIMACION_POR_SECCION]:   CONSULTA,
  },

  // Peón de campo: toma la muestra física en la parcela.
  // Tiene edición en las pantallas de captura (Header, SamplingTF, Locales)
  // y consulta/edición en la pantalla principal.
  // No accede a pantallas de análisis.
  [MUESTREADOR]: {
    [CONSULTA_EST_FRUTA]:       CONSULTA_EDICION,
    [ESTIMACION_SAMPLING_EDIT]: CONSULTA,
    [ESTIMATION_HEADER]:        CONSULTA_EDICION,
    [ESTIMACION_SAMPLING_TF]:   CONSULTA_EDICION,
    [ANALISIS_GF_LOTE]:         NINGUNO,
    [ANALISIS_PARCELA_DETALLE]: NINGUNO,
    [DATOS_GUARDADOS_CELULAR]:  CONSULTA_EDICION,
    [ESTIMACION_POR_GF]:        NINGUNO,
    [ESTIMACION_POR_SECCION]:   NINGUNO,
  },

  [SUPERVISOR_COSECHA]: {
    [CONSULTA_EST_FRUTA]:       CONSULTA_EDICION,
    [ESTIMACION_SAMPLING_EDIT]: CONSULTA,
    [ESTIMATION_HEADER]:        CONSULTA,
    [ESTIMACION_SAMPLING_TF]:   CONSULTA,
    [ANALISIS_GF_LOTE]:         CONSULTA,
    [ANALISIS_PARCELA_DETALLE]: CONSULTA,
    [DATOS_GUARDADOS_CELULAR]:  CONSULTA,
    [ESTIMACION_POR_GF]:        CONSULTA,
    [ESTIMACION_POR_SECCION]:   CONSULTA,
  },

  [LOGISTICA]: {
    [CONSULTA_EST_FRUTA]:       CONSULTA_EDICION,
    [ESTIMACION_SAMPLING_EDIT]: CONSULTA,
    [ESTIMATION_HEADER]:        CONSULTA,
    [ESTIMACION_SAMPLING_TF]:   CONSULTA,
    [ANALISIS_GF_LOTE]:         CONSULTA,
    [ANALISIS_PARCELA_DETALLE]: CONSULTA,
    [DATOS_GUARDADOS_CELULAR]:  CONSULTA,
    [ESTIMACION_POR_GF]:        CONSULTA,
    [ESTIMACION_POR_SECCION]:   CONSULTA,
  },

  [GERENTE_GENERAL]: {
    [CONSULTA_EST_FRUTA]:       CONSULTA_EDICION,
    [ESTIMACION_SAMPLING_EDIT]: CONSULTA,
    [ESTIMATION_HEADER]:        CONSULTA,
    [ESTIMACION_SAMPLING_TF]:   CONSULTA,
    [ANALISIS_GF_LOTE]:         CONSULTA,
    [ANALISIS_PARCELA_DETALLE]: CONSULTA,
    [DATOS_GUARDADOS_CELULAR]:  CONSULTA,
    [ESTIMACION_POR_GF]:        CONSULTA,
    [ESTIMACION_POR_SECCION]:   CONSULTA,
  },

  [GERENTE_PRODUCCION]: {
    [CONSULTA_EST_FRUTA]:       CONSULTA_EDICION,
    [ESTIMACION_SAMPLING_EDIT]: CONSULTA,
    [ESTIMATION_HEADER]:        CONSULTA,
    [ESTIMACION_SAMPLING_TF]:   CONSULTA,
    [ANALISIS_GF_LOTE]:         CONSULTA,
    [ANALISIS_PARCELA_DETALLE]: CONSULTA,
    [DATOS_GUARDADOS_CELULAR]:  CONSULTA,
    [ESTIMACION_POR_GF]:        CONSULTA,
    [ESTIMACION_POR_SECCION]:   CONSULTA,
  },
});

// ─────────────────────────────────────────────
// 5. Permisos especiales de administración de usuarios
//    Solo el rol Administrador los tendrá cuando se implemente esa fase.
//    Por ahora se definen pero NO se exponen en ninguna pantalla.
// ─────────────────────────────────────────────

export const PERMISOS_ADMIN_USUARIOS = Object.freeze({
  puedeCrearUsuarios: false,       // TODO: true para Administrador
  puedeEliminarUsuarios: false,    // TODO: true para Administrador
  puedeCambiarRoles: false,        // TODO: true para Administrador
});

// ─────────────────────────────────────────────
// 6. Helpers de consulta
// ─────────────────────────────────────────────

/**
 * Devuelve el nivel de acceso de un rol sobre una pantalla.
 * Si el rol o la pantalla no existen en la matriz, retorna NINGUNO.
 *
 * @param {string} rol      - Valor de ROLES
 * @param {string} pantalla - Valor de PANTALLAS
 * @returns {string} NIVEL_ACCESO
 */
export function getNivelAcceso(rol, pantalla) {
  return PERMISOS_ROL[rol]?.[pantalla] ?? NINGUNO;
}

/**
 * Verifica si un rol tiene al menos acceso de consulta a una pantalla.
 *
 * @param {string} rol
 * @param {string} pantalla
 * @returns {boolean}
 */
export function puedeConsultar(rol, pantalla) {
  const nivel = getNivelAcceso(rol, pantalla);
  return nivel === CONSULTA || nivel === CONSULTA_EDICION;
}

/**
 * Verifica si un rol puede editar registros en una pantalla.
 *
 * @param {string} rol
 * @param {string} pantalla
 * @returns {boolean}
 */
export function puedeEditar(rol, pantalla) {
  return getNivelAcceso(rol, pantalla) === CONSULTA_EDICION;
}

/**
 * Verifica si el rol es Administrador.
 * Útil para proteger rutas o secciones exclusivas.
 *
 * @param {string} rol
 * @returns {boolean}
 */
export function esAdministrador(rol) {
  return rol === ADMINISTRADOR;
}
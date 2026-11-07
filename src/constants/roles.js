// src/constants/roles.js
// Fuente de verdad de todos los roles del sistema.
// Los valores string son los que se almacenan en user.Rol (authService, Firebase, localStorage).
// permissions.js DEBE usar exactamente estos mismos valores.

export const ROLES = Object.freeze({
  ADMINISTRADOR:         'Administrador',
  SUPERVISOR_ESTIMACION: 'Supervisor Estimacion',
  SUPERVISOR_COSECHA:    'Supervisor Cosecha',
  LOGISTICA:             'Logistica',
  GERENTE_GENERAL:       'Gerente General',
  GERENTE_PRODUCCION:    'Gerente Produccion',
  // Peón de campo que toma la muestra física en la parcela.
  // Uno canta la muestra desde adentro; otro digita en el celular desde la orilla.
  // Rol independiente — NO es Supervisor Estimacion.
  MUESTREADOR:           'Muestreador',
});

export const ROLE_OPTIONS = Object.freeze(Object.values(ROLES));

export const ROLE_ROUTES = Object.freeze({
  [ROLES.ADMINISTRADOR]:         '/estimaciones',
  [ROLES.SUPERVISOR_ESTIMACION]: '/estimaciones',
  [ROLES.SUPERVISOR_COSECHA]:    '/estimaciones',
  [ROLES.LOGISTICA]:             '/estimaciones',
  [ROLES.GERENTE_GENERAL]:       '/estimaciones',
  [ROLES.GERENTE_PRODUCCION]:    '/estimaciones',
  [ROLES.MUESTREADOR]:           '/estimaciones',
});
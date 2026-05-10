export const ROLES = Object.freeze({
  ADMINISTRADOR: 'Administrador',
  SUPERVISOR: 'Supervisor',
  GERENTE: 'Gerente',
  MUESTREADOR: 'Muestreador',
});

export const ROLE_OPTIONS = Object.freeze(Object.values(ROLES));

export const ROLE_ROUTES = Object.freeze({
  [ROLES.ADMINISTRADOR]: '/admin',
  [ROLES.SUPERVISOR]: '/supervisor',
  [ROLES.GERENTE]: '/gerencia',
  [ROLES.MUESTREADOR]: '/muestreo',
});

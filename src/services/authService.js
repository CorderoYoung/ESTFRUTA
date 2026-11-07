// src/services/authService.js
// Fuente de usuarios del sistema.
// El campo "Usuario" es el nombre visible en el selector del login.
// El campo "Rol" debe coincidir exactamente con los valores de src/constants/roles.js.

import { ROLES, ROLE_ROUTES } from '../constants/roles';

export const USERS = Object.freeze([
  {
    Usuario: 'Administrador',
    Clave:   '123',
    Rol:     ROLES.ADMINISTRADOR,           // 'Administrador'
  },
  {
    // Peón de campo: toma la muestra física en la parcela (canta o digita en el celular).
    // Rol independiente — NO es Supervisor Estimacion.
    Usuario: 'Muestreador',
    Clave:   '123',
    Rol:     ROLES.MUESTREADOR,             // 'Muestreador'
  },
  {
    Usuario: 'Supervisor Cosecha',
    Clave:   '123',
    Rol:     ROLES.SUPERVISOR_COSECHA,      // 'Supervisor Cosecha'
  },
  {
    Usuario: 'Supervisor Estimacion',
    Clave:   '123',
    Rol:     ROLES.SUPERVISOR_ESTIMACION,   // 'Supervisor Estimacion'
  },
  {
    Usuario: 'Logistica',
    Clave:   '123',
    Rol:     ROLES.LOGISTICA,              // 'Logistica'
  },
  {
    Usuario: 'Gerente General',
    Clave:   '123',
    Rol:     ROLES.GERENTE_GENERAL,        // 'Gerente General'
  },
  {
    Usuario: 'Gerente Produccion',
    Clave:   '123',
    Rol:     ROLES.GERENTE_PRODUCCION,     // 'Gerente Produccion'
  },
]);

// Usuarios eliminados:  'Admin', 'Supervisor', 'Gerente' (nombres viejos genéricos)

/**
 * Valida credenciales contra la lista local de usuarios.
 * Devuelve el objeto de usuario si coincide, o null si no.
 *
 * @param {string} usuario
 * @param {string} clave
 * @returns {{ Usuario: string, Rol: string } | null}
 */
export function validateCredentials(usuario, clave) {
  if (!usuario || !clave) return null;
  const found = USERS.find(
    (u) => u.Usuario === usuario && u.Clave === clave
  );
  return found ?? null;
}

// ─────────────────────────────────────────────
// Compatibilidad con AppTomaFisica.js
// ─────────────────────────────────────────────

/**
 * Devuelve la lista de usuarios activos para poblar el selector del login.
 * AppTomaFisica.js hace `const list = await getActiveUsers(); setUsers(list);`
 * y LoginScreen itera `users.map(user => user.Usuario)`, por lo que debe
 * resolver al arreglo de usuarios tal cual (no envuelto en {success, ...}).
 *
 * @returns {Promise<Array<{Usuario: string, Clave: string, Rol: string}>>}
 */
export async function getActiveUsers() {
  return USERS;
}

/**
 * Autentica credenciales y devuelve el formato exacto que consume AppTomaFisica.js:
 *   Éxito:  { success: true,  user, redirectPath }
 *   Error:  { success: false, error }
 *
 * AppTomaFisica.js llama: authenticateUser(credentials) con credentials = { usuario, clave }
 * y en caso de error lee result.error (no result.message).
 * En caso de éxito usa result.user y navega con result.redirectPath.
 *
 * @param {{ usuario: string, clave: string }} credentials
 * @returns {Promise<{success: true, user: object, redirectPath: string} | {success: false, error: string}>}
 */
export async function authenticateUser(credentials) {
  const { usuario, clave } = credentials || {};
  const user = validateCredentials(usuario, clave);

  if (!user) {
    return {
      success: false,
      error: 'Usuario o clave incorrecta',
    };
  }

  return {
    success: true,
    user,
    redirectPath: ROLE_ROUTES[user.Rol] ?? '/login',
  };
}
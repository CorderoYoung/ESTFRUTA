import { ROLE_ROUTES } from '../constants/roles';
import { mockJsonAuthProvider } from './providers/mockJsonAuthProvider';
import { sqlAuthProvider } from './providers/sqlAuthProvider';

const configuredProvider = process.env.REACT_APP_AUTH_PROVIDER;
const useSqlProvider = configuredProvider === 'sql';
let provider = useSqlProvider ? sqlAuthProvider : mockJsonAuthProvider;

function normalizeUser(user) {
  return {
    Usuario: String(user?.Usuario ?? '').trim(),
    Clave: String(user?.Clave ?? '').trim(),
    Rol: String(user?.Rol ?? '').trim(),
    Activo: Boolean(user?.Activo),
  };
}

function isRoleMapped(user) {
  return Boolean(ROLE_ROUTES[user.Rol]);
}

export function setAuthProvider(nextProvider) {
  if (nextProvider?.getUsers) {
    provider = nextProvider;
  }
}

export async function getUsers() {
  const users = await provider.getUsers();
  return users
    .map(normalizeUser)
    .filter((user) => user.Usuario && user.Clave && user.Rol)
    .filter(isRoleMapped)
    .sort((a, b) => a.Usuario.localeCompare(b.Usuario, 'es'));
}

export async function getActiveUsers() {
  const users = await getUsers();
  return users.filter((user) => user.Activo);
}

export async function authenticateUser({ usuario, clave }) {
  let users = [];
  try {
    users = await getActiveUsers();
  } catch (error) {
    return {
      success: false,
      error: 'Error de conexion con proveedor de usuarios.',
    };
  }
  const normalizedUsuario = String(usuario ?? '').trim().toLowerCase();
  const normalizedClave = String(clave ?? '');

  const user = users.find((item) => {
    const sameUsuario = item.Usuario.toLowerCase() === normalizedUsuario;
    const sameClave = item.Clave === normalizedClave;
    return sameUsuario && sameClave;
  });

  if (!user) {
    return { success: false, error: 'Credenciales invalidas o usuario inactivo.' };
  }

  return {
    success: true,
    user,
    redirectPath: ROLE_ROUTES[user.Rol] ?? '/sin-rol',
  };
}

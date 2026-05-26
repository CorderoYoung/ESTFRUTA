import { ROLES } from '../constants/roles';

const USERS = [
  {
    Usuario: 'Admin',
    Clave: '123',
    Rol: ROLES.ADMINISTRADOR,
  },
  {
    Usuario: 'Supervisor',
    Clave: '123',
    Rol: ROLES.SUPERVISOR,
  },
  {
    Usuario: 'Gerente',
    Clave: '123',
    Rol: ROLES.GERENTE,
  },
  {
    Usuario: 'Muestreador',
    Clave: '123',
    Rol: ROLES.MUESTREADOR,
  },
];

export async function getActiveUsers() {
  return USERS;
}

export async function authenticateUser(credentials) {
  const user = USERS.find(
    (item) =>
      item.Usuario === credentials.usuario &&
      item.Clave === credentials.clave
  );

  if (!user) {
    return {
      success: false,
      message: 'Usuario o clave incorrecta',
    };
  }

  return {
    success: true,
    user,
  };
}
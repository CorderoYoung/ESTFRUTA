const API_BASE_URL = process.env.REACT_APP_AUTH_API_URL || 'http://localhost:4000';

export const sqlAuthProvider = {
  async getUsers() {
    const response = await fetch(`${API_BASE_URL}/api/auth/users`);
    if (!response.ok) {
      throw new Error('No se pudo cargar usuarios desde SQL Server.');
    }

    const data = await response.json();
    return Array.isArray(data) ? data : [];
  },
};

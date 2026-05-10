export const mockJsonAuthProvider = {
  async getUsers() {
    const response = await fetch('/mock/users.json', { cache: 'no-store' });
    if (!response.ok) {
      throw new Error('No se pudo cargar mock/users.json');
    }

    const payload = await response.json();
    return Array.isArray(payload) ? payload : [];
  },
};

const STORAGE_KEY = 'estimaciones_locales';

function genId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

let listeners = [];

function notifyAll() {
  const current = obtenerRegistrosLocales();
  listeners.forEach((cb) => {
    try {
      cb(current);
    } catch (e) {
      // ignore listener errors
    }
  });
}

export const subscribe = (cb) => {
  listeners.push(cb);
  return () => {
    listeners = listeners.filter((x) => x !== cb);
  };
};

export const guardarLocalmente = (registro) => {
  try {
    const registros = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];

    const uniqueKey = registro.uniqueKey || registro.uniqueId || null;

    // VALIDAR DUPLICADO por uniqueKey o por id
    const existe = uniqueKey
      ? registros.find((r) => r.uniqueKey === uniqueKey)
      : registros.find((r) => r.id === registro.id);

    if (existe) {
      alert('Ya existe este registro');
      return false;
    }

    const id = registro.id || genId();

    const item = {
      id,
      ...registro,
      uniqueKey: uniqueKey || registro.uniqueKey || null,
      estadoSync: registro.estadoSync || 'PENDIENTE_SYNC',
      fechaLocal: registro.fechaLocal || new Date().toISOString(),
    };

    registros.push(item);

    localStorage.setItem(STORAGE_KEY, JSON.stringify(registros));
    notifyAll();
    return true;
  } catch (error) {
    console.error('Error guardando localmente:', error);
    return false;
  }
};

export const obtenerRegistrosLocales = () => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch (error) {
    console.error(error);
    return [];
  }
};

export const eliminarRegistroLocalById = (id) => {
  try {
    const registros = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    const nuevos = registros.filter((r) => r.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(nuevos));
    notifyAll();
  } catch (e) {
    console.error(e);
  }
};

export const updateRegistroLocal = (id, patch) => {
  try {
    const registros = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    let changed = false;
    const nuevos = registros.map((r) => {
      if (r.id === id) {
        changed = true;
        return { ...r, ...patch };
      }
      return r;
    });
    if (changed) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nuevos));
      notifyAll();
    }
    return changed;
  } catch (e) {
    console.error(e);
    return false;
  }
};

export const clearAllLocal = () => {
  try {
    localStorage.removeItem(STORAGE_KEY);
    notifyAll();
  } catch (e) {
    // ignore
  }
};
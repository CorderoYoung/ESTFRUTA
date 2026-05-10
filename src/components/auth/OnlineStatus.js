function OnlineStatus({ isOnline }) {
  return (
    <div className="status-row" aria-label="Estado de conexion">
      <span
        className={`online-indicator ${isOnline ? 'online' : 'offline'}`}
        aria-hidden="true"
      />
      <span className="status-text">{isOnline ? 'En linea' : 'Sin conexion'}</span>
    </div>
  );
}

export default OnlineStatus;

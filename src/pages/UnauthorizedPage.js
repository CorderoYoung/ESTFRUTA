function UnauthorizedPage({ onBackToLogin }) {
  return (
    <div className="login-page">
      <main className="login-card">
        <header className="login-header">
          <h1 className="login-title">ESTIMACION FRUTA</h1>
        </header>
        <section className="login-content">
          <h2 className="welcome-title">403 - Acceso no autorizado</h2>
          <p className="welcome-text">
            No tiene permisos para acceder a este modulo.
          </p>
          <button
            className="validate-button"
            type="button"
            onClick={onBackToLogin}
          >
            Volver al inicio de sesion
          </button>
        </section>
      </main>
    </div>
  );
}

export default UnauthorizedPage;


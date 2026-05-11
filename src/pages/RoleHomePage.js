import { Link, useNavigate } from 'react-router-dom';

function RoleHomePage({ user, onLogout }) {
  const navigate = useNavigate();

  return (
    <div className="login-page">
      <main className="login-card">
        <header className="login-header">
          <h1 className="login-title">ESTIMACION FRUTA</h1>
        </header>

        <section className="login-content">
          <h2 className="welcome-title">Modulo 1 - Autenticacion</h2>

          <p className="welcome-text">
            Usuario: <strong>{user.Usuario}</strong>
          </p>

          <p className="welcome-text">
            Rol: <strong>{user.Rol}</strong>
          </p>

          <Link
            className="validate-button link-as-button"
            to="/estimaciones/nueva"
          >
            Nueva estimacion (cabecera + muestreo)
          </Link>

          <button
            className="validate-button"
            type="button"
            onClick={() => navigate('/estimaciones/editar/1')}
          >
            Ir a Consulta / Edición
          </button>

          <button
            className="validate-button"
            type="button"
            onClick={onLogout}
          >
            Salir
          </button>
        </section>
      </main>
    </div>
  );
}

export default RoleHomePage;
import ExitButton from './ExitButton';
import OnlineStatus from './OnlineStatus';

function LoginScreen({
  users,
  form,
  isOnline,
  isLoading,
  error,
  onChange,
  onValidate,
  onExit,
}) {
  return (
    <div className="login-page">
      <main className="login-card">
        <header className="login-header">
          <h1 className="login-title">ESTFRUTA</h1>
        </header>

        <section className="login-content">
          <OnlineStatus isOnline={isOnline} />

          <label className="field-label" htmlFor="usuario">
            Usuario
          </label>
          <select
            id="usuario"
            name="usuario"
            className="field-input"
            value={form.usuario}
            onChange={onChange}
          >
            <option value="" disabled>
              Seleccione usuario
            </option>
            {users.map((user) => (
              <option key={user.Usuario} value={user.Usuario}>
                {user.Usuario}
              </option>
            ))}
          </select>

          <label className="field-label" htmlFor="clave">
            Clave
          </label>
          <input
            id="clave"
            name="clave"
            className="field-input"
            type="password"
            placeholder="Ingrese su clave"
            value={form.clave}
            onChange={onChange}
          />

          {error ? <p className="error-text">{error}</p> : null}

          <button
            className="validate-button"
            type="button"
            onClick={onValidate}
            disabled={isLoading || !isOnline}
          >
            {isLoading ? 'Validando...' : 'Validar'}
          </button>

          <ExitButton onClick={onExit} />
        </section>
      </main>
    </div>
  );
}

export default LoginScreen;

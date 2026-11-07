import { useEffect, useState } from 'react';
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from 'react-router-dom';
import './App.css';
import { ROLE_OPTIONS, ROLE_ROUTES } from './constants/roles';
import LoginScreen from './components/auth/LoginScreen';
import EstimationHeaderPage from './pages/EstimationHeaderPage';
import EstimationSamplingPageTF from './pages/EstimationSamplingPageTF';
import EstimationSamplingEditPage from './pages/EstimationSamplingEditPage';
import PantallaConsultaEstFruta from './pages/PantallaConsultaEstFruta';
import PantallaDatosGuardadosCelular from './pages/PantallaDatosGuardadosCelular';
import PantallaEstimacionPorSeccion from './pages/PantallaEstimacionPorSeccion';
import PantallaEstimacionPorGF from './pages/PantallaEstimacionPorGF';
import PantallaAnalisisGF_Lote from './pages/PantallaAnalisisGF_Lote';
import PantallaAnalisisParcelaDetalle from './pages/PantallaAnalisisParcelaDetalle';
import RoleHomePage from './pages/RoleHomePage';
import ProtectedRoute from './routes/ProtectedRoute';
import { authenticateUser, getActiveUsers } from './services/authService';
 
const SESSION_KEY = 'estfruta_session_user';
 
function AuthApp() {
  const navigate = useNavigate();
  const location = useLocation();
  const [credentials, setCredentials] = useState({
    usuario: '',
    clave: '',
  });
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const stored = window.localStorage.getItem(SESSION_KEY);
      if (!stored) return null;
      const parsed = JSON.parse(stored);
      return parsed?.Usuario && parsed?.Rol ? parsed : null;
    } catch {
      return null;
    }
  });
  const [isOnline, setIsOnline] = useState(window.navigator.onLine);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [users, setUsers] = useState([]);
 
  useEffect(() => {
    async function loadActiveUsers() {
      try {
        const list = await getActiveUsers();
        setUsers(list);
      } catch (loadError) {
        setError('No se pudo cargar la tabla de acceso.');
      }
    }
 
    loadActiveUsers();
  }, []);
 
  useEffect(() => {
    function handleOnline() {
      setIsOnline(true);
    }
 
    function handleOffline() {
      setIsOnline(false);
    }
 
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
 
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);
 
  function onInputChange(event) {
    const { name, value } = event.target;
    setCredentials((current) => ({ ...current, [name]: value }));
  }
 
  async function onValidate() {
    if (!isOnline) {
      setError('Sin conexion. Verifique red para validar.');
      return;
    }
 
    setIsLoading(true);
    setError('');
 
    const result = await authenticateUser(credentials);
 
    if (!result.success) {
      setError(result.error);
      setCredentials((current) => ({ ...current, clave: '' }));
      setIsLoading(false);
      return;
    }
 
    setCurrentUser(result.user);
    window.localStorage.setItem(SESSION_KEY, JSON.stringify(result.user));
    setCredentials((current) => ({ ...current, clave: '' }));
    navigate(result.redirectPath, { replace: true });
    setIsLoading(false);
  }
 
  function onExit() {
    window.localStorage.removeItem(SESSION_KEY);
    setCurrentUser(null);
    setCredentials({ usuario: '', clave: '' });
    setError('');
    navigate('/login', { replace: true });
  }
 
  const rolePath = currentUser ? ROLE_ROUTES[currentUser.Rol] : null;
  const shouldGoToRolePath = Boolean(
    currentUser && location.pathname === '/login' && rolePath
  );
 
  return (
  <Routes>
 
    <Route
      path="/login"
      element={
        shouldGoToRolePath ? (
          <Navigate to={rolePath} replace />
        ) : (
          <LoginScreen
            users={users}
            form={credentials}
            isOnline={isOnline}
            isLoading={isLoading}
            error={error}
            onChange={onInputChange}
            onValidate={onValidate}
            onExit={onExit}
          />
        )
      }
    />
 
 
    <Route
      element={
        <ProtectedRoute
          user={currentUser}
          allowedRoles={[...ROLE_OPTIONS]}
        />
      }
    >
      <Route
        path="/estimaciones"
        element={
          <PantallaConsultaEstFruta
            user={currentUser}
            onLogout={onExit}
          />
        }
      />
    </Route>
 
    <Route
      element={
        <ProtectedRoute
          user={currentUser}
          allowedRoles={[...ROLE_OPTIONS]}
        />
      }
    >
 
        <Route
          path="/estimaciones/seccion/:id"
          element={
            <PantallaEstimacionPorSeccion
              user={currentUser}
              onLogout={onExit}
            />
          }
        />
        <Route
          path="/estimaciones/gf"
          element={
            <PantallaEstimacionPorGF
              user={currentUser}
              onLogout={onExit}
            />
          }
        />
        <Route
          path="/estimaciones/analisis"
          element={
            <PantallaAnalisisGF_Lote
              user={currentUser}
              onLogout={onExit}
            />
          }
        />
        <Route
          path="/estimaciones/analisis/parcela/:id"
          element={<PantallaAnalisisParcelaDetalle />}
        />
        <Route
          path="/estimaciones/nueva"
          element={
            <EstimationHeaderPage user={currentUser} onLogout={onExit} />
          }
        />
        <Route
          path="/estimaciones/muestreo"
          element={<EstimationSamplingPageTF />}
        />
        <Route
          path="/estimaciones/editar/:id"
          element={<EstimationSamplingEditPage />}
        />
        <Route
          path="/estimaciones/locales"
          element={<PantallaDatosGuardadosCelular />}
        />
      </Route>
 
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
 
function App() {
  return (
    <BrowserRouter>
      <AuthApp />
    </BrowserRouter>
  );
}
 
export default App;
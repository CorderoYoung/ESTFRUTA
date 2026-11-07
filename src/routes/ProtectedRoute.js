import { Navigate, Outlet, useNavigate } from 'react-router-dom';
import UnauthorizedPage from '../pages/UnauthorizedPage';

const SESSION_KEY = 'estfruta_session_user';

function ProtectedRoute({ user, allowedRoles }) {
  const navigate = useNavigate();

  const resolvedUser = user ?? (() => {
    try {
      const stored = window.localStorage.getItem(SESSION_KEY);
      if (!stored) return null;
      const parsed = JSON.parse(stored);
      return parsed?.Usuario && parsed?.Rol ? parsed : null;
    } catch {
      return null;
    }
  })();

  if (!resolvedUser) {
    return <Navigate to="/login" replace />;
  }

  const userRole = resolvedUser.Rol?.trim();
  const normalizedAllowedRoles = allowedRoles.map((role) => role?.trim());

  if (!normalizedAllowedRoles.includes(userRole)) {
    return (
      <UnauthorizedPage
        onBackToLogin={() => {
          window.localStorage.removeItem(SESSION_KEY);
          navigate('/login', { replace: true });
          window.location.reload();
        }}
      />
    );
  }

  return <Outlet />;
}

export default ProtectedRoute;
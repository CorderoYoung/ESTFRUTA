import { Navigate, Outlet, useNavigate } from 'react-router-dom';
import UnauthorizedPage from '../pages/UnauthorizedPage';

function ProtectedRoute({ user, allowedRoles }) {
  const navigate = useNavigate();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!allowedRoles.includes(user.Rol)) {
    return (
      <UnauthorizedPage
        onBackToLogin={() => {
          navigate('/login', { replace: true });
        }}
      />
    );
  }

  return <Outlet />;
}

export default ProtectedRoute;

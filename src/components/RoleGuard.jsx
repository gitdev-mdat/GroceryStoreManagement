import { Navigate } from 'react-router-dom';

/**
 * RoleGuard component ensures that only users with allowed roles can access a route.
 * @param {Array<string>} roles - Roles allowed to access the route.
 * @param {string} userRole - The current user's role.
 * @param {React.ReactNode} children - The component to render if access is granted.
 * @param {string} [redirectTo='/hoa-don'] - Where to redirect if access is denied.
 */
export default function RoleGuard({ roles, userRole, children, redirectTo = '/hoa-don' }) {
  if (!roles.includes(userRole)) {
    return <Navigate to={redirectTo} replace />;
  }

  return children;
}

import React from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import type { Permission } from './types';
import { useAuth } from './useAuth';
import { backButtonClassName, backButtonLightClassName, BackChevron } from '../components/BackButton';
import { useAdminTheme } from '../admin/AdminThemeContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredPermission?: Permission;
  fallback?: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requiredPermission,
  fallback,
}) => {
  const { isAuthenticated, hasPermission } = useAuth();
  const location = useLocation();
  const { theme } = useAdminTheme();

  if (!isAuthenticated) {
    return <Navigate to="/admin/login" state={{ from: location }} replace />;
  }

  if (requiredPermission && !hasPermission(requiredPermission)) {
    if (fallback) return <>{fallback}</>;
    return (
      <div className="min-h-screen bg-zinc-100 dark:bg-zinc-950 flex items-center justify-center p-6">
        <div className="text-center">
          <h2 className="text-xl font-bold text-zinc-900 dark:text-white mb-2">Access Denied</h2>
          <p className="text-zinc-500">You don&apos;t have permission to view this page.</p>
          <div className="flex justify-center mt-6">
            <Link
              to="/admin"
              aria-label="Back to Dashboard"
              className={theme === 'light' ? backButtonLightClassName : backButtonClassName}
            >
              <BackChevron className={theme === 'light' ? 'text-zinc-900' : undefined} />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

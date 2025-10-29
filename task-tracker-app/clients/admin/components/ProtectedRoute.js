import React, { useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../contexts/AuthContext';
import { CircularProgress, Box } from '@mui/material';

const ProtectedRoute = ({ children, adminOnly = false }) => {
  const { isAuthenticated, user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      // Redirect to login page (external)
      window.location.href = 'http://localhost/login';
      return;
    }

    if (!isLoading && adminOnly && user?.role !== 'admin') {
      // Not an admin, redirect to login
      window.location.href = 'http://localhost/login';
      return;
    }
  }, [isAuthenticated, user, adminOnly, router, isLoading]);

  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh">
        <CircularProgress />
      </Box>
    );
  }

  if (!isAuthenticated || (adminOnly && user?.role !== 'admin')) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh">
        <CircularProgress />
      </Box>
    );
  }

  return children;
};

export default ProtectedRoute;
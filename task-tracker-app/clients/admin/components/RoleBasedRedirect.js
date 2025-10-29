import React, { useEffect } from 'react';
import { useRouter } from 'next/router';
import { CircularProgress, Box } from '@mui/material';
import { useAuth } from '../contexts/AuthContext';

const RoleBasedRedirect = () => {
  const { isAuthenticated, isLoading, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading) {
      if (!isAuthenticated || !user) {
        router.push('/login', undefined, { replace: true });
      } else {
        const targetPath = user.role === 'engineer' ? '/jobs' : '/projects';
        router.push(targetPath, undefined, { replace: true });
      }
    }
  }, [isAuthenticated, isLoading, user, router]);

  // Always show loading while we determine where to redirect
  return (
    <Box
      display="flex"
      justifyContent="center"
      alignItems="center"
      minHeight="100vh"
    >
      <CircularProgress />
    </Box>
  );
};

export default RoleBasedRedirect;
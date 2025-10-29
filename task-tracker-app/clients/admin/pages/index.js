import React, { useEffect } from 'react';
import { useRouter } from 'next/router';
import { CircularProgress, Box } from '@mui/material';

export default function Home() {
  useEffect(() => {
    // Always redirect to external /login page
    window.location.href = 'http://localhost/login';
  }, []);

  return (
    <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh">
      <CircularProgress />
    </Box>
  );
}

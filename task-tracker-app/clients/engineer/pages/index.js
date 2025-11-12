import React, { useEffect } from 'react';
import { useRouter } from 'next/router';
import { CircularProgress, Box, Typography } from '@mui/material';

export default function EngineerJobsTable() {
  const router = useRouter();
  
  useEffect(() => {
    // Redirect to dashboard
    router.replace('/dashboard');
  }, []);

  return (
    <Box 
      sx={{ 
        display: 'flex', 
        flexDirection: 'column',
        alignItems: 'center', 
        justifyContent: 'center', 
        minHeight: '100vh',
        gap: 2
      }}
    >
      <CircularProgress size={60} />
      <Typography variant="h6" color="text.secondary">
        Redirecting to dashboard...
      </Typography>
    </Box>
  );
}

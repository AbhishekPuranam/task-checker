import React from 'react';
import { Box, Typography, Alert, Button } from '@mui/material';
import { MonitorHeart, OpenInNew } from '@mui/icons-material';
import ProtectedRoute from '../components/ProtectedRoute';
import Navbar from '../components/Navbar';

export default function Monitoring() {
  const handleOpenDashboard = () => {
    // Open in new window to avoid iframe/CORS issues
    window.open('http://62.72.56.99:3001', '_blank', 'width=1400,height=900');
  };

  return (
    <ProtectedRoute allowedRoles={['admin']}>
      <Navbar />
      <Box sx={{ p: 3 }}>
        <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
          <MonitorHeart sx={{ fontSize: 40, color: 'primary.main' }} />
          <Typography variant="h4" component="h1">
            System Monitoring
          </Typography>
        </Box>

        <Alert severity="info" sx={{ mb: 3 }}>
          Real-time monitoring dashboard powered by Uptime Kuma. Monitor service health, uptime, and response times.
        </Alert>

        <Box sx={{ textAlign: 'center', my: 5 }}>
          <MonitorHeart sx={{ fontSize: 100, color: 'primary.main', mb: 3 }} />
          <Typography variant="h5" gutterBottom>
            Uptime Kuma Monitoring Dashboard
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 4, maxWidth: 600, mx: 'auto' }}>
            Click below to open the monitoring dashboard in a new window. Track service availability, response times, and system health metrics.
          </Typography>
          <Button
            variant="contained"
            size="large"
            startIcon={<OpenInNew />}
            onClick={handleOpenDashboard}
            sx={{ 
              px: 5,
              py: 2,
              fontSize: '1.1rem'
            }}
          >
            Open Monitoring Dashboard
          </Button>
        </Box>
      </Box>
    </ProtectedRoute>
  );
}

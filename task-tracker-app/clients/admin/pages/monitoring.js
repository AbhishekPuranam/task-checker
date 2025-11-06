import React from 'react';
import { Box, Typography, Paper, Alert, Button } from '@mui/material';
import { MonitorHeart, OpenInNew } from '@mui/icons-material';
import ProtectedRoute from '../components/ProtectedRoute';
import Navbar from '../components/Navbar';

export default function Monitoring() {
  const handleOpenDashboard = () => {
    window.open('https://status.sapcindia.com', '_blank');
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

        <Paper 
          elevation={3} 
          sx={{ 
            p: 4,
            textAlign: 'center',
            borderRadius: 2
          }}
        >
          <MonitorHeart sx={{ fontSize: 80, color: 'primary.main', mb: 2 }} />
          <Typography variant="h5" gutterBottom>
            Uptime Kuma Monitoring Dashboard
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
            Track service availability, response times, and system health metrics
          </Typography>
          <Button
            variant="contained"
            size="large"
            startIcon={<OpenInNew />}
            onClick={handleOpenDashboard}
            sx={{ 
              px: 4,
              py: 1.5,
              fontSize: '1.1rem'
            }}
          >
            Open Monitoring Dashboard
          </Button>
        </Paper>

        <Box sx={{ mt: 3 }}>
          <Typography variant="h6" gutterBottom>
            What You Can Monitor:
          </Typography>
          <Paper sx={{ p: 3 }}>
            <Box component="ul" sx={{ pl: 2 }}>
              <Typography component="li" sx={{ mb: 1 }}>
                <strong>Backend API:</strong> Monitor API response times and availability
              </Typography>
              <Typography component="li" sx={{ mb: 1 }}>
                <strong>Admin Portal:</strong> Track admin interface uptime
              </Typography>
              <Typography component="li" sx={{ mb: 1 }}>
                <strong>Engineer Portal:</strong> Monitor engineer portal availability
              </Typography>
              <Typography component="li" sx={{ mb: 1 }}>
                <strong>Database Services:</strong> Track MongoDB and Redis health
              </Typography>
              <Typography component="li" sx={{ mb: 1 }}>
                <strong>Authentication Service:</strong> Monitor auth service status
              </Typography>
            </Box>
          </Paper>
        </Box>
      </Box>
    </ProtectedRoute>
  );
}

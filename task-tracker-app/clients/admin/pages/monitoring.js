import React from 'react';
import { Box, Typography, Alert } from '@mui/material';
import { MonitorHeart } from '@mui/icons-material';
import ProtectedRoute from '../components/ProtectedRoute';
import Navbar from '../components/Navbar';

export default function Monitoring() {
  return (
    <ProtectedRoute allowedRoles={['admin']}>
      <Navbar />
      <Box sx={{ p: 3, height: 'calc(100vh - 80px)', display: 'flex', flexDirection: 'column' }}>
        <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
          <MonitorHeart sx={{ fontSize: 40, color: 'primary.main' }} />
          <Typography variant="h4" component="h1">
            System Monitoring
          </Typography>
        </Box>

        <Alert severity="info" sx={{ mb: 2 }}>
          Real-time monitoring dashboard powered by Uptime Kuma. Monitor service health, uptime, and response times.
        </Alert>

        <Box 
          sx={{ 
            flexGrow: 1,
            border: '1px solid #e0e0e0',
            borderRadius: 2,
            overflow: 'hidden'
          }}
        >
          <iframe
            src="/uptime-kuma/"
            style={{
              width: '100%',
              height: '100%',
              border: 'none'
            }}
            title="Uptime Kuma Monitoring Dashboard"
          />
        </Box>
      </Box>
    </ProtectedRoute>
  );
}

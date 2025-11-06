import React from 'react';
import { Box, Typography, Paper, Alert } from '@mui/material';
import { MonitorHeart } from '@mui/icons-material';
import ProtectedRoute from '../components/ProtectedRoute';
import Navbar from '../components/Navbar';

export default function Monitoring() {
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
            height: 'calc(100vh - 200px)',
            overflow: 'hidden',
            borderRadius: 2
          }}
        >
          <iframe
            src="/dashboard"
            style={{
              width: '100%',
              height: '100%',
              border: 'none',
            }}
            title="System Monitoring Dashboard"
          />
        </Paper>
      </Box>
    </ProtectedRoute>
  );
}

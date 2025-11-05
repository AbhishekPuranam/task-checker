import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Alert,
  CircularProgress,
  Divider,
  Tabs,
  Tab,
} from '@mui/material';
import {
  Refresh,
  History,
} from '@mui/icons-material';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import BatchProgressCard from './BatchProgressCard';

const UploadSessionHistory = ({ projectId }) => {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tabValue, setTabValue] = useState(0);

  const fetchSessions = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/upload-sessions?project=${projectId}&limit=20`);
      setSessions(response.data.sessions);
    } catch (error) {
      console.error('Error fetching upload sessions:', error);
      toast.error('Failed to load upload history');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (projectId) {
      fetchSessions();
    }
  }, [projectId]);

  // Auto-refresh every 5 seconds if there are in-progress sessions
  useEffect(() => {
    const hasInProgress = sessions.some(s => s.status === 'in_progress');
    if (!hasInProgress) return;

    const interval = setInterval(fetchSessions, 5000);
    return () => clearInterval(interval);
  }, [sessions]);

  const filterSessions = (status) => {
    switch (status) {
      case 'active':
        return sessions.filter(s => s.status === 'in_progress' || s.status === 'partial_success');
      case 'completed':
        return sessions.filter(s => s.status === 'completed');
      case 'failed':
        return sessions.filter(s => s.status === 'failed');
      default:
        return sessions;
    }
  };

  const getTabLabel = (status) => {
    const filtered = filterSessions(status);
    return `${getTabName(status)} (${filtered.length})`;
  };

  const getTabName = (status) => {
    switch (status) {
      case 'active': return 'Active';
      case 'completed': return 'Completed';
      case 'failed': return 'Failed';
      default: return 'All';
    }
  };

  const currentSessions = filterSessions(
    ['all', 'active', 'completed', 'failed'][tabValue]
  );

  if (loading && sessions.length === 0) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (sessions.length === 0) {
    return (
      <Alert severity="info" sx={{ mt: 2 }}>
        No upload history found. Upload an Excel file to see progress here.
      </Alert>
    );
  }

  return (
    <Paper elevation={1} sx={{ p: 2, mt: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <History />
          Upload History
        </Typography>
        <Button
          size="small"
          startIcon={<Refresh />}
          onClick={fetchSessions}
          disabled={loading}
        >
          Refresh
        </Button>
      </Box>

      <Divider sx={{ mb: 2 }} />

      <Tabs
        value={tabValue}
        onChange={(e, newValue) => setTabValue(newValue)}
        sx={{ mb: 2 }}
      >
        <Tab label={getTabLabel('all')} />
        <Tab label={getTabLabel('active')} />
        <Tab label={getTabLabel('completed')} />
        <Tab label={getTabLabel('failed')} />
      </Tabs>

      {currentSessions.length === 0 ? (
        <Alert severity="info">
          No {getTabName(['all', 'active', 'completed', 'failed'][tabValue]).toLowerCase()} uploads found.
        </Alert>
      ) : (
        <Box>
          {currentSessions.map((session) => (
            <BatchProgressCard
              key={session.uploadId}
              uploadSession={session}
              onRefresh={fetchSessions}
            />
          ))}
        </Box>
      )}
    </Paper>
  );
};

export default UploadSessionHistory;

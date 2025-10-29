import React, { useState, useEffect } from 'react';
import {
  Container,
  Paper,
  Typography,
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Grid,
  Card,
  CardContent,
  Tooltip,
  Alert,
  CircularProgress,
} from '@mui/material';
import {
  CheckCircle,
  Cancel,
  Edit,
  Visibility,
  Assignment,
  Build,
  Warning,
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import { useParams } from 'next/router';
import api from '../../utils/api';
import toast from 'react-hot-toast';

const SiteEngineerJobs = () => {
  const { user } = useAuth();
  const { projectId } = useParams();
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedJob, setSelectedJob] = useState(null);
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [newStatus, setNewStatus] = useState('');
  const [notes, setNotes] = useState('');
  const [projectInfo, setProjectInfo] = useState(null);

  useEffect(() => {
    if (projectId) {
      fetchJobs();
      fetchProjectInfo();
    }
  }, [projectId]);

  const fetchProjectInfo = async () => {
    try {
      const response = await api.get(`/projects/${projectId}`);
      setProject(response.data);
    } catch (error) {
      console.error('Error fetching project info:', error);
    }
  };

  const fetchJobs = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/jobs?project=${projectId}&limit=10000`);
      setJobs(response.data.jobs || []);
    } catch (error) {
      console.error('Error fetching jobs:', error);
      toast.error('Failed to fetch jobs');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = (job) => {
    setSelectedJob(job);
    setNewStatus(job.status);
    setNotes(job.notes || '');
    setStatusDialogOpen(true);
  };

  const handleStatusSave = async () => {
    if (!selectedJob) return;

    try {
      toast.loading('Updating job status...', { id: 'status-update' });
      
      try {
      await api.put(`/jobs/${selectedJob._id}`, {
        status: selectedStatus

      toast.success('Job status updated successfully!', { id: 'status-update' });
      setStatusDialogOpen(false);
      fetchJobs(); // Refresh the list
    } catch (error) {
      console.error('Error updating job status:', error);
      toast.error('Failed to update job status', { id: 'status-update' });
    }
  };

  const getStatusChip = (status) => {
    const statusConfig = {
      pending: { color: 'warning', label: 'Pending', icon: <Assignment /> },
      in_progress: { color: 'info', label: 'In Progress', icon: <Build /> },
      completed: { color: 'success', label: 'Completed', icon: <CheckCircle /> },
      not_applicable: { color: 'error', label: 'Non Clearance', icon: <Cancel /> },
      on_hold: { color: 'default', label: 'On Hold', icon: <Warning /> },
      cancelled: { color: 'default', label: 'Cancelled', icon: <Cancel /> }
    };

    const config = statusConfig[status] || statusConfig.pending;
    
    return (
      <Chip
        icon={config.icon}
        label={config.label}
        color={config.color}
        size="small"
        variant="filled"
      />
    );
  };

  const getJobTypeLabel = (jobType) => {
    const types = {
      cement_fire_proofing: 'Cement Fire Proofing',
      gypsum_fire_proofing: 'Gypsum Fire Proofing',
      intumescent_coatings: 'Intumescent Coatings',
      refinery_fire_proofing: 'Refinery Fire Proofing',
      custom: 'Custom Job'
    };
    return types[jobType] || jobType;
  };

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      {/* Header */}
      <Paper elevation={2} sx={{ p: 3, mb: 3, background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white' }}>
        <Grid container alignItems="center" spacing={2}>
          <Grid item>
            <Build sx={{ fontSize: 40 }} />
          </Grid>
          <Grid item xs>
            <Typography variant="h4" component="h1" gutterBottom>
              Site Engineer - Jobs Management
            </Typography>
            <Typography variant="h6">
              {projectInfo?.name || 'Project Jobs'} 
            </Typography>
            <Typography variant="body2" sx={{ opacity: 0.9 }}>
              Welcome {user?.name}! Update job statuses and track progress.
            </Typography>
          </Grid>
          <Grid item>
            <Card sx={{ minWidth: 120, bgcolor: 'rgba(255,255,255,0.1)' }}>
              <CardContent sx={{ textAlign: 'center', color: 'white', '&:last-child': { pb: 2 } }}>
                <Typography variant="h4" component="div">
                  {jobs.length}
                </Typography>
                <Typography variant="body2">
                  Total Jobs
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Paper>

      {/* Stats Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Assignment sx={{ fontSize: 30, color: 'warning.main', mb: 1 }} />
              <Typography variant="h6">
                {jobs.filter(j => j.status === 'pending').length}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Pending
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Build sx={{ fontSize: 30, color: 'info.main', mb: 1 }} />
              <Typography variant="h6">
                {jobs.filter(j => j.status === 'in_progress').length}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                In Progress
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <CheckCircle sx={{ fontSize: 30, color: 'success.main', mb: 1 }} />
              <Typography variant="h6">
                {jobs.filter(j => j.status === 'completed').length}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Completed
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Cancel sx={{ fontSize: 30, color: 'error.main', mb: 1 }} />
              <Typography variant="h6">
                {jobs.filter(j => j.status === 'not_applicable').length}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Non Clearance
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Jobs Table */}
      <Paper elevation={2}>
        <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
          <Typography variant="h6" component="h2">
            📋 Jobs List
          </Typography>
        </Box>
        
        {jobs.length === 0 ? (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <Assignment sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
            <Alert severity="info">
              No jobs found for this project.
            </Alert>
          </Box>
        ) : (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell><strong>Job Title</strong></TableCell>
                  <TableCell><strong>Type</strong></TableCell>
                  <TableCell><strong>Element</strong></TableCell>
                  <TableCell><strong>Status</strong></TableCell>
                  <TableCell><strong>Created</strong></TableCell>
                  <TableCell align="center"><strong>Actions</strong></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {jobs.map((job) => (
                  <TableRow 
                    key={job._id} 
                    hover
                    sx={{ 
                      '&:nth-of-type(odd)': { bgcolor: 'action.hover' },
                      cursor: 'pointer'
                    }}
                  >
                    <TableCell>
                      <Typography variant="body2" fontWeight="medium">
                        {job.jobTitle}
                      </Typography>
                      {job.jobDescription && (
                        <Typography variant="caption" color="text.secondary" display="block">
                          {job.jobDescription.substring(0, 80)}...
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Chip 
                        label={getJobTypeLabel(job.jobType)} 
                        size="small" 
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {job.structuralElement?.structureNumber || 'N/A'}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {job.structuralElement?.memberType}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {getStatusChip(job.status)}
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {new Date(job.createdAt).toLocaleDateString('en-US', { 
                          year: 'numeric', 
                          month: 'short', 
                          day: '2-digit' 
                        })}
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      <Tooltip title="Update Status">
                        <IconButton 
                          color="primary" 
                          onClick={() => handleStatusUpdate(job)}
                          size="small"
                        >
                          <Edit />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      {/* Status Update Dialog */}
      <Dialog 
        open={statusDialogOpen} 
        onClose={() => setStatusDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Edit color="primary" />
            Update Job Status
          </Box>
        </DialogTitle>
        <DialogContent>
          {selectedJob && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="subtitle1" gutterBottom>
                <strong>{selectedJob.jobTitle}</strong>
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                {selectedJob.jobDescription}
              </Typography>

              <FormControl fullWidth sx={{ mb: 3 }}>
                <InputLabel>Job Status</InputLabel>
                <Select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value)}
                  label="Job Status"
                >
                  <MenuItem value="pending">
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Assignment /> Pending
                    </Box>
                  </MenuItem>
                  <MenuItem value="in_progress">
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Build /> In Progress
                    </Box>
                  </MenuItem>
                  <MenuItem value="completed">
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <CheckCircle /> Completed
                    </Box>
                  </MenuItem>
                  <MenuItem value="not_applicable">
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Cancel /> Non Clearance
                    </Box>
                  </MenuItem>
                  <MenuItem value="on_hold">
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Warning /> On Hold
                    </Box>
                  </MenuItem>
                </Select>
              </FormControl>

              <TextField
                fullWidth
                multiline
                rows={3}
                label="Notes (Optional)"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add any notes about this job status update..."
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setStatusDialogOpen(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleStatusSave} 
            variant="contained"
            disabled={!newStatus}
          >
            Update Status
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default SiteEngineerJobs;
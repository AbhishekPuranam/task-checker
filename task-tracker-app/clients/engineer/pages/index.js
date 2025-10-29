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
  Button,
  Grid,
  Card,
  CardContent,
  Alert,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  AppBar,
  Toolbar,
  IconButton,
} from '@mui/material';
import {
  CheckCircle,
  Cancel,
  Build,
  LogoutOutlined,
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import api from '../utils/api';
import toast from 'react-hot-toast';

export default function JobsPage() {
  const { user, logout } = useAuth();
  const [jobs, setJobs] = useState([]);
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState('');
  const [loading, setLoading] = useState(true);
  const [updatingJob, setUpdatingJob] = useState(null);

  useEffect(() => {
    fetchProjects();
  }, []);

  useEffect(() => {
    if (selectedProject) {
      fetchJobs();
    }
  }, [selectedProject]);

  const fetchProjects = async () => {
    try {
      const response = await api.get('/projects');
      setProjects(response.data.tasks || []);
      // Auto-select first project if available
      if (response.data.tasks && response.data.tasks.length > 0) {
        setSelectedProject(response.data.tasks[0]._id);
      }
    } catch (error) {
      console.error('Error fetching projects:', error);
      toast.error('Failed to fetch projects');
    } finally {
      setLoading(false);
    }
  };

  const fetchJobs = async () => {
    if (!selectedProject) return;
    
    try {
      setLoading(true);
      const response = await api.get(`/jobs?project=${selectedProject}&limit=10000`);
      setJobs(response.data.jobs || []);
    } catch (error) {
      console.error('Error fetching jobs:', error);
      toast.error('Failed to fetch jobs');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async (jobId, newStatus) => {
    try {
      setUpdatingJob(jobId);
      toast.loading('Updating job status...', { id: 'status-update' });
      
      await api.put(`/jobs/${jobId}`, {
        status: newStatus,
        progressPercentage: newStatus === 'completed' ? 100 : 
                           newStatus === 'not_applicable' ? 0 : 0
      });

      toast.success('Job status updated successfully!', { id: 'status-update' });
      fetchJobs(); // Refresh the list
    } catch (error) {
      console.error('Error updating job status:', error);
      toast.error('Failed to update job status', { id: 'status-update' });
    } finally {
      setUpdatingJob(null);
    }
  };

  const getSelectedProjectName = () => {
    const project = projects.find(p => p._id === selectedProject);
    return project ? project.name || project.title : '';
  };

  if (loading && !selectedProject) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  return (
    <Box sx={{ flexGrow: 1 }}>
      {/* App Bar */}
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            🏗️ Site Engineer Portal
          </Typography>
          <Typography variant="body1" sx={{ mr: 2 }}>
            {user?.name}
          </Typography>
          <IconButton color="inherit" onClick={logout}>
            <LogoutOutlined />
          </IconButton>
        </Toolbar>
      </AppBar>

      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        {/* Header */}
        <Paper elevation={3} sx={{ p: 4, mb: 3, background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white' }}>
          <Box sx={{ textAlign: 'center' }}>
            <Build sx={{ fontSize: 50, mb: 2 }} />
            <Typography variant="h3" component="h1" gutterBottom fontWeight="bold">
              Site Engineer Jobs
            </Typography>
            <Typography variant="h6" sx={{ opacity: 0.9 }}>
              Welcome {user?.name}! Update job statuses below.
            </Typography>
          </Box>
        </Paper>

        {/* Project Selection */}
        <Paper elevation={2} sx={{ p: 3, mb: 3 }}>
          <Grid container spacing={3} alignItems="center">
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Select Project</InputLabel>
                <Select
                  value={selectedProject}
                  onChange={(e) => setSelectedProject(e.target.value)}
                  label="Select Project"
                >
                  {projects.map((project) => (
                    <MenuItem key={project._id} value={project._id}>
                      {project.name || project.title}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={3}>
              <Card sx={{ bgcolor: 'primary.main', color: 'white' }}>
                <CardContent sx={{ textAlign: 'center', '&:last-child': { pb: 2 } }}>
                  <Typography variant="h4" component="div">
                    {jobs.length}
                  </Typography>
                  <Typography variant="body1">
                    Total Jobs
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={3}>
              <Card sx={{ bgcolor: 'warning.main', color: 'white' }}>
                <CardContent sx={{ textAlign: 'center', '&:last-child': { pb: 2 } }}>
                  <Typography variant="h4" component="div">
                    {jobs.filter(job => !job.status || job.status === 'pending' || job.status === 'in_progress').length}
                  </Typography>
                  <Typography variant="body1">
                    Pending
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={6}>
              <Card sx={{ bgcolor: 'success.main', color: 'white' }}>
                <CardContent sx={{ textAlign: 'center', '&:last-child': { pb: 2 } }}>
                  <Typography variant="h4" component="div">
                    {jobs.filter(job => job.status === 'completed').length}
                  </Typography>
                  <Typography variant="body1">
                    Completed
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={6}>
              <Card sx={{ bgcolor: 'error.main', color: 'white' }}>
                <CardContent sx={{ textAlign: 'center', '&:last-child': { pb: 2 } }}>
                  <Typography variant="h4" component="div">
                    {jobs.filter(job => job.status === 'not_applicable').length}
                  </Typography>
                  <Typography variant="body1">
                    Non-clearance
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Paper>

        {selectedProject && (
          <>
            {/* Project Name Section */}
            <Paper elevation={2} sx={{ p: 3, mb: 3, bgcolor: 'grey.50' }}>
              <Typography variant="h4" component="h2" color="primary" fontWeight="bold">
                📋 {getSelectedProjectName()}
              </Typography>
            </Paper>

            {/* Jobs Table */}
            <Paper elevation={2}>
              {loading ? (
                <Box sx={{ p: 4, textAlign: 'center' }}>
                  <CircularProgress />
                </Box>
              ) : jobs.length === 0 ? (
                <Box sx={{ p: 4, textAlign: 'center' }}>
                  <Build sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
                  <Alert severity="info">
                    No jobs found for this project.
                  </Alert>
                </Box>
              ) : (
                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow sx={{ bgcolor: 'primary.main' }}>
                        <TableCell sx={{ color: 'white', fontWeight: 'bold', fontSize: '1.1rem' }}>
                          Job Name
                        </TableCell>
                        <TableCell sx={{ color: 'white', fontWeight: 'bold', fontSize: '1.1rem' }}>
                          Structure No.
                        </TableCell>
                        <TableCell sx={{ color: 'white', fontWeight: 'bold', fontSize: '1.1rem' }}>
                          Member Type
                        </TableCell>
                        <TableCell sx={{ color: 'white', fontWeight: 'bold', fontSize: '1.1rem' }}>
                          Grid No.
                        </TableCell>
                        <TableCell align="center" sx={{ color: 'white', fontWeight: 'bold', fontSize: '1.1rem' }}>
                          Current Status
                        </TableCell>
                        <TableCell align="center" sx={{ color: 'white', fontWeight: 'bold', fontSize: '1.1rem' }}>
                          Actions
                        </TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {jobs.map((job, index) => (
                        <TableRow 
                          key={job._id} 
                          sx={{ 
                            '&:nth-of-type(odd)': { bgcolor: 'action.hover' },
                            '&:hover': { bgcolor: 'primary.light', opacity: 0.1 }
                          }}
                        >
                          <TableCell>
                            <Box>
                              <Typography variant="body1" fontWeight="medium">
                                {job.jobTitle}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {job.jobType?.replace('_', ' ').toUpperCase()}
                              </Typography>
                            </Box>
                          </TableCell>
                          
                          <TableCell>
                            <Typography variant="body1" fontWeight="medium">
                              {job.structuralElement?.structureNumber || 'N/A'}
                            </Typography>
                          </TableCell>
                          
                          <TableCell>
                            <Typography variant="body1">
                              {job.structuralElement?.memberType || 'N/A'}
                            </Typography>
                          </TableCell>
                          
                          <TableCell>
                            <Typography variant="body1">
                              {job.structuralElement?.gridNo || 'N/A'}
                            </Typography>
                          </TableCell>
                          
                          <TableCell align="center">
                            <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                              {job.status === 'completed' && (
                                <Box sx={{ 
                                  px: 2, 
                                  py: 1, 
                                  bgcolor: 'success.light',
                                  color: 'success.contrastText',
                                  borderRadius: 2,
                                  fontWeight: 'bold',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 1
                                }}>
                                  <CheckCircle sx={{ fontSize: 16 }} />
                                  Completed
                                </Box>
                              )}
                              {job.status === 'not_applicable' && (
                                <Box sx={{ 
                                  px: 2, 
                                  py: 1, 
                                  bgcolor: 'error.light',
                                  color: 'error.contrastText',
                                  borderRadius: 2,
                                  fontWeight: 'bold',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 1
                                }}>
                                  <Cancel sx={{ fontSize: 16 }} />
                                  Non-clearance
                                </Box>
                              )}
                              {(!job.status || job.status === 'pending' || job.status === 'in_progress') && (
                                <Box sx={{ 
                                  px: 2, 
                                  py: 1, 
                                  bgcolor: 'warning.light',
                                  color: 'warning.contrastText',
                                  borderRadius: 2,
                                  fontWeight: 'bold',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 1
                                }}>
                                  <Build sx={{ fontSize: 16 }} />
                                  Pending
                                </Box>
                              )}
                            </Box>
                          </TableCell>
                          
                          <TableCell align="center">
                            <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center', flexWrap: 'wrap' }}>
                              <Button
                                variant={(!job.status || job.status === 'pending' || job.status === 'in_progress') ? "contained" : "outlined"}
                                color="warning"
                                size="small"
                                startIcon={<Build />}
                                onClick={() => handleStatusUpdate(job._id, 'pending')}
                                disabled={updatingJob === job._id}
                                sx={{ 
                                  minWidth: 100,
                                  fontWeight: 'bold',
                                  borderRadius: 2
                                }}
                              >
                                {updatingJob === job._id ? 'Updating...' : 'Pending'}
                              </Button>
                              
                              <Button
                                variant={job.status === 'completed' ? "contained" : "outlined"}
                                color="success"
                                size="small"
                                startIcon={<CheckCircle />}
                                onClick={() => handleStatusUpdate(job._id, 'completed')}
                                disabled={updatingJob === job._id}
                                sx={{ 
                                  minWidth: 110,
                                  fontWeight: 'bold',
                                  borderRadius: 2
                                }}
                              >
                                {updatingJob === job._id ? 'Updating...' : 'Completed'}
                              </Button>
                              
                              <Button
                                variant={job.status === 'not_applicable' ? "contained" : "outlined"}
                                color="error"
                                size="small"
                                startIcon={<Cancel />}
                                onClick={() => handleStatusUpdate(job._id, 'not_applicable')}
                                disabled={updatingJob === job._id}
                                sx={{ 
                                  minWidth: 130,
                                  fontWeight: 'bold',
                                  borderRadius: 2
                                }}
                              >
                                {updatingJob === job._id ? 'Updating...' : 'Non-clearance'}
                              </Button>
                            </Box>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </Paper>
          </>
        )}
      </Container>
    </Box>
  );
}

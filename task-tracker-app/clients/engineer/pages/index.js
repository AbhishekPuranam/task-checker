import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Container,
  Paper,
  Typography,
  Box,
  Button,
  Grid,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  AppBar,
  Toolbar,
  IconButton,
  TextField,
  Chip,
  InputAdornment,
  Tabs,
  Tab,
  LinearProgress,
  Card,
  CardContent,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Divider,
} from '@mui/material';
import {
  CheckCircle,
  Cancel,
  Build,
  LogoutOutlined,
  ExpandMore as ExpandMoreIcon,
  Search as SearchIcon,
  AccountCircle,
  DirectionsCar,
  EmojiEvents,
  LocalFireDepartment,
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import api from '../utils/api';
import toast from 'react-hot-toast';

// Tab definitions
const TABS = [
  { id: 'pending', label: 'Pending', color: '#f59e0b', icon: <Build /> },
  { id: 'completed', label: 'Complete', color: '#10b981', icon: <CheckCircle /> },
  { id: 'not_applicable', label: 'No Clearance', color: '#ef4444', icon: <Cancel /> },
];

export default function EngineerDashboard() {
  const { user, logout } = useAuth();
  const [jobs, setJobs] = useState([]);
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState('');
  const [loading, setLoading] = useState(true);
  const [updatingJob, setUpdatingJob] = useState(null);
  const [activeTab, setActiveTab] = useState('pending');
  const [searchTerm, setSearchTerm] = useState('');
  const [groupBy, setGroupBy] = useState('gridNo');
  const [subGroupBy, setSubGroupBy] = useState('fireProofingType');
  const [expandedGroups, setExpandedGroups] = useState({});

  // Stats for metrics
  const [stats, setStats] = useState({
    pending: { count: 0, sqm: 0 },
    completed: { count: 0, sqm: 0 },
    not_applicable: { count: 0, sqm: 0 },
  });

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

  const fetchJobs = useCallback(async () => {
    if (!selectedProject) return;
    
    try {
      setLoading(true);
      console.log('Fetching jobs for project:', selectedProject);
      // Use the new engineer-specific endpoint that fetches jobs from all subprojects
      const response = await api.get(`/jobs/engineer/jobs?page=1&limit=10000`);
      const fetchedJobs = response.data.jobs || [];
      console.log('Fetched jobs from subprojects:', fetchedJobs.length);
      console.log('Jobs data:', fetchedJobs);
      setJobs(fetchedJobs);
      calculateStats(fetchedJobs);
      
      if (fetchedJobs.length === 0) {
        toast.info('No jobs found for this project. Jobs are created when structural elements are uploaded via Excel.', {
          duration: 5000,
        });
      }
    } catch (error) {
      console.error('Error fetching jobs:', error);
      toast.error('Failed to fetch jobs');
    } finally {
      setLoading(false);
    }
  }, [selectedProject]);

  const calculateStats = (jobsData) => {
    const newStats = {
      pending: { count: 0, sqm: 0 },
      completed: { count: 0, sqm: 0 },
      not_applicable: { count: 0, sqm: 0 },
    };

    jobsData.forEach(job => {
      const status = !job.status || job.status === 'in_progress' ? 'pending' : job.status;
      const sqm = job.structuralElement?.surfaceAreaSqm || 0;
      
      if (newStats[status]) {
        newStats[status].count += 1;
        newStats[status].sqm += sqm;
      }
    });

    setStats(newStats);
  };

  // Filter and group jobs
  const groupedJobs = useMemo(() => {
    // Filter by active tab
    let filtered = jobs.filter(job => {
      const jobStatus = !job.status || job.status === 'in_progress' ? 'pending' : job.status;
      if (jobStatus !== activeTab) return false;

      // Filter by search term
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        const matches = 
          job.jobTitle?.toLowerCase().includes(searchLower) ||
          job.structuralElement?.structureNumber?.toLowerCase().includes(searchLower) ||
          job.structuralElement?.gridNo?.toLowerCase().includes(searchLower) ||
          job.structuralElement?.partMarkNo?.toLowerCase().includes(searchLower) ||
          job.structuralElement?.level?.toLowerCase().includes(searchLower);
        
        if (!matches) return false;
      }

      return true;
    });

    // Group by primary grouping
    const grouped = {};
    filtered.forEach(job => {
      const primaryKey = job.structuralElement?.[groupBy] || job[groupBy] || 'Other';
      
      if (!grouped[primaryKey]) {
        grouped[primaryKey] = {};
      }

      // Sub-group if specified
      if (subGroupBy) {
        const secondaryKey = job[subGroupBy] || job.structuralElement?.[subGroupBy] || 'Other';
        if (!grouped[primaryKey][secondaryKey]) {
          grouped[primaryKey][secondaryKey] = [];
        }
        grouped[primaryKey][secondaryKey].push(job);
      } else {
        if (!grouped[primaryKey].jobs) {
          grouped[primaryKey].jobs = [];
        }
        grouped[primaryKey].jobs.push(job);
      }
    });

    return grouped;
  }, [jobs, activeTab, searchTerm, groupBy, subGroupBy]);

  const handleStatusUpdate = useCallback(async (jobId, newStatus) => {
    try {
      setUpdatingJob(jobId);
      toast.loading('Updating job status...', { id: 'status-update' });
      
      // Use the new engineer-specific status update endpoint
      await api.patch(`/jobs/engineer/${jobId}/status`, {
        status: newStatus
      });

      toast.success('Job status updated successfully!', { id: 'status-update' });
      await fetchJobs();
    } catch (error) {
      console.error('Error updating job status:', error);
      toast.error('Failed to update job status', { id: 'status-update' });
    } finally {
      setUpdatingJob(null);
    }
  }, [fetchJobs]);

  const toggleGroup = (groupKey) => {
    setExpandedGroups(prev => ({
      ...prev,
      [groupKey]: !prev[groupKey]
    }));
  };

  const getFireProofingLabel = (type) => {
    const labels = {
      cement_fire_proofing: 'Cement Fire Proofing',
      refinery_fire_proofing: 'Refinery Fire Proofing',
      gypsum_fire_proofing: 'Gypsum Fire Proofing',
      intumescent_coatings: 'Intumescent Coatings',
    };
    return labels[type] || type?.replace(/_/g, ' ')?.replace(/\b\w/g, l => l.toUpperCase()) || 'Other';
  };

  // Race Track Visualization Component
  const RaceTrackMetrics = ({ stats }) => {
    const total = stats.pending.count + stats.completed.count + stats.not_applicable.count;
    const completedPercentage = total > 0 ? (stats.completed.count / total) * 100 : 0;
    const pendingPercentage = total > 0 ? (stats.pending.count / total) * 100 : 0;

    const totalSqm = stats.pending.sqm + stats.completed.sqm + stats.not_applicable.sqm;
    const completedSqmPercentage = totalSqm > 0 ? (stats.completed.sqm / totalSqm) * 100 : 0;

    return (
      <Box sx={{ mb: 3 }}>
        <Typography variant="h6" sx={{ mb: 2, color: '#6a11cb', fontWeight: 600 }}>
          📊 Progress Tracker
        </Typography>
        
        {/* Elements Race Track */}
        <Box sx={{ mb: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
            <Typography variant="body2" fontWeight="600" sx={{ color: '#666' }}>
              Elements Progress
            </Typography>
            <Typography variant="body2" fontWeight="600" sx={{ color: '#6a11cb' }}>
              {stats.completed.count} / {total} ({completedPercentage.toFixed(1)}%)
            </Typography>
          </Box>
          
          {/* Race Track */}
          <Box sx={{ 
            position: 'relative',
            height: 60,
            bgcolor: '#f5f5f5',
            borderRadius: 30,
            overflow: 'hidden',
            border: '3px solid #e0e0e0',
            boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.1)'
          }}>
            {/* Completed Track */}
            <Box sx={{
              position: 'absolute',
              left: 0,
              top: 0,
              height: '100%',
              width: `${completedPercentage}%`,
              background: 'linear-gradient(90deg, #10b981 0%, #059669 100%)',
              transition: 'width 1s ease-in-out',
              borderRadius: 30,
            }} />
            
            {/* Car Icon */}
            <Box sx={{
              position: 'absolute',
              left: `calc(${completedPercentage}% - 20px)`,
              top: '50%',
              transform: 'translateY(-50%)',
              transition: 'left 1s ease-in-out',
              zIndex: 2,
            }}>
              <DirectionsCar sx={{ fontSize: 40, color: '#fff', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))' }} />
            </Box>
            
            {/* Finish Line */}
            <Box sx={{
              position: 'absolute',
              right: 10,
              top: '50%',
              transform: 'translateY(-50%)',
              zIndex: 1,
            }}>
              <EmojiEvents sx={{ fontSize: 36, color: '#fbbf24' }} />
            </Box>
          </Box>

          {/* Stats Below Race Track */}
          <Grid container spacing={1} sx={{ mt: 1 }}>
            <Grid item xs={4}>
              <Box sx={{ textAlign: 'center', p: 1, bgcolor: '#fff3cd', borderRadius: 1 }}>
                <Typography variant="caption" sx={{ color: '#856404', fontWeight: 600 }}>
                  Pending
                </Typography>
                <Typography variant="h6" sx={{ color: '#f59e0b', fontWeight: 'bold' }}>
                  {stats.pending.count}
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={4}>
              <Box sx={{ textAlign: 'center', p: 1, bgcolor: '#d4edda', borderRadius: 1 }}>
                <Typography variant="caption" sx={{ color: '#155724', fontWeight: 600 }}>
                  Completed
                </Typography>
                <Typography variant="h6" sx={{ color: '#10b981', fontWeight: 'bold' }}>
                  {stats.completed.count}
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={4}>
              <Box sx={{ textAlign: 'center', p: 1, bgcolor: '#f8d7da', borderRadius: 1 }}>
                <Typography variant="caption" sx={{ color: '#721c24', fontWeight: 600 }}>
                  No Clearance
                </Typography>
                <Typography variant="h6" sx={{ color: '#ef4444', fontWeight: 'bold' }}>
                  {stats.not_applicable.count}
                </Typography>
              </Box>
            </Grid>
          </Grid>
        </Box>

        {/* SQM Race Track */}
        <Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
            <Typography variant="body2" fontWeight="600" sx={{ color: '#666' }}>
              SQM Progress
            </Typography>
            <Typography variant="body2" fontWeight="600" sx={{ color: '#6a11cb' }}>
              {stats.completed.sqm.toFixed(2)} / {totalSqm.toFixed(2)} SQM ({completedSqmPercentage.toFixed(1)}%)
            </Typography>
          </Box>
          
          <Box sx={{ 
            position: 'relative',
            height: 60,
            bgcolor: '#f5f5f5',
            borderRadius: 30,
            overflow: 'hidden',
            border: '3px solid #e0e0e0',
            boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.1)'
          }}>
            <Box sx={{
              position: 'absolute',
              left: 0,
              top: 0,
              height: '100%',
              width: `${completedSqmPercentage}%`,
              background: 'linear-gradient(90deg, #8b5cf6 0%, #7c3aed 100%)',
              transition: 'width 1s ease-in-out',
              borderRadius: 30,
            }} />
            
            <Box sx={{
              position: 'absolute',
              left: `calc(${completedSqmPercentage}% - 20px)`,
              top: '50%',
              transform: 'translateY(-50%)',
              transition: 'left 1s ease-in-out',
              zIndex: 2,
            }}>
              <DirectionsCar sx={{ fontSize: 40, color: '#fff', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))' }} />
            </Box>
            
            <Box sx={{
              position: 'absolute',
              right: 10,
              top: '50%',
              transform: 'translateY(-50%)',
              zIndex: 1,
            }}>
              <EmojiEvents sx={{ fontSize: 36, color: '#fbbf24' }} />
            </Box>
          </Box>

          <Grid container spacing={1} sx={{ mt: 1 }}>
            <Grid item xs={4}>
              <Box sx={{ textAlign: 'center', p: 1, bgcolor: '#fff3cd', borderRadius: 1 }}>
                <Typography variant="caption" sx={{ color: '#856404', fontWeight: 600 }}>
                  Pending SQM
                </Typography>
                <Typography variant="h6" sx={{ color: '#f59e0b', fontWeight: 'bold', fontSize: '1rem' }}>
                  {stats.pending.sqm.toFixed(2)}
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={4}>
              <Box sx={{ textAlign: 'center', p: 1, bgcolor: '#e0d4ff', borderRadius: 1 }}>
                <Typography variant="caption" sx={{ color: '#6a11cb', fontWeight: 600 }}>
                  Complete SQM
                </Typography>
                <Typography variant="h6" sx={{ color: '#8b5cf6', fontWeight: 'bold', fontSize: '1rem' }}>
                  {stats.completed.sqm.toFixed(2)}
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={4}>
              <Box sx={{ textAlign: 'center', p: 1, bgcolor: '#f8d7da', borderRadius: 1 }}>
                <Typography variant="caption" sx={{ color: '#721c24', fontWeight: 600 }}>
                  N/A SQM
                </Typography>
                <Typography variant="h6" sx={{ color: '#ef4444', fontWeight: 'bold', fontSize: '1rem' }}>
                  {stats.not_applicable.sqm.toFixed(2)}
                </Typography>
              </Box>
            </Grid>
          </Grid>
        </Box>
      </Box>
    );
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

  const selectedProjectName = projects.find(p => p._id === selectedProject)?.name || projects.find(p => p._id === selectedProject)?.title || '';

  return (
    <Box sx={{ flexGrow: 1, background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', minHeight: '100vh' }}>
      {/* App Bar */}
      <AppBar position="static" sx={{ background: 'linear-gradient(135deg, #6a11cb 0%, #2575fc 100%)' }}>
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            🏗️ Site Engineer Portal
          </Typography>
          <Typography variant="body1" sx={{ mr: 2 }}>
            {user?.name}
          </Typography>
          <IconButton 
            color="inherit" 
            onClick={() => window.location.href = '/engineer/profile'}
            title="Profile"
          >
            <AccountCircle />
          </IconButton>
          <IconButton color="inherit" onClick={logout} title="Logout">
            <LogoutOutlined />
          </IconButton>
        </Toolbar>
      </AppBar>

      <Container maxWidth="xl" sx={{ mt: 2, mb: 4, px: { xs: 1, sm: 2, md: 3 } }}>
        {/* Header */}
        <Paper elevation={3} sx={{ p: { xs: 3, sm: 4, md: 5 }, mb: 2, background: 'white', borderRadius: 3, boxShadow: '0 8px 32px rgba(106, 17, 203, 0.3)' }}>
          <Box sx={{ textAlign: 'center' }}>
            <Build sx={{ fontSize: { xs: 40, sm: 50, md: 60 }, mb: 2, color: '#7b2ff7' }} />
            <Typography variant="h3" component="h1" gutterBottom fontWeight="bold" sx={{ color: '#6a11cb', fontSize: { xs: '1.75rem', sm: '2.5rem', md: '3rem' } }}>
              Hi, {user?.name}! 👋
            </Typography>
            <Typography variant="h5" sx={{ opacity: 0.85, fontStyle: 'italic', mt: 2, fontWeight: 300, color: '#7b2ff7', fontSize: { xs: '1rem', sm: '1.25rem', md: '1.5rem' } }}>
              "We shape our buildings; thereafter they shape us."
            </Typography>
          </Box>
        </Paper>

        {/* Project Selection */}
        <Paper elevation={3} sx={{ p: { xs: 2, sm: 3, md: 4 }, mb: 3, borderRadius: 3, bgcolor: 'white', boxShadow: '0 4px 20px rgba(106, 17, 203, 0.2)' }}>
          <FormControl fullWidth>
            <InputLabel>Project</InputLabel>
            <Select
              value={selectedProject}
              onChange={(e) => setSelectedProject(e.target.value)}
              label="Project"
            >
              {projects.map((project) => (
                <MenuItem key={project._id} value={project._id}>
                  {project.name || project.title}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Paper>

        {selectedProject && (
          <>
            {/* Tabs */}
            <Paper elevation={3} sx={{ mb: 3, borderRadius: 3, overflow: 'hidden' }}>
              <Tabs
                value={activeTab}
                onChange={(e, newValue) => setActiveTab(newValue)}
                variant="fullWidth"
                sx={{
                  bgcolor: 'white',
                  '& .MuiTab-root': {
                    fontWeight: 600,
                    fontSize: { xs: '0.875rem', sm: '1rem' },
                  },
                }}
              >
                {TABS.map(tab => (
                  <Tab
                    key={tab.id}
                    value={tab.id}
                    label={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {tab.icon}
                        <span>{tab.label}</span>
                        <Chip
                          label={stats[tab.id].count}
                          size="small"
                          sx={{
                            bgcolor: tab.color,
                            color: 'white',
                            fontWeight: 'bold',
                            minWidth: 32,
                          }}
                        />
                      </Box>
                    }
                  />
                ))}
              </Tabs>
            </Paper>

            {/* Metrics with Race Track */}
            <Paper elevation={3} sx={{ p: 3, mb: 3, borderRadius: 3, bgcolor: 'white' }}>
              <RaceTrackMetrics stats={stats} />
            </Paper>

            {/* Search and Grouping Controls */}
            <Paper elevation={3} sx={{ p: 3, mb: 3, borderRadius: 3, bgcolor: 'white' }}>
              <Grid container spacing={2}>
                <Grid item xs={12} md={4}>
                  <TextField
                    fullWidth
                    label="Search"
                    placeholder="Search jobs, grid, structure..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <SearchIcon />
                        </InputAdornment>
                      ),
                    }}
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <FormControl fullWidth>
                    <InputLabel>Group By</InputLabel>
                    <Select
                      value={groupBy}
                      onChange={(e) => setGroupBy(e.target.value)}
                      label="Group By"
                    >
                      <MenuItem value="gridNo">Grid No</MenuItem>
                      <MenuItem value="level">Level</MenuItem>
                      <MenuItem value="fireProofingType">Fire Proofing Type</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} md={4}>
                  <FormControl fullWidth>
                    <InputLabel>Sub-Group By</InputLabel>
                    <Select
                      value={subGroupBy}
                      onChange={(e) => setSubGroupBy(e.target.value)}
                      label="Sub-Group By"
                    >
                      <MenuItem value="">None</MenuItem>
                      <MenuItem value="fireProofingType">Fire Proofing Type</MenuItem>
                      <MenuItem value="jobTitle">Job Title</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
              </Grid>
            </Paper>

            {/* Grouped Jobs Display */}
            <Paper elevation={3} sx={{ borderRadius: 3, bgcolor: 'white', overflow: 'hidden' }}>
              {loading ? (
                <Box sx={{ p: 4, textAlign: 'center' }}>
                  <CircularProgress />
                </Box>
              ) : Object.keys(groupedJobs).length === 0 ? (
                <Box sx={{ p: 4, textAlign: 'center' }}>
                  <Build sx={{ fontSize: 80, color: '#b794f6', mb: 2 }} />
                  <Typography variant="h6" sx={{ color: '#6a11cb', mb: 2 }}>
                    No jobs found for {TABS.find(t => t.id === activeTab)?.label}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                    {jobs.length === 0 
                      ? "This project doesn't have any jobs yet. Jobs are automatically created when structural elements are uploaded via Excel in the Admin portal."
                      : `All jobs for this project are in other statuses. Try switching tabs to see them.`
                    }
                  </Typography>
                  {jobs.length === 0 && (
                    <Box sx={{ 
                      p: 2, 
                      bgcolor: '#f8f7ff', 
                      borderRadius: 2, 
                      border: '1px solid #e0d4ff',
                      display: 'inline-block',
                      textAlign: 'left'
                    }}>
                      <Typography variant="body2" sx={{ fontWeight: 600, mb: 1, color: '#6a11cb' }}>
                        📝 How to add jobs:
                      </Typography>
                      <Typography variant="body2" color="text.secondary" component="div">
                        1. Admin uploads Excel with structural elements<br/>
                        2. System creates fire proofing jobs automatically<br/>
                        3. Jobs appear here for site engineers to update
                      </Typography>
                    </Box>
                  )}
                </Box>
              ) : (
                <Box>
                  {Object.keys(groupedJobs).sort().map(groupKey => {
                    const group = groupedJobs[groupKey];
                    const hasSubGroups = subGroupBy && typeof group === 'object' && !Array.isArray(group) && !group.jobs;
                    const groupJobs = hasSubGroups ? [] : (group.jobs || Object.values(group).flat());
                    const groupCount = hasSubGroups 
                      ? Object.values(group).reduce((sum, jobs) => sum + (Array.isArray(jobs) ? jobs.length : 0), 0)
                      : groupJobs.length;

                    return (
                      <Accordion
                        key={groupKey}
                        expanded={expandedGroups[groupKey] || false}
                        onChange={() => toggleGroup(groupKey)}
                        sx={{ '&:before': { display: 'none' } }}
                      >
                        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, width: '100%' }}>
                            <Typography variant="h6" sx={{ fontWeight: 600, color: '#6a11cb' }}>
                              {groupKey}
                            </Typography>
                            <Chip
                              label={`${groupCount} jobs`}
                              size="small"
                              sx={{ bgcolor: TABS.find(t => t.id === activeTab)?.color, color: 'white', fontWeight: 'bold' }}
                            />
                          </Box>
                        </AccordionSummary>
                        <AccordionDetails>
                          {hasSubGroups ? (
                            // Show sub-groups
                            Object.keys(group).sort().map(subGroupKey => {
                              const subGroupJobs = group[subGroupKey];
                              if (!Array.isArray(subGroupJobs)) return null;

                              return (
                                <Box key={subGroupKey} sx={{ mb: 3 }}>
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2, p: 2, bgcolor: '#f8f9fa', borderRadius: 2 }}>
                                    <LocalFireDepartment sx={{ color: '#ff6b35' }} />
                                    <Typography variant="subtitle1" fontWeight="600" sx={{ color: '#666' }}>
                                      {getFireProofingLabel(subGroupKey)}
                                    </Typography>
                                    <Chip label={`${subGroupJobs.length} jobs`} size="small" />
                                  </Box>
                                  <Grid container spacing={2}>
                                    {subGroupJobs.map(job => (
                                      <Grid item xs={12} key={job._id}>
                                        <Card variant="outlined" sx={{ '&:hover': { boxShadow: 3 } }}>
                                          <CardContent>
                                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                                              <Box>
                                                <Typography variant="h6" sx={{ fontWeight: 600, mb: 0.5 }}>
                                                  {job.jobTitle}
                                                </Typography>
                                                <Typography variant="body2" color="text.secondary">
                                                  Structure: {job.structuralElement?.structureNumber || 'N/A'}
                                                </Typography>
                                                {job.structuralElement?.surfaceAreaSqm && (
                                                  <Typography variant="body2" color="text.secondary">
                                                    SQM: {job.structuralElement.surfaceAreaSqm.toFixed(2)}
                                                  </Typography>
                                                )}
                                              </Box>
                                            </Box>
                                            <Divider sx={{ my: 2 }} />
                                            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                                              <Button
                                                variant={activeTab === 'pending' ? 'contained' : 'outlined'}
                                                color="warning"
                                                size="small"
                                                onClick={() => handleStatusUpdate(job._id, 'pending')}
                                                disabled={updatingJob === job._id}
                                              >
                                                Pending
                                              </Button>
                                              <Button
                                                variant={activeTab === 'completed' ? 'contained' : 'outlined'}
                                                color="success"
                                                size="small"
                                                onClick={() => handleStatusUpdate(job._id, 'completed')}
                                                disabled={updatingJob === job._id}
                                              >
                                                Complete
                                              </Button>
                                              <Button
                                                variant={activeTab === 'not_applicable' ? 'contained' : 'outlined'}
                                                color="error"
                                                size="small"
                                                onClick={() => handleStatusUpdate(job._id, 'not_applicable')}
                                                disabled={updatingJob === job._id}
                                              >
                                                No Clearance
                                              </Button>
                                            </Box>
                                          </CardContent>
                                        </Card>
                                      </Grid>
                                    ))}
                                  </Grid>
                                </Box>
                              );
                            })
                          ) : (
                            // Show jobs directly
                            <Grid container spacing={2}>
                              {groupJobs.map(job => (
                                <Grid item xs={12} key={job._id}>
                                  <Card variant="outlined" sx={{ '&:hover': { boxShadow: 3 } }}>
                                    <CardContent>
                                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                                        <Box>
                                          <Typography variant="h6" sx={{ fontWeight: 600, mb: 0.5 }}>
                                            {job.jobTitle}
                                          </Typography>
                                          <Typography variant="body2" color="text.secondary">
                                            Structure: {job.structuralElement?.structureNumber || 'N/A'}
                                          </Typography>
                                          {job.structuralElement?.surfaceAreaSqm && (
                                            <Typography variant="body2" color="text.secondary">
                                              SQM: {job.structuralElement.surfaceAreaSqm.toFixed(2)}
                                            </Typography>
                                          )}
                                        </Box>
                                      </Box>
                                      <Divider sx={{ my: 2 }} />
                                      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                                        <Button
                                          variant={activeTab === 'pending' ? 'contained' : 'outlined'}
                                          color="warning"
                                          size="small"
                                          onClick={() => handleStatusUpdate(job._id, 'pending')}
                                          disabled={updatingJob === job._id}
                                        >
                                          Pending
                                        </Button>
                                        <Button
                                          variant={activeTab === 'completed' ? 'contained' : 'outlined'}
                                          color="success"
                                          size="small"
                                          onClick={() => handleStatusUpdate(job._id, 'completed')}
                                          disabled={updatingJob === job._id}
                                        >
                                          Complete
                                        </Button>
                                        <Button
                                          variant={activeTab === 'not_applicable' ? 'contained' : 'outlined'}
                                          color="error"
                                          size="small"
                                          onClick={() => handleStatusUpdate(job._id, 'not_applicable')}
                                          disabled={updatingJob === job._id}
                                        >
                                          No Clearance
                                        </Button>
                                      </Box>
                                    </CardContent>
                                  </Card>
                                </Grid>
                              ))}
                            </Grid>
                          )}
                        </AccordionDetails>
                      </Accordion>
                    );
                  })}
                </Box>
              )}
            </Paper>
          </>
        )}
      </Container>
    </Box>
  );
}
